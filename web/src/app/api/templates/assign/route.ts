import { assignmentsPath, readAssignments, isKind } from "@/lib/templates";
import { atomicWriteWithBackup } from "@/lib/core/safe-write";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-job template assignment. Keyed by application number so it survives report
// renumbering and stays out of the strict tracker contract (spec Decision #1).
export async function POST(req: Request) {
  let body: { n?: string; kind?: string; name?: string | null };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const n = String(body.n || "").trim();
  const kind = body.kind;
  if (!n || !isKind(kind)) return Response.json({ error: "n and kind (cv|cover) required" }, { status: 400 });

  const map = readAssignments();
  const entry = map[n] ?? {};
  const name = body.name == null ? "" : String(body.name).trim();
  if (!name) delete entry[kind];
  else entry[kind] = name;
  if (Object.keys(entry).length) map[n] = entry;
  else delete map[n];
  atomicWriteWithBackup(assignmentsPath(), JSON.stringify(map, null, 2));
  return Response.json({ ok: true });
}
