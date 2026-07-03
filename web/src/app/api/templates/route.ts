import { listTemplatesWeb, isKind } from "@/lib/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
