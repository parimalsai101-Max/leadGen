import fs from "node:fs";
import path from "node:path";
import { head, put } from "@vercel/blob";
import type { Lead, Outreach, SeoAudit, ChannelId } from "@/lib/types";

const BLOB_PATH = "leadgen-store.json";
const LOCAL_PATH = path.join(process.cwd(), "data", "leadgen-store.json");

export type LeadStatus = "new" | "qualified" | "contacted" | "won" | "lost" | "archived";
export const LEAD_STATUSES: LeadStatus[] = ["new", "qualified", "contacted", "won", "lost", "archived"];

export interface Search {
  id: number; niche: string; location: string | null; lim: number;
  channels: ChannelId[] | null; label: string | null; active: boolean; created_at: string;
}

export interface Run {
  id: number; started_at: string; finished_at: string | null;
  status: "running" | "done" | "error"; search_count: number; lead_count: number;
  enrich: boolean; error: string | null;
}

export interface StoredLead {
  id: number; name: string; domain: string; website: string; description: string | null;
  query: string | null; channels: ChannelId[]; outreach: Outreach | null; seo: SeoAudit | null;
  score: number; opportunityScore: number; issuesCount: number; hasEmail: boolean;
  scoreReasons: string[]; status: LeadStatus; notes: string | null; runId: number | null;
  createdAt: string; updatedAt: string;
}

export interface Store {
  searches: Search[];
  runs: Run[];
  leads: StoredLead[];
  nextSearchId: number;
  nextRunId: number;
  nextLeadId: number;
}

function blobOpts() {
  return {
    access: "private" as const,
    ...(process.env.BLOB_STORE_ID ? { storeId: process.env.BLOB_STORE_ID } : {}),
    ...(process.env.BLOB_READ_WRITE_TOKEN ? { token: process.env.BLOB_READ_WRITE_TOKEN } : {}),
  };
}

export function emptyStore(): Store {
  return { searches: [], runs: [], leads: [], nextSearchId: 1, nextRunId: 1, nextLeadId: 1 };
}

async function loadStore(): Promise<Store> {
  if (process.env.VERCEL) {
    try {
      const meta = await head(BLOB_PATH, blobOpts());
      const headers: Record<string, string> = {};
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        headers.authorization = `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`;
      }
      const res = await fetch(meta.downloadUrl, { headers });
      if (!res.ok) return emptyStore();
      return { ...emptyStore(), ...JSON.parse(await res.text()) };
    } catch {
      return emptyStore();
    }
  }
  try {
    fs.mkdirSync(path.dirname(LOCAL_PATH), { recursive: true });
    if (!fs.existsSync(LOCAL_PATH)) return emptyStore();
    return { ...emptyStore(), ...JSON.parse(fs.readFileSync(LOCAL_PATH, "utf8")) };
  } catch {
    return emptyStore();
  }
}

async function saveStore(store: Store): Promise<void> {
  const json = JSON.stringify(store);
  if (process.env.VERCEL) {
    await put(BLOB_PATH, json, {
      ...blobOpts(),
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return;
  }
  fs.mkdirSync(path.dirname(LOCAL_PATH), { recursive: true });
  fs.writeFileSync(LOCAL_PATH, json);
}

export async function withStore<T>(fn: (store: Store) => T | Promise<T>, persist = true): Promise<T> {
  const store = await loadStore();
  const result = await fn(store);
  if (persist) await saveStore(store);
  return result;
}

export async function withStoreRead<T>(fn: (store: Store) => T | Promise<T>): Promise<T> {
  return withStore(fn, false);
}

export function nowUtc(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}
