/**
 * Baileys Auth State — Postgres Adapter
 *
 * Implements Baileys' AuthenticationState interface backed by Postgres
 * instead of the filesystem. This means sessions survive server restarts
 * and work in containerized deployments.
 */

import { and, eq } from "drizzle-orm";
import baileys from "@whiskeysockets/baileys";
import type { AuthenticationCreds, AuthenticationState, SignalDataTypeMap } from "@whiskeysockets/baileys";

const { initAuthCreds } = baileys;
import type { Db } from "@paperclipai/db";
import { aygentBaileysAuth, aygentBaileysKeys } from "@paperclipai/db";
import { logger } from "../middleware/logger.js";

const KEY_MAP: { [T in keyof SignalDataTypeMap]: string } = {
  "pre-key": "pre-key",
  session: "session",
  "sender-key": "sender-key",
  "app-state-sync-key": "app-state-sync-key",
  "app-state-sync-version": "app-state-sync-version",
  "sender-key-memory": "sender-key-memory",
};

function serializeKey(type: string, data: unknown): string {
  if (type === "pre-key") {
    return JSON.stringify(data);
  }
  if (type === "session") {
    return JSON.stringify(data);
  }
  if (type === "sender-key") {
    return JSON.stringify(data);
  }
  if (type === "app-state-sync-key") {
    // Serialize as JSON — works for Baileys multi-device auth
    return JSON.stringify(data);
  }
  if (type === "app-state-sync-version") {
    return JSON.stringify(data);
  }
  if (type === "sender-key-memory") {
    return JSON.stringify(data);
  }
  return JSON.stringify(data);
}

function deserializeKey(type: string, raw: string): unknown {
  return JSON.parse(raw);
}

/**
 * Creates a Baileys-compatible auth state backed by Postgres.
 * Drop-in replacement for `useMultiFileAuthState`.
 */
export async function usePostgresAuthState(
  db: Db,
  agentId: string,
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  // Load or initialize credentials
  const existingRows = await db
    .select()
    .from(aygentBaileysAuth)
    .where(eq(aygentBaileysAuth.agentId, agentId))
    .limit(1);

  let creds: AuthenticationCreds;
  if (existingRows[0]?.credsJson) {
    creds = JSON.parse(existingRows[0].credsJson);
  } else {
    creds = initAuthCreds();
  }

  const saveCreds = async () => {
    const json = JSON.stringify(creds);
    const existing = await db
      .select({ id: aygentBaileysAuth.id })
      .from(aygentBaileysAuth)
      .where(eq(aygentBaileysAuth.agentId, agentId))
      .limit(1);

    if (existing[0]) {
      await db
        .update(aygentBaileysAuth)
        .set({ credsJson: json, updatedAt: new Date() })
        .where(eq(aygentBaileysAuth.agentId, agentId));
    }
    // If no row exists yet, it gets created by the session manager during connect()
  };

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
        const result: { [id: string]: SignalDataTypeMap[T] } = {};
        if (ids.length === 0) return result;

        for (const id of ids) {
          try {
            const rows = await db
              .select()
              .from(aygentBaileysKeys)
              .where(
                and(
                  eq(aygentBaileysKeys.agentId, agentId),
                  eq(aygentBaileysKeys.keyType, KEY_MAP[type] ?? type),
                  eq(aygentBaileysKeys.keyId, id),
                ),
              )
              .limit(1);

            if (rows[0]) {
              result[id] = deserializeKey(type, rows[0].keyData) as SignalDataTypeMap[T];
            }
          } catch (err) {
            logger.warn({ err, type, id }, "baileys-auth: failed to read key");
          }
        }
        return result;
      },

      set: async (data: { [T in keyof SignalDataTypeMap]?: { [id: string]: SignalDataTypeMap[T] | null } }) => {
        for (const _type in data) {
          const type = _type as keyof SignalDataTypeMap;
          const keyType = KEY_MAP[type] ?? type;
          const entries = data[type];
          if (!entries) continue;

          for (const [id, value] of Object.entries(entries)) {
            if (value === null || value === undefined) {
              // Delete key
              await db
                .delete(aygentBaileysKeys)
                .where(
                  and(
                    eq(aygentBaileysKeys.agentId, agentId),
                    eq(aygentBaileysKeys.keyType, keyType),
                    eq(aygentBaileysKeys.keyId, id),
                  ),
                );
            } else {
              // Upsert key
              const serialized = serializeKey(type, value);
              await db
                .insert(aygentBaileysKeys)
                .values({
                  agentId,
                  keyType,
                  keyId: id,
                  keyData: serialized,
                })
                .onConflictDoUpdate({
                  target: [aygentBaileysKeys.agentId, aygentBaileysKeys.keyType, aygentBaileysKeys.keyId],
                  set: { keyData: serialized },
                });
            }
          }
        }
      },
    },
  };

  return { state, saveCreds };
}

/**
 * Delete all auth state for an agent (used when disconnecting / logging out).
 */
export async function clearAuthState(db: Db, agentId: string) {
  await db.delete(aygentBaileysKeys).where(eq(aygentBaileysKeys.agentId, agentId));
  await db.delete(aygentBaileysAuth).where(eq(aygentBaileysAuth.agentId, agentId));
}
