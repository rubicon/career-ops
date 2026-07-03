import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { GET } from "./route";
import { templatePath } from "@/lib/templates";

describe("GET /api/templates/preview", () => {
  beforeEach(() => fs.writeFileSync(templatePath("cv", "prev"), "<h1>{{NAME}}</h1>{{EXPERIENCE}}{{EDUCATION}}"));

  it("returns HTML with placeholders filled by sample data", async () => {
    const res = await GET(new Request("http://x?kind=cv&name=prev"));
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).not.toContain("{{NAME}}");
    expect(html).toContain("Jordan Sample");
  });

  it("404s an unknown template", async () => {
    const res = await GET(new Request("http://x?kind=cv&name=missing"));
    expect(res.status).toBe(404);
  });
});
