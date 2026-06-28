import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

// Local SQLite store for the SEO lead-gen admin panel. File-based, zero-config.
// Swap for Postgres (Neon) before serverless deploy.

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "leadgen.db");

declare global {
  var __leadgenDb: Database.Database | undefined;
}

function init(): Database.Database {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
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
  `);

  return db;
}

export function getDb(): Database.Database {
  if (!global.__leadgenDb) global.__leadgenDb = init();
  return global.__leadgenDb;
}
