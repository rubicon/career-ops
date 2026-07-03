#!/usr/bin/env node
// cv-templates.mjs — discover, resolve, and validate CV / cover-letter templates.
// Single source of truth for "which template file, and is it usable?".
// Backward-compatible: with no config and no named files, resolves the base
// templates/cv-template.html (name "standard"), identical to prior behavior.

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_TEMPLATES_DIR = resolve(__dirname, 'templates');
const DEFAULT_PROFILE_PATH =
  process.env.CAREER_OPS_PROFILE || resolve(__dirname, 'config', 'profile.yml');

export const KINDS = {
  cv: {
    prefix: 'cv-template',
    profileKey: ['cv', 'template'],
    required: ['NAME', 'EXPERIENCE', 'EDUCATION'],
  },
  cover: {
    prefix: 'cover-letter-template',
    profileKey: ['cover_letter', 'template'],
    required: ['NAME', 'ROLE_TITLE', 'OPENING'],
  },
};

export function prettify(name) {
  return name
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function kebab(display) {
  return String(display)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// filename → {name, format} | null. Base "cv-template.html" → name "standard";
// "cv-template.<name>.html" → that name. Only html/tex are recognized.
function parseFilename(prefix, file) {
  const m = file.match(new RegExp(`^${prefix}(?:\\.([a-z0-9-]+))?\\.(html|tex)$`));
  if (!m) return null;
  return { name: m[1] || 'standard', format: m[2] };
}

export function parseMeta(path) {
  let text;
  try {
    text = readFileSync(path, 'utf-8');
  } catch {
    return {};
  }
  const block = text.match(/<!--\s*career-ops-template\s*([\s\S]*?)-->/);
  if (!block) return {};
  const meta = {};
  for (const line of block[1].split(/\r?\n/)) {
    const kv = line.match(/^\s*([a-zA-Z_]+)\s*:\s*(.+?)\s*$/);
    if (kv) meta[kv[1].toLowerCase()] = kv[2];
  }
  return meta;
}

export function listTemplates(kind, { dir = DEFAULT_TEMPLATES_DIR, format = 'html' } = {}) {
  const cfg = KINDS[kind];
  if (!cfg) throw new Error(`Unknown template kind: ${kind}`);
  const out = [];
  for (const file of readdirSync(dir)) {
    const parsed = parseFilename(cfg.prefix, file);
    if (!parsed || parsed.format !== format) continue;
    const path = resolve(dir, file);
    const meta = parseMeta(path);
    out.push({
      name: parsed.name,
      displayName: meta.name || prettify(parsed.name),
      path,
      format: parsed.format,
      meta,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function validateTemplate(path, kind) {
  const cfg = KINDS[kind];
  if (!cfg) throw new Error(`Unknown template kind: ${kind}`);
  const text = readFileSync(path, 'utf-8');
  const missing = cfg.required.filter((ph) => !text.includes(`{{${ph}}}`));
  return { ok: missing.length === 0, missing };
}

export function loadProfileDefault(kind, { profilePath = DEFAULT_PROFILE_PATH } = {}) {
  const cfg = KINDS[kind];
  if (!cfg) throw new Error(`Unknown template kind: ${kind}`);
  if (!existsSync(profilePath)) return null;
  let doc;
  try {
    doc = yaml.load(readFileSync(profilePath, 'utf-8')) || {};
  } catch {
    return null;
  }
  let node = doc;
  for (const key of cfg.profileKey) node = node?.[key];
  return typeof node === 'string' && node.trim() ? node.trim() : null;
}

export function resolveTemplate(kind, name, opts = {}) {
  const cfg = KINDS[kind];
  if (!cfg) throw new Error(`Unknown template kind: ${kind}`);
  const {
    dir = DEFAULT_TEMPLATES_DIR,
    format = 'html',
    profilePath = DEFAULT_PROFILE_PATH,
    fallback = false,
  } = opts;

  const explicit = Boolean(name && String(name).trim());
  let chosen = explicit ? kebab(name) : loadProfileDefault(kind, { profilePath }) || 'standard';
  const fileFor = (n) => (n === 'standard' ? `${cfg.prefix}.${format}` : `${cfg.prefix}.${n}.${format}`);

  let path = resolve(dir, fileFor(chosen));
  if (!existsSync(path)) {
    if (fallback && chosen !== 'standard') {
      chosen = 'standard';
      path = resolve(dir, fileFor(chosen));
    }
    if (!existsSync(path)) {
      throw new Error(`Template not found for kind=${kind} name=${chosen} (${fileFor(chosen)})`);
    }
  }
  if (format === 'html') {
    const v = validateTemplate(path, kind);
    if (!v.ok) {
      throw new Error(
        `Template ${fileFor(chosen)} missing required placeholders: ${v.missing.map((m) => `{{${m}}}`).join(', ')}`
      );
    }
  }
  return path;
}

// Canonical field order for the metadata header. parseMeta reads these back.
const META_ORDER = ['name', 'description', 'version', 'date', 'titles'];

export function serializeMeta(meta = {}) {
  const lines = META_ORDER.filter(
    (k) => meta[k] != null && String(meta[k]).trim() !== ''
  ).map((k) => `${k}: ${String(meta[k]).trim()}`);
  return `<!-- career-ops-template\n${lines.join('\n')}\n-->`;
}

// Write a metadata header into the file at `path`: replace an existing
// career-ops-template block, or insert one at the very top if absent. The
// body is left untouched. Symmetric with parseMeta so the header contract has
// a single reader and a single writer.
export function applyMeta(path, meta = {}) {
  const text = readFileSync(path, 'utf-8');
  const block = serializeMeta(meta);
  const re = /<!--\s*career-ops-template[\s\S]*?-->/;
  const next = re.test(text) ? text.replace(re, block) : `${block}\n${text}`;
  writeFileSync(path, next);
}

// ---- CLI ----
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const kind = argv[1];
  const flags = Object.fromEntries(
    argv.filter((a) => a.startsWith('--')).map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v ?? true];
    })
  );
  const positionals = argv.slice(2).filter((a) => !a.startsWith('--'));
  const format = flags.format || 'html';
  try {
    if (cmd === 'list') {
      const items = listTemplates(kind, { format }).map(({ name, displayName }) => ({ name, displayName }));
      process.stdout.write(JSON.stringify(items, null, 2) + '\n');
    } else if (cmd === 'resolve') {
      const name = positionals[0];
      process.stdout.write(resolveTemplate(kind, name, { format, fallback: Boolean(flags.fallback) }) + '\n');
    } else if (cmd === 'meta') {
      // node cv-templates.mjs meta <path> [--set key=value ...]
      // With no --set the call is read-only (prints the parsed header), so
      // callers can enrich a listing without rewriting files. With --set it
      // merges the pairs over the current header and writes the result.
      const path = argv[1];
      const setArgs = [];
      for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--set' && argv[i + 1] != null) setArgs.push(argv[i + 1]);
      }
      if (setArgs.length) {
        const sets = {};
        for (const pair of setArgs) {
          const [k, ...rest] = String(pair).split('=');
          sets[k] = rest.join('=');
        }
        applyMeta(path, { ...parseMeta(path), ...sets });
      }
      process.stdout.write(JSON.stringify(parseMeta(path), null, 2) + '\n');
    } else {
      process.stderr.write(
        'Usage:\n' +
          '  node cv-templates.mjs list <cv|cover> [--format=html|tex]\n' +
          '  node cv-templates.mjs resolve <cv|cover> [name] [--format=html|tex] [--fallback]\n' +
          '  node cv-templates.mjs meta <path> [--set key=value ...]\n'
      );
      process.exit(2);
    }
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
}
