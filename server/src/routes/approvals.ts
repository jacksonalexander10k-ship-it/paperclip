import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  addApprovalCommentSchema,
  createApprovalSchema,
  requestApprovalRevisionSchema,
  resolveApprovalSchema,
  resubmitApprovalSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { logger } from "../middleware/logger.js";
import {
  approvalService,
  heartbeatService,
  issueApprovalService,
  logActivity,
  secretService,
  agentLearningService,
} from "../services/index.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import { redactEventPayload } from "../redaction.js";
import { runDemoAfterPlanApproval } from "./demo-orchestrator.js";

function redactApprovalPayload<T extends { payload: Record<string, unknown> }>(approval: T): T {
  return {
    ...approval,
    payload: redactEventPayload(approval.payload) ?? {},
  };
}

export function approvalRoutes(db: Db) {
  const router = Router();
  const svc = approvalService(db);
  const heartbeat = heartbeatService(db);
  const issueApprovalsSvc = issueApprovalService(db);
  const secretsSvc = secretService(db);
  const strictSecretsMode = process.env.PAPERCLIP_SECRETS_STRICT_MODE === "true";
  const learnings = agentLearningService(db);

  router.get("/companies/:companyId/approvals", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const status = req.query.status as string | undefined;
    const result = await svc.list(companyId, status);
    res.json(result.map((approval) => redactApprovalPayload(approval)));
  });

  router.get("/approvals/:id", async (req, res) => {
    const id = req.params.id as string;
    const approval = await svc.getById(id);
    if (!approval) {
      res.status(404).json({ error: "Approval not found" });
      return;
    }
    assertCompanyAccess(req, approval.companyId);
    res.json(redactApprovalPayload(approval));
  });

  router.post("/companies/:companyId/approvals", validate(createApprovalSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const rawIssueIds = req.body.issueIds;
    const issueIds = Array.isArray(rawIssueIds)
      ? rawIssueIds.filter((value: unknown): value is string => typeof value === "string")
      : [];
    const uniqueIssueIds = Array.from(new Set(issueIds));
    const { issueIds: _issueIds, ...approvalInput } = req.body;
    const normalizedPayload =
      approvalInput.type === "hire_agent"
        ? await secretsSvc.normalizeHireApprovalPayloadForPersistence(
            companyId,
            approvalInput.payload,
            { strictMode: strictSecretsMode },
          )
        : approvalInput.payload;

    const actor = getActorInfo(req);
    const approval = await svc.create(companyId, {
      ...approvalInput,
      payload: normalizedPayload,
      requestedByUserId: actor.actorType === "user" ? actor.actorId : null,
      requestedByAgentId:
        approvalInput.requestedByAgentId ?? (actor.actorType === "agent" ? actor.actorId : null),
      status: "pending",
      decisionNote: null,
      decidedByUserId: null,
      decidedAt: null,
      updatedAt: new Date(),
    });

    if (uniqueIssueIds.length > 0) {
      await issueApprovalsSvc.linkManyForApproval(approval.id, uniqueIssueIds, {
        agentId: actor.agentId,
        userId: actor.actorType === "user" ? actor.actorId : null,
      });
    }

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "approval.created",
      entityType: "approval",
      entityId: approval.id,
      details: { type: approval.type, issueIds: uniqueIssueIds },
    });

    res.status(201).json(redactApprovalPayload(approval));
  });

  router.get("/approvals/:id/issues", async (req, res) => {
    const id = req.params.id as string;
    const approval = await svc.getById(id);
    if (!approval) {
      res.status(404).json({ error: "Approval not found" });
      return;
    }
    assertCompanyAccess(req, approval.companyId);
    const issues = await issueApprovalsSvc.listIssuesForApproval(id);
    res.json(issues);
  });

  router.post("/approvals/:id/approve", validate(resolveApprovalSchema), async (req, res) => {
    assertBoard(req);
    const id = req.params.id as string;
    const editedPayload =
      req.body.editedPayload && typeof req.body.editedPayload === "object"
        ? (req.body.editedPayload as Record<string, unknown>)
        : undefined;
    // Capture original payload BEFORE approve merges the edit
    let originalPayload: Record<string, unknown> | null = null;
    if (editedPayload && Object.keys(editedPayload).length > 0) {
      try {
        const existing = await svc.getById(id);
        originalPayload = existing?.payload as Record<string, unknown> | null;
      } catch { /* non-critical */ }
    }

    const { approval, applied } = await svc.approve(
      id,
      req.body.decidedByUserId ?? "board",
      req.body.decisionNote,
      editedPayload,
    );

    // Capture the edit as a learning (correction signal)
    if (applied && editedPayload && originalPayload && approval.requestedByAgentId) {
      const originalMessage = String(originalPayload.message ?? originalPayload.caption ?? originalPayload.body ?? "");
      const correctedMessage = String(editedPayload.message ?? editedPayload.caption ?? editedPayload.body ?? "");
      if (originalMessage && correctedMessage && originalMessage !== correctedMessage) {
        learnings.captureCorrection(approval.companyId, {
          agentId: approval.requestedByAgentId,
          approvalId: approval.id,
          actionType: approval.type,
          context: `To: ${String(originalPayload.to ?? "")}`.trim() || undefined,
          original: originalMessage,
          corrected: correctedMessage,
          reason: req.body.decisionNote ?? undefined,
        }).catch((err) => {
          logger.warn({ err, approvalId: approval.id }, "failed to capture approval correction as learning");
        });
      }
    }

    if (applied) {
      const linkedIssues = await issueApprovalsSvc.listIssuesForApproval(approval.id);
      const linkedIssueIds = linkedIssues.map((issue) => issue.id);
      const primaryIssueId = linkedIssueIds[0] ?? null;

      await logActivity(db, {
        companyId: approval.companyId,
        actorType: "user",
        actorId: req.actor.userId ?? "board",
        action: "approval.approved",
        entityType: "approval",
        entityId: approval.id,
        details: {
          type: approval.type,
          requestedByAgentId: approval.requestedByAgentId,
          linkedIssueIds,
        },
      });

      // Demo trigger: when a plan approval is approved, fire the demo agent sequence
      if (approval.type === "approve_plan") {
        const payload = approval.payload as Record<string, unknown> | null;
        const ceoChatIssueId = typeof payload?.ceoChatIssueId === "string" ? payload.ceoChatIssueId : undefined;
        logger.info({ approvalId: approval.id, ceoChatIssueId }, "demo trigger: approve_plan detected, starting agent sequence...");
        runDemoAfterPlanApproval(db, approval.companyId, ceoChatIssueId).catch((err) => {
          logger.error({ err }, "demo trigger: runDemoAfterPlanApproval FAILED");
        });
      }

      if (approval.requestedByAgentId) {
        try {
          const wakeRun = await heartbeat.wakeup(approval.requestedByAgentId, {
            source: "automation",
            triggerDetail: "system",
            reason: "approval_approved",
            payload: {
              approvalId: approval.id,
              approvalStatus: approval.status,
              issueId: primaryIssueId,
              issueIds: linkedIssueIds,
            },
            requestedByActorType: "user",
            requestedByActorId: req.actor.userId ?? "board",
            contextSnapshot: {
              source: "approval.approved",
              approvalId: approval.id,
              approvalStatus: approval.status,
              issueId: primaryIssueId,
              issueIds: linkedIssueIds,
              taskId: primaryIssueId,
              wakeReason: "approval_approved",
            },
          });

          await logActivity(db, {
            companyId: approval.companyId,
            actorType: "user",
            actorId: req.actor.userId ?? "board",
            action: "approval.requester_wakeup_queued",
            entityType: "approval",
            entityId: approval.id,
            details: {
              requesterAgentId: approval.requestedByAgentId,
              wakeRunId: wakeRun?.id ?? null,
              linkedIssueIds,
            },
          });
        } catch (err) {
          logger.warn(
            {
              err,
              approvalId: approval.id,
              requestedByAgentId: approval.requestedByAgentId,
            },
            "failed to queue requester wakeup after approval",
          );
          await logActivity(db, {
            companyId: approval.companyId,
            actorType: "user",
            actorId: req.actor.userId ?? "board",
            action: "approval.requester_wakeup_failed",
            entityType: "approval",
            entityId: approval.id,
            details: {
              requesterAgentId: approval.requestedByAgentId,
              linkedIssueIds,
              error: err instanceof Error ? err.message : String(err),
            },
          });
        }
      }
    }

    res.json(redactApprovalPayload(approval));
  });

  router.post("/companies/:companyId/approvals/batch-approve", async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const ids: unknown = req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "ids must be a non-empty array" });
      return;
    }
    const approvalIds = ids.filter((id): id is string => typeof id === "string");
    const results: Array<{ id: string; status: "approved" | "error"; applied?: boolean; error?: string }> = [];
    for (const id of approvalIds) {
      try {
        const { approval, applied } = await svc.approve(
          id,
          req.body.decidedByUserId ?? "board",
          undefined,
          undefined,
        );
        if (applied) {
          const linkedIssues = await issueApprovalsSvc.listIssuesForApproval(approval.id);
          const linkedIssueIds = linkedIssues.map((issue) => issue.id);
          const primaryIssueId = linkedIssueIds[0] ?? null;
          await logActivity(db, {
            companyId: approval.companyId,
            actorType: "user",
            actorId: req.actor.userId ?? "board",
            action: "approval.approved",
            entityType: "approval",
            entityId: approval.id,
            details: { type: approval.type, requestedByAgentId: approval.requestedByAgentId, linkedIssueIds },
          });
          if (approval.requestedByAgentId) {
            try {
              const wakeRun = await heartbeat.wakeup(approval.requestedByAgentId, {
                source: "automation",
                triggerDetail: "system",
                reason: "approval_approved",
                payload: {
                  approvalId: approval.id,
                  approvalStatus: approval.status,
                  issueId: primaryIssueId,
                  issueIds: linkedIssueIds,
                },
                requestedByActorType: "user",
                requestedByActorId: req.actor.userId ?? "board",
                contextSnapshot: {
                  source: "approval.approved",
                  approvalId: approval.id,
                  approvalStatus: approval.status,
                  issueId: primaryIssueId,
                  issueIds: linkedIssueIds,
                  taskId: primaryIssueId,
                  wakeReason: "approval_approved",
                },
              });
              await logActivity(db, {
                companyId: approval.companyId,
                actorType: "user",
                actorId: req.actor.userId ?? "board",
                action: "approval.requester_wakeup_queued",
                entityType: "approval",
                entityId: approval.id,
                details: { requesterAgentId: approval.requestedByAgentId, wakeRunId: wakeRun?.id ?? null, linkedIssueIds },
              });
            } catch (err) {
              logger.warn({ err, approvalId: approval.id }, "batch-approve: failed to queue requester wakeup");
            }
          }
        }
        results.push({ id, status: "approved", applied });
      } catch (err) {
        results.push({ id, status: "error", error: err instanceof Error ? err.message : String(err) });
      }
    }
    res.json({ results });
  });

  router.post("/approvals/:id/reject", validate(resolveApprovalSchema), async (req, res) => {
    assertBoard(req);
    const id = req.params.id as string;
    const { approval, applied } = await svc.reject(
      id,
      req.body.decidedByUserId ?? "board",
      req.body.decisionNote,
    );

    if (applied) {
      // Capture the rejection as a learning
      if (approval.requestedByAgentId) {
        const payload = approval.payload as Record<string, unknown> | null;
        const originalMessage = String(payload?.message ?? payload?.caption ?? payload?.body ?? "");
        if (originalMessage) {
          learnings.captureRejection(approval.companyId, {
            agentId: approval.requestedByAgentId,
            approvalId: approval.id,
            actionType: approval.type,
            context: `To: ${String(payload?.to ?? "")}`.trim() || undefined,
            original: originalMessage,
            reason: req.body.decisionNote ?? undefined,
          }).catch((err) => {
            logger.warn({ err, approvalId: approval.id }, "failed to capture approval rejection as learning");
          });
        }
      }

      await logActivity(db, {
        companyId: approval.companyId,
        actorType: "user",
        actorId: req.actor.userId ?? "board",
        action: "approval.rejected",
        entityType: "approval",
        entityId: approval.id,
        details: { type: approval.type },
      });
    }

    res.json(redactApprovalPayload(approval));
  });

  router.post(
    "/approvals/:id/request-revision",
    validate(requestApprovalRevisionSchema),
    async (req, res) => {
      assertBoard(req);
      const id = req.params.id as string;
      const approval = await svc.requestRevision(
        id,
        req.body.decidedByUserId ?? "board",
        req.body.decisionNote,
      );

      await logActivity(db, {
        companyId: approval.companyId,
        actorType: "user",
        actorId: req.actor.userId ?? "board",
        action: "approval.revision_requested",
        entityType: "approval",
        entityId: approval.id,
        details: { type: approval.type },
      });

      res.json(redactApprovalPayload(approval));
    },
  );

  router.post("/approvals/:id/resubmit", validate(resubmitApprovalSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Approval not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);

    if (req.actor.type === "agent" && req.actor.agentId !== existing.requestedByAgentId) {
      res.status(403).json({ error: "Only requesting agent can resubmit this approval" });
      return;
    }

    const normalizedPayload = req.body.payload
      ? existing.type === "hire_agent"
        ? await secretsSvc.normalizeHireApprovalPayloadForPersistence(
            existing.companyId,
            req.body.payload,
            { strictMode: strictSecretsMode },
          )
        : req.body.payload
      : undefined;
    const approval = await svc.resubmit(id, normalizedPayload);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: approval.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "approval.resubmitted",
      entityType: "approval",
      entityId: approval.id,
      details: { type: approval.type },
    });
    res.json(redactApprovalPayload(approval));
  });

  router.get("/approvals/:id/comments", async (req, res) => {
    const id = req.params.id as string;
    const approval = await svc.getById(id);
    if (!approval) {
      res.status(404).json({ error: "Approval not found" });
      return;
    }
    assertCompanyAccess(req, approval.companyId);
    const comments = await svc.listComments(id);
    res.json(comments);
  });

  router.post("/approvals/:id/comments", validate(addApprovalCommentSchema), async (req, res) => {
    const id = req.params.id as string;
    const approval = await svc.getById(id);
    if (!approval) {
      res.status(404).json({ error: "Approval not found" });
      return;
    }
    assertCompanyAccess(req, approval.companyId);
    const actor = getActorInfo(req);
    const comment = await svc.addComment(id, req.body.body, {
      agentId: actor.agentId ?? undefined,
      userId: actor.actorType === "user" ? actor.actorId : undefined,
    });

    await logActivity(db, {
      companyId: approval.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "approval.comment_added",
      entityType: "approval",
      entityId: approval.id,
      details: { commentId: comment.id },
    });

    res.status(201).json(comment);
  });

  return router;
}
