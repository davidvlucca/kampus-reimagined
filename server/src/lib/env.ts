import type { Db } from "../db/client.ts";
import type { UserRow } from "../db/schema.ts";
import type { SessionConfig } from "../auth/session.ts";

export interface AppEnv {
  Variables: {
    db: Db;
    session: SessionConfig;
    user: UserRow;
    sessionId: string;
    /** IP de quem fez o pedido (para o limite de logins). */
    clientIp: string;
  };
}
