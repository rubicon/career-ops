import { templatePath, validateContent, kebabName, isKind } from "@/lib/templates";
import { atomicWriteWithBackup } from "@/lib/core/safe-write";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(req.headers.get("content-type") || "").includes("multipart/form-data")) {
    return Response.json({ error: "multipart required" }, { status: 400 });
  }
  const form = await req.formData();
  const kind = form.get("kind");
  const rawName = String(form.get("name") || "");
  const file = form.get("file");
  if (!isKind(kind) || !(file instanceof File) || !rawName.trim()) {
    return Response.json({ error: "kind, name, file required" }, { status: 400 });
  }
  const name = kebabName(rawName);
  if (!name || name === "standard") {
    return Response.json({ error: "reserved or empty name" }, { status: 400 });
  }
  const content = Buffer.from(await file.arrayBuffer()).toString("utf8");
  if (content.length > 400_000) {
    return Response.json({ error: "content < 400KB" }, { status: 400 });
  }
  const { ok, missing } = await validateContent(kind, content);
  if (!ok) {
    return Response.json({ error: "missing required placeholders", missing }, { status: 422 });
  }
  atomicWriteWithBackup(templatePath(kind, name), content);
  return Response.json({ ok: true, name });
}
