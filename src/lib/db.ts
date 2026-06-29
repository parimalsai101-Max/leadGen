import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { list, put } from "@vercel/blob";

// Local SQLite for dev; on Vercel the DB file is synced to Blob so all serverless
// instances share the same searches, runs, and leads.

const BLOB_PATHNAME = "leadgen.db";
const DB_DIR = process.env.VERCEL
  ? path.join("/tmp", "leadgen-data")
  : path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "leadgen.db");

declare global {
  var __leadgenDb: Database.Database | undefined;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS searches (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    niche      TEXT NOT NULL,
    location   TEXT,
    lim        INTEGER NOT NULL DEFAULT 10,
    channels   TEXT,
    label      TEXT,
    active     INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (niche, location)
  );

  CREATE TABLE IF NOT EXISTS runs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at   TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at  TEXT,
    status       TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','done','error')),
    search_count INTEGER NOT NULL DEFAULT 0,
    lead_count   INTEGER NOT NULL DEFAULT 0,
    enrich       INTEGER NOT NULL DEFAULT 0,
    error        TEXT
  );

  CREATE TABLE IF NOT EXISTS leads (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT NOT NULL,
    domain           TEXT NOT NULL,
    website          TEXT NOT NULL,
    description      TEXT,
    query            TEXT,
    channels         TEXT NOT NULL DEFAULT '[]',
    outreach         TEXT,
    seo              TEXT,
    score            INTEGER NOT NULL DEFAULT 0,
    opportunity_score INTEGER NOT NULL DEFAULT 0,
    issues_count     INTEGER NOT NULL DEFAULT 0,
    has_email        INTEGER NOT NULL DEFAULT 0,
    score_reasons    TEXT NOT NULL DEFAULT '[]',
    status           TEXT NOT NULL DEFAULT 'new'
                     CHECK (status IN ('new','qualified','contacted','won','lost','archived')),
    notes            TEXT,
    run_id           INTEGER REFERENCES runs(id) ON DELETE SET NULL,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (domain)
  );

  CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
  CREATE INDEX IF NOT EXISTS idx_leads_score  ON leads(score DESC);
`;

function closeDb(): void {
  if (global.__leadgenDb) {
    global.__leadgenDb.close();
    global.__leadgenDb = undefined;
  }
}

function openDb(): Database.Database {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

async function loadFromBlob(): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    const { blobs } = await list({ prefix: BLOB_PATHNAME, token: process.env.BLOB_READ_WRITE_TOKEN });
    const hit = blobs.find((b) => b.pathname === BLOB_PATHNAME);
    if (!hit) return;
    const res = await fetch(hit.url);
    if (!res.ok) return;
    fs.mkdirSync(DB_DIR, { recursive: true });
    fs.writeFileSync(DB_PATH, Buffer.from(await res.arrayBuffer()));
  } catch (e) {
    console.error("[db] blob load failed:", (e as Error).message);
  }
}

async function saveToBlob(): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN || !fs.existsSync(DB_PATH)) return;
  try {
    await put(BLOB_PATHNAME, fs.readFileSync(DB_PATH), {
      access: "private",
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      allowOverwrite: true,
    });
  } catch (e) {
    console.error("[db] blob save failed:", (e as Error).message);
  }
}

/** Run a DB operation; on Vercel, syncs from/to Blob so data persists across instances. */
export async function withDb<T>(fn: (db: Database.Database) => T): Promise<T> {
  if (process.env.VERCEL) {
    closeDb();
    await loadFromBlob();
  } else if (!global.__leadgenDb) {
    global.__leadgenDb = openDb();
  }

  const db = process.env.VERCEL ? openDb() : global.__leadgenDb!;
  try {
    return fn(db);
  } finally {
    if (process.env.VERCEL) {
      closeDb();
      await saveToBlob();
    }
  }
}

/** @deprecated Use withDb for Vercel-safe access. Kept for any legacy sync callers. */
export function getDb(): Database.Database {
  if (!global.__leadgenDb) global.__leadgenDb = openDb();
  return global.__leadgenDb;
}
