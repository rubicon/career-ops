import fs from "node:fs";
import path from "node:path";
import { beforeEach } from "vitest";

// Hermetic career-ops root for route/lib tests. It lives INSIDE the checkout
// (<repo>/.vitest-tmp) so the spawned resolver CLI still walks up to the real
// node_modules for js-yaml, while every test starts from a pristine
// templates/ + config/ + data/ that mirrors a fresh install. Never touches the
// developer's real templates/ or config/.
const repoRoot = path.resolve(__dirname, "..");
const testRoot = path.join(repoRoot, ".vitest-tmp");

process.env.CAREER_OPS_ROOT = testRoot;

// Copy the resolver + selection modules once (they do not change between tests).
function seedModules() {
  fs.mkdirSync(testRoot, { recursive: true });
  for (const mod of ["cv-templates.mjs", "cv-template-select.mjs"]) {
    fs.copyFileSync(path.join(repoRoot, mod), path.join(testRoot, mod));
  }
}
seedModules();

const BASE_CV = "{{NAME}}{{EXPERIENCE}}{{EDUCATION}}";
const BASE_COVER = "{{NAME}}{{ROLE_TITLE}}{{OPENING}}";

function resetDir(rel: string) {
  const dir = path.join(testRoot, rel);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

beforeEach(() => {
  if (!fs.existsSync(path.join(testRoot, "cv-templates.mjs"))) seedModules();
  const templates = resetDir("templates");
  fs.writeFileSync(path.join(templates, "cv-template.html"), BASE_CV);
  fs.writeFileSync(path.join(templates, "cover-letter-template.html"), BASE_COVER);
  resetDir("config");
  resetDir("data");
  fs.rmSync(path.join(testRoot, "portals.yml"), { force: true });
});
