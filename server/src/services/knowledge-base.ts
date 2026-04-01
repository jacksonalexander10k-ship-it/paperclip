import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { knowledgeBaseFiles } from "@paperclipai/db";

export interface KnowledgeBaseFile {
  id: string;
  companyId: string;
  filename: string;
  title: string | null;
  description: string | null;
  contentType: string;
  sizeBytes: number;
  storageKey: string;
  uploadedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function knowledgeBaseService(db: Db) {
  return {
    list: async (companyId: string): Promise<KnowledgeBaseFile[]> => {
      return db
        .select()
        .from(knowledgeBaseFiles)
        .where(eq(knowledgeBaseFiles.companyId, companyId))
        .orderBy(desc(knowledgeBaseFiles.createdAt));
    },

    create: async (input: {
      companyId: string;
      filename: string;
      title?: string | null;
      description?: string | null;
      contentType: string;
      sizeBytes: number;
      storageKey: string;
      uploadedByUserId?: string | null;
    }): Promise<KnowledgeBaseFile> => {
      const [row] = await db
        .insert(knowledgeBaseFiles)
        .values({
          companyId: input.companyId,
          filename: input.filename,
          title: input.title ?? null,
          description: input.description ?? null,
          contentType: input.contentType,
          sizeBytes: input.sizeBytes,
          storageKey: input.storageKey,
          uploadedByUserId: input.uploadedByUserId ?? null,
        })
        .returning();
      return row;
    },

    update: async (
      companyId: string,
      fileId: string,
      input: { title?: string | null; description?: string | null },
    ): Promise<KnowledgeBaseFile | null> => {
      const [row] = await db
        .update(knowledgeBaseFiles)
        .set({
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(knowledgeBaseFiles.id, fileId),
            eq(knowledgeBaseFiles.companyId, companyId),
          ),
        )
        .returning();
      return row ?? null;
    },

    delete: async (companyId: string, fileId: string): Promise<boolean> => {
      const [row] = await db
        .delete(knowledgeBaseFiles)
        .where(
          and(
            eq(knowledgeBaseFiles.id, fileId),
            eq(knowledgeBaseFiles.companyId, companyId),
          ),
        )
        .returning({ id: knowledgeBaseFiles.id });
      return !!row;
    },

    /** Returns file metadata needed for agent manifest injection. */
    listForManifest: async (companyId: string) => {
      return db
        .select({
          filename: knowledgeBaseFiles.filename,
          title: knowledgeBaseFiles.title,
          description: knowledgeBaseFiles.description,
          contentType: knowledgeBaseFiles.contentType,
          sizeBytes: knowledgeBaseFiles.sizeBytes,
          storageKey: knowledgeBaseFiles.storageKey,
        })
        .from(knowledgeBaseFiles)
        .where(eq(knowledgeBaseFiles.companyId, companyId))
        .orderBy(knowledgeBaseFiles.filename);
    },
  };
}
