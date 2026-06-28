import { spawn } from "child_process";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (!url || typeof url !== "string") {
    return NextResponse.json({ success: false, error: "Missing url" }, { status: 400 });
  }

  const scriptPath = path.join(process.cwd(), "scripts", "crawl.py");

  const result = await new Promise<string>((resolve, reject) => {
    const proc = spawn("python3", [scriptPath, url]);
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => (out += d));
    proc.stderr.on("data", (d) => (err += d));
    proc.on("close", (code) => {
      if (out) resolve(out.trim());
      else reject(new Error(err || `Process exited with code ${code}`));
    });
  }).catch((e) => JSON.stringify({ success: false, error: String(e) }));

  try {
    const data = JSON.parse(result);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ success: false, error: "Failed to parse scraper output" }, { status: 500 });
  }
}
