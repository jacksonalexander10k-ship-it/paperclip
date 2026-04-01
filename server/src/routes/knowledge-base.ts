import { Router, type Request } from "express";
import multer from "multer";
import type { Db } from "@paperclipai/db";
import type { StorageService } from "../storage/types.js";
import { knowledgeBaseService } from "../services/knowledge-base.js";
import { logActivity } from "../services/index.js";
import { MAX_ATTACHMENT_BYTES } from "../attachment-types.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { notFound } from "../errors.js";

const KNOWLEDGE_BASE_ALLOWED_TYPES = [
  "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif",
  "application/pdf",
  "text/markdown", "text/plain", "text/csv", "text/html",
  "application/json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

function isAllowedKBType(contentType: string): boolean {
  return KNOWLEDGE_BASE_ALLOWED_TYPES.includes(contentType.toLowerCase());
}

export function knowledgeBaseRoutes(db: Db, storage: StorageService) {
  const router = Router();
  const svc = knowledgeBaseService(db);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 },
  });

  // List files
  router.get("/companies/:companyId/knowledge-base", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const files = await svc.list(companyId);
    res.json({ files });
  });

  // Upload file
  router.post("/companies/:companyId/knowledge-base", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    try {
      await new Promise<void>((resolve, reject) => {
        upload.single("file")(req, res, (err: unknown) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(422).json({ error: `File exceeds ${MAX_ATTACHMENT_BYTES} bytes` });
          return;
        }
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }

    const file = (req as Request & { file?: { mimetype: string; buffer: Buffer; originalname: string } }).file;
    if (!file) {
      res.status(400).json({ error: "Missing file field 'file'" });
      return;
    }

    if (!isAllowedKBType(file.mimetype)) {
      res.status(422).json({ error: `File type '${file.mimetype}' is not allowed` });
      return;
    }

    const stored = await storage.putFile({
      companyId,
      namespace: "knowledge-base",
      originalFilename: file.originalname || null,
      contentType: file.mimetype,
      body: file.buffer,
    });

    const actor = getActorInfo(req);
    const record = await svc.create({
      companyId,
      filename: file.originalname || "untitled",
      title: typeof req.body?.title === "string" ? req.body.title : null,
      description: typeof req.body?.description === "string" ? req.body.description : null,
      contentType: stored.contentType,
      sizeBytes: stored.byteSize,
      storageKey: stored.objectKey,
      uploadedByUserId: actor.actorType === "user" ? actor.actorId : null,
    });

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "knowledge_base_file.created",
      entityType: "knowledge_base_file",
      entityId: record.id,
      details: { filename: record.filename, contentType: record.contentType },
    });

    res.status(201).json(record);
  });

  // Update file metadata
  router.patch("/companies/:companyId/knowledge-base/:fileId", async (req, res) => {
    const { companyId, fileId } = req.params;
    assertCompanyAccess(req, companyId as string);

    const updated = await svc.update(companyId as string, fileId as string, {
      title: req.body?.title,
      description: req.body?.description,
    });

    if (!updated) {
      throw notFound("File not found");
    }

    res.json(updated);
  });

  // Delete file
  router.delete("/companies/:companyId/knowledge-base/:fileId", async (req, res) => {
    const { companyId, fileId } = req.params;
    assertCompanyAccess(req, companyId as string);

    const files = await svc.list(companyId as string);
    const file = files.find((f) => f.id === fileId);
    if (!file) {
      throw notFound("File not found");
    }

    await storage.deleteObject(companyId as string, file.storageKey);
    await svc.delete(companyId as string, fileId as string);

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: companyId as string,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "knowledge_base_file.deleted",
      entityType: "knowledge_base_file",
      entityId: fileId as string,
      details: { filename: file.filename },
    });

    res.json({ ok: true });
  });

  return router;
}
