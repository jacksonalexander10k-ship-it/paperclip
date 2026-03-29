import type { Db } from "@paperclipai/db";

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolContext {
  companyId: string;
  agentId: string;
  db: Db;
}

export type ToolExecutor = (
  input: Record<string, unknown>,
  ctx: ToolContext,
) => Promise<unknown>;
