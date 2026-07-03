#!/usr/bin/env node
// cv-template-select.mjs — decide WHICH template name applies to a given job.
// Thin policy layer over cv-templates.mjs; the file resolution + validation
// still happens in resolveTemplate(). Reused by the web app and batch/pipeline.

import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { listTemplates, loadProfileDefault } from './cv-templates.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ASSIGNMENTS =
  process.env.CAREER_OPS_ASSIGNMENTS || resolve(__dirname, 'data', 'template-assignments.json');

function tokens(s) {
  return String(s || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2); // drop short noise ("of", "vp"); overlap threshold handles the rest
}

// Best template name whose `titles` header is essentially contained in the job
// title (case-insensitive token overlap), else null. A candidate title wins
// only when all of its significant tokens appear in the job title, so a short
// generic title cannot outrank a more specific match.
export function routeByTitle(kind, jobTitle, { dir } = {}) {
  const want = new Set(tokens(jobTitle));
  if (!want.size) return null;
  let best = null;
  let bestScore = 0;
  for (const t of listTemplates(kind, dir ? { dir } : {})) {
    const titles = t.meta?.titles;
    if (!titles) continue;
    for (const cand of String(titles).split(',')) {
      const have = tokens(cand);
      const overlap = have.filter((h) => want.has(h)).length;
      if (have.length && overlap === have.length && overlap > bestScore) {
        bestScore = overlap;
        best = t.name;
      }
    }
  }
  return best;
}

// The per-job assigned name from the sidecar map, or null.
export function readAssignment(n, kind, { assignmentsPath = DEFAULT_ASSIGNMENTS } = {}) {
  if (n == null || !existsSync(assignmentsPath)) return null;
  let map;
  try {
    map = JSON.parse(readFileSync(assignmentsPath, 'utf-8')) || {};
  } catch {
    return null;
  }
  const entry = map[String(n)];
  const name = entry && entry[kind];
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

// Effective-selection precedence, highest first:
//   explicit pick > per-job assignment > title route > profile default > 'standard'.
export function selectTemplateName(kind, opts = {}) {
  const { n, jobTitle, pick, dir, profilePath, assignmentsPath } = opts;
  if (pick && String(pick).trim()) return String(pick).trim();
  const assigned = readAssignment(n, kind, assignmentsPath ? { assignmentsPath } : {});
  if (assigned) return assigned;
  const routed = routeByTitle(kind, jobTitle, dir ? { dir } : {});
  if (routed) return routed;
  const def = loadProfileDefault(kind, profilePath ? { profilePath } : {});
  return def || 'standard';
}

// ---- CLI ----
// node cv-template-select.mjs <cv|cover> [--n=NUM] [--title="..."] [--pick=name]
// Prints the effective template name (never throws — always yields at least
// "standard"), so the web/batch can inject the NAME into the agent prompt.
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [kind, ...rest] = process.argv.slice(2);
  const flags = Object.fromEntries(
    rest
      .filter((a) => a.startsWith('--'))
      .map((a) => {
        const [k, v] = a.replace(/^--/, '').split('=');
        return [k, v ?? true];
      })
  );
  const str = (v) => (typeof v === 'string' ? v : undefined);
  process.stdout.write(
    selectTemplateName(kind, { n: str(flags.n), jobTitle: str(flags.title), pick: str(flags.pick) }) + '\n'
  );
}
