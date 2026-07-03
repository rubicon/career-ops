import { seedExploreFilters } from "@/lib/core/portals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Candidate titles for the routing pills: the user's own curated vocabulary
// (portals.yml title_filter.positive merged with profile target_roles), so the
// pill selector needs no new config.
export async function GET() {
  const { filters } = seedExploreFilters();
  const titles = Array.from(
    new Set((filters.positive ?? []).map((s) => String(s).trim()).filter(Boolean)),
  );
  return Response.json({ titles });
}
