import fs from "node:fs";
import { templatePath, sampleFill, isKind } from "@/lib/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// P1 live HTML preview: fill the template with PII-free sample data and return
// HTML for an iframe/new tab. No rasterization, no real CV content.
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const kind = p.get("kind");
  const name = (p.get("name") || "standard").trim();
  if (!isKind(kind)) return Response.json({ error: "kind must be cv or cover" }, { status: 400 });
  const file = templatePath(kind, name);
  if (!fs.existsSync(file)) return Response.json({ error: "not found" }, { status: 404 });
  return new Response(sampleFill(fs.readFileSync(file, "utf8")), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
