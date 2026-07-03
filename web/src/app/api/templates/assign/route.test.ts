import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { POST } from "./route";
import { assignmentsPath } from "@/lib/templates";

const read = () => JSON.parse(fs.readFileSync(assignmentsPath(), "utf8"));

describe("POST /api/templates/assign", () => {
  it("assigns then clears a per-job template", async () => {
    const set = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ n: "042", kind: "cv", name: "growth" }) }),
    );
    expect(set.status).toBe(200);
    expect(read()["042"].cv).toBe("growth");

    await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ n: "042", kind: "cv", name: null }) }));
    expect(read()["042"]?.cv).toBeUndefined();
  });

  it("rejects a missing application number", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ kind: "cv", name: "growth" }) }));
    expect(res.status).toBe(400);
  });
});
