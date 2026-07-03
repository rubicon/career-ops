import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { GET } from "./route";
import { careerOpsRoot } from "@/lib/career-ops";

describe("GET /api/templates/titles", () => {
  it("returns an array of candidate titles", async () => {
    const res = await GET();
    const body = await res.json();
    expect(Array.isArray(body.titles)).toBe(true);
  });

  it("surfaces positive title filters from portals.yml", async () => {
    fs.writeFileSync(
      path.join(careerOpsRoot(), "portals.yml"),
      "title_filter:\n  positive:\n    - CMO\n    - VP Marketing\n",
    );
    const res = await GET();
    const body = await res.json();
    expect(body.titles).toContain("CMO");
    expect(body.titles).toContain("VP Marketing");
  });
});
