import fs from "node:fs";
import { templatePath, runTemplateCli, isKind } from "@/lib/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Editable header fields, in the resolver's canonical order.
const FIELDS = ["name", "description", "version", "date", "titles"] as const;

export async function PATCH(req: Request) {
  let body: { kind?: string; name?: string; meta?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const kind = body.kind;
  const name = String(body.name || "").trim();
  if (!isKind(kind) || !name) return Response.json({ error: "kind, name required" }, { status: 400 });
  const file = templatePath(kind, name);
  if (!fs.existsSync(file)) return Response.json({ error: "not found" }, { status: 404 });

  const sets: string[] = [];
  for (const f of FIELDS) {
    const v = body.meta?.[f];
    if (v != null) sets.push("--set", `${f}=${String(v)}`);
  }
  try {
    // meta writes the header (via applyMeta) and prints the parsed result.
    const out = await runTemplateCli(["meta", file, ...sets]);
    return Response.json({ ok: true, meta: JSON.parse(out) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
