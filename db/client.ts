import path from "node:path";

import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

const LOCAL_FILE = `file:${path.join(process.cwd(), "data", "healthcare.db")}`;

declare global {
  // eslint-disable-next-line no-var
  var __libsql__: Client | undefined;
}

function buildClient(): Client {
  const url = process.env.TURSO_DATABASE_URL ?? LOCAL_FILE;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  return createClient({
    url,
    ...(authToken ? { authToken } : {}),
    intMode: "number",
  });
}

export const client: Client = global.__libsql__ ?? buildClient();
if (process.env.NODE_ENV !== "production") global.__libsql__ = client;

export const db = drizzle(client, { schema });
