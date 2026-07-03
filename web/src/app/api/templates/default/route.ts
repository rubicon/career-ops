import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { careerOpsRoot } from "@/lib/career-ops";
import { atomicWriteWithBackup } from "@/lib/core/safe-write";
import { isKind } from "@/lib/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// USER-LAYER write (DATA_CONTRACT): profile.yml holds the user's archetypes /
// narrative. We touch ONLY cv.template / cover_letter.template, preserve every
// sibling key, and write atomically with a backup, mirroring /api/profile.
const PROFILE_KEY = { cv: "cv", cover: "cover_letter" } as const;

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export async function POST(req: Request) {
  let body: { kind?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const kind = body.kind;
  const name = String(body.name || "").trim();
  if (!isKind(kind) || !name) {
    return Response.json({ error: "kind (cv|cover) and name required" }, { status: 400 });
  }
  const file = path.join(careerOpsRoot(), "config", "profile.yml");
  let doc: Record<string, unknown> = {};
  if (fs.existsSync(file)) {
    const parsed = yaml.load(fs.readFileSync(file, "utf8"));
    doc = isObj(parsed) ? parsed : {};
  }
  const section = PROFILE_KEY[kind];
  const prev = isObj(doc[section]) ? (doc[section] as Record<string, unknown>) : {};
  doc[section] = { ...prev, template: name };
  atomicWriteWithBackup(file, yaml.dump(doc, { lineWidth: 100, noRefs: true }));
  return Response.json({ ok: true });
}
