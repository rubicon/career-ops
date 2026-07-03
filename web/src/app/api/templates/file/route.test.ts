import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { GET, PUT } from "./route";
import { templatePath } from "@/lib/templates";

describe("/api/templates/file", () => {
  beforeEach(() => {
    fs.writeFileSync(templatePath("cv", "edit-me"), "{{NAME}}{{EXPERIENCE}}{{EDUCATION}}");
  });

  it("GET returns the body", async () => {
    const res = await GET(new Request("http://x?kind=cv&name=edit-me"));
    expect((await res.json()).content).toContain("{{NAME}}");
  });

  it("GET 404s an unknown template", async () => {
    const res = await GET(new Request("http://x?kind=cv&name=nope"));
    expect(res.status).toBe(404);
  });

  it("PUT rejects a body missing required placeholders", async () => {
    const res = await PUT(
      new Request("http://x", {
        method: "PUT",
        body: JSON.stringify({ kind: "cv", name: "edit-me", content: "{{NAME}} only" }),
      }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).missing).toContain("EXPERIENCE");
  });

  it("PUT writes a valid body", async () => {
    const next = "<h1>{{NAME}}</h1>{{EXPERIENCE}}{{EDUCATION}}";
    const res = await PUT(
      new Request("http://x", { method: "PUT", body: JSON.stringify({ kind: "cv", name: "edit-me", content: next }) }),
    );
    expect(res.status).toBe(200);
    expect(fs.readFileSync(templatePath("cv", "edit-me"), "utf8")).toBe(next);
  });
});
