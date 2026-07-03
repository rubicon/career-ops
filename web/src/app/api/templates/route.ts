import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { listTemplatesWeb, templatePath, isKind } from "@/lib/templates";
import { careerOpsRoot } from "@/lib/career-ops";
import { atomicWriteWithBackup, backup } from "@/lib/core/safe-write";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROFILE_KEY = { cv: "cv", cover: "cover_letter" } as const;

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export async function GET(req: Request) {
  const kind = new URL(req.url).searchParams.get("kind");
  if (!isKind(kind)) {
    return Response.json({ error: "kind must be cv or cover" }, { status: 400 });
  }
  try {
    const templates = await listTemplatesWeb(kind);
    return Response.json({ templates });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  let body: { kind?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const kind = body.kind;
  const name = String(body.name || "").trim();
  if (!isKind(kind) || !name) return Response.json({ error: "kind, name required" }, { status: 400 });
  if (name === "standard") return Response.json({ error: "cannot delete the base template" }, { status: 400 });
  const file = templatePath(kind, name);
  if (!fs.existsSync(file)) return Response.json({ error: "not found" }, { status: 404 });
  backup(file);
  fs.rmSync(file);

  // Clear the profile default if the deleted template was it.
  const profile = path.join(careerOpsRoot(), "config", "profile.yml");
  if (fs.existsSync(profile)) {
    const doc = yaml.load(fs.readFileSync(profile, "utf8"));
    const sec = PROFILE_KEY[kind];
    if (isObj(doc) && isObj(doc[sec]) && (doc[sec] as Record<string, unknown>).template === name) {
      delete (doc[sec] as Record<string, unknown>).template;
      atomicWriteWithBackup(profile, yaml.dump(doc, { lineWidth: 100, noRefs: true }));
    }
  }
  return Response.json({ ok: true });
}
