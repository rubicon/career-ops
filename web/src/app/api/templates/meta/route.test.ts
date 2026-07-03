import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { PATCH } from "./route";
import { templatePath } from "@/lib/templates";

describe("PATCH /api/templates/meta", () => {
  beforeEach(() => fs.writeFileSync(templatePath("cv", "meta-me"), "{{NAME}}{{EXPERIENCE}}{{EDUCATION}}"));

  it("writes the header and returns parsed meta", async () => {
    const res = await PATCH(
      new Request("http://x", {
        method: "PATCH",
        body: JSON.stringify({ kind: "cv", name: "meta-me", meta: { name: "Meta Me", titles: "CMO, VP Marketing" } }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.name).toBe("Meta Me");
    expect(body.meta.titles).toBe("CMO, VP Marketing");
    expect(fs.readFileSync(templatePath("cv", "meta-me"), "utf8")).toContain("career-ops-template");
  });

  it("rejects an unknown kind", async () => {
    const res = await PATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ kind: "bogus", name: "x", meta: {} }) }),
    );
    expect(res.status).toBe(400);
  });
});
