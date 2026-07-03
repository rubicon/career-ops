import fs from "node:fs";
import { templatePath, validateContent, isKind } from "@/lib/templates";
import { atomicWriteWithBackup } from "@/lib/core/safe-write";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseKindName(url: string) {
  const p = new URL(url).searchParams;
  const kind = p.get("kind");
  const name = p.get("name");
  return isKind(kind) ? { kind, name: (name || "standard").trim() } : null;
}

export async function GET(req: Request) {
  const kn = parseKindName(req.url);
  if (!kn) return Response.json({ error: "kind must be cv or cover" }, { status: 400 });
  const file = templatePath(kn.kind, kn.name);
  if (!fs.existsSync(file)) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ content: fs.readFileSync(file, "utf8") });
}

export async function PUT(req: Request) {
  let body: { kind?: string; name?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const kind = body.kind;
  const name = String(body.name || "").trim();
  const content = body.content ?? "";
  if (!isKind(kind) || !name || content.length > 400_000) {
    return Response.json({ error: "kind, name required; content < 400KB" }, { status: 400 });
  }
  const { ok, missing } = await validateContent(kind, content);
  if (!ok) {
    return Response.json({ error: "missing required placeholders", missing }, { status: 422 });
  }
  atomicWriteWithBackup(templatePath(kind, name), content);
  return Response.json({ ok: true });
}
