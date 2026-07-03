import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { POST } from "./route";
import { careerOpsRoot } from "@/lib/career-ops";

const profile = () => path.join(careerOpsRoot(), "config", "profile.yml");

describe("POST /api/templates/default", () => {
  beforeEach(() => {
    fs.mkdirSync(path.dirname(profile()), { recursive: true });
    fs.writeFileSync(profile(), "cv:\n  output_format: html\nnarrative:\n  keep: true\n");
  });

  it("sets cv.template and preserves other keys", async () => {
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ kind: "cv", name: "executive-authority" }) }),
    );
    expect(res.status).toBe(200);
    const doc = yaml.load(fs.readFileSync(profile(), "utf8")) as {
      cv: { template: string; output_format: string };
      narrative: { keep: boolean };
    };
    expect(doc.cv.template).toBe("executive-authority");
    expect(doc.cv.output_format).toBe("html");
    expect(doc.narrative.keep).toBe(true);
  });

  it("rejects an unknown kind", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ kind: "bogus", name: "x" }) }));
    expect(res.status).toBe(400);
  });
});
