import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { careerOpsRoot, rootScript } from "@/lib/career-ops";

// Server-side glue for the template admin. Reads/validates go through the Phase
// A resolver (cv-templates.mjs) via a spawned CLI so Next never bundles the
// out-of-tree ESM module; the script path is assembled with rootScript() (never
// a literal ".mjs" string, which Next's bundler would try to trace as an import).

export type TemplateKind = "cv" | "cover";

export type TemplateDto = {
  name: string;
  displayName: string;
  description?: string;
  version?: string;
  date?: string;
  titles: string[];
  isDefault: boolean;
  format: "html";
};

const PREFIX: Record<TemplateKind, string> = {
  cv: "cv-template",
  cover: "cover-letter-template",
};

export function isKind(v: unknown): v is TemplateKind {
  return v === "cv" || v === "cover";
}

/** Display name to kebab, matching the resolver's kebab() so names round-trip. */
export function kebabName(display: string): string {
  return String(display)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Absolute path to a template file. Base ("standard") drops the name segment. */
export function templatePath(kind: TemplateKind, name: string): string {
  const base = name === "standard" ? `${PREFIX[kind]}.html` : `${PREFIX[kind]}.${name}.html`;
  return path.join(careerOpsRoot(), "templates", base);
}

/** Spawn `node cv-templates.mjs <args>` in the project root; resolve stdout. */
export function runTemplateCli(args: string[]): Promise<string> {
  const root = careerOpsRoot();
  const script = rootScript("cv-templates");
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [script, ...args], { cwd: root });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(err.trim() || `exit ${code}`))));
    p.on("error", reject);
  });
}

function safeJson(s: string): Record<string, string> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

export type ValidationResult = { ok: boolean; missing: string[] };

/**
 * Validate template content for its kind through the resolver's `validate` CLI
 * (single source of truth for the required-placeholder lists). The content is
 * written to a temp sibling in templates/ so unsaved edits/uploads can be
 * checked before install; the temp file never matches the discovery glob.
 */
export async function validateContent(kind: TemplateKind, content: string): Promise<ValidationResult> {
  const dir = path.join(careerOpsRoot(), "templates");
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.validate-${process.pid}-${randomUUID()}.tmp`);
  fs.writeFileSync(tmp, content, "utf8");
  try {
    const out = await runTemplateCli(["validate", kind, tmp]);
    const parsed = JSON.parse(out) as ValidationResult;
    return { ok: Boolean(parsed.ok), missing: Array.isArray(parsed.missing) ? parsed.missing : [] };
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

// The current default template name, derived from `resolve <kind>` (no explicit
// name → profile default → standard). Fail-soft: a broken/missing default just
// yields "standard" so the listing still renders.
async function defaultTemplateName(kind: TemplateKind): Promise<string> {
  const def = (await runTemplateCli(["resolve", kind]).catch(() => "")).trim();
  if (!def) return "standard";
  const base = path.basename(def).replace(/\.(html|tex)$/, "");
  const name = base.replace(/^(cv|cover-letter)-template\.?/, "");
  return name || "standard";
}

/**
 * List templates for the grid: names + display from the resolver, enriched with
 * the metadata header (read-only `meta <path>`, which never validates so invalid
 * templates still list), and an isDefault flag from the resolved default.
 */
export async function listTemplatesWeb(kind: TemplateKind): Promise<TemplateDto[]> {
  if (!isKind(kind)) throw new Error("bad kind");
  const listed = JSON.parse(await runTemplateCli(["list", kind])) as Array<{
    name: string;
    displayName: string;
  }>;
  const defaultName = await defaultTemplateName(kind);
  const out: TemplateDto[] = [];
  for (const t of listed) {
    const meta = safeJson(await runTemplateCli(["meta", templatePath(kind, t.name)]).catch(() => "{}"));
    out.push({
      name: t.name,
      displayName: t.displayName,
      description: meta.description,
      version: meta.version,
      date: meta.date,
      titles: meta.titles
        ? String(meta.titles)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      isDefault: t.name === defaultName,
      format: "html",
    });
  }
  return out;
}
