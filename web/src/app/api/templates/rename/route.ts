import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { templatePath, kebabName, isKind } from "@/lib/templates";
import { careerOpsRoot } from "@/lib/career-ops";
import { atomicWriteWithBackup, backup } from "@/lib/core/safe-write";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROFILE_KEY = { cv: "cv", cover: "cover_letter" } as const;

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export async function POST(req: Request) {
  let body: { kind?: string; from?: string; to?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const kind = body.kind;
  const from = String(body.from || "").trim();
  const to = kebabName(String(body.to || ""));
  if (!isKind(kind) || !from || !to) return Response.json({ error: "kind, from, to required" }, { status: 400 });
  if (from === "standard" || to === "standard") {
    return Response.json({ error: "cannot rename the base template" }, { status: 400 });
  }
  const src = templatePath(kind, from);
  const dst = templatePath(kind, to);
  if (!fs.existsSync(src)) return Response.json({ error: "source not found" }, { status: 404 });
  if (fs.existsSync(dst)) return Response.json({ error: "target exists" }, { status: 409 });

  const content = fs.readFileSync(src, "utf8");
  atomicWriteWithBackup(dst, content);
  backup(src);
  fs.rmSync(src);

  // If it was the profile default, follow the rename.
  const profile = path.join(careerOpsRoot(), "config", "profile.yml");
  if (fs.existsSync(profile)) {
    const doc = yaml.load(fs.readFileSync(profile, "utf8"));
    const sec = PROFILE_KEY[kind];
    if (isObj(doc) && isObj(doc[sec]) && (doc[sec] as Record<string, unknown>).template === from) {
      (doc[sec] as Record<string, unknown>).template = to;
      atomicWriteWithBackup(profile, yaml.dump(doc, { lineWidth: 100, noRefs: true }));
    }
  }
  return Response.json({ ok: true, name: to });
}
