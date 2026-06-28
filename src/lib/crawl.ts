import { spawn } from "child_process";
import path from "path";

// Shared utilities for calling the Python crawl4ai and DDGS scripts.

const CRAWL_SCRIPT = path.join(process.cwd(), "scripts", "crawl.py");
const SEARCH_SCRIPT = path.join(process.cwd(), "scripts", "search.py");

export interface CrawlResult {
  success: boolean;
  error?: string;
  statusCode?: number;
  markdown?: string;
  metadata?: Record<string, unknown>;
  links?: { internal: string[]; external: string[] };
}

export interface SearchResult {
  url: string;
  title: string;
  description: string;
}

function run(script: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn("python3", [script, ...args]);
    let out = "";
    proc.stdout.on("data", (d) => (out += d));
    proc.on("close", () => resolve(out.trim()));
  });
}

export async function crawlUrl(url: string): Promise<CrawlResult> {
  const raw = await run(CRAWL_SCRIPT, [url]);
  try {
    return JSON.parse(raw);
  } catch {
    return { success: false, error: "No output from crawler" };
  }
}

export async function searchWeb(query: string, limit = 20): Promise<SearchResult[]> {
  const raw = await run(SEARCH_SCRIPT, [query, String(limit)]);
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
