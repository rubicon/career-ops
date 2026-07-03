#!/usr/bin/env node

/**
 * generate-docx.mjs — cv.md → Word (.docx) via the `docx` package
 *
 * Usage:
 *   node generate-docx.mjs <input.md> <output.docx> [--format=letter|a4]
 *
 * Reads a Markdown CV (cv.md is the canonical source of truth) and renders a
 * single, clean, ATS-friendly Word document. The exporter is generic: it has no
 * theme, color, or personal content baked in — styling is limited to Word-safe
 * fonts and neutral structure so the same script works for any user's cv.md.
 *
 * Heading hierarchy is honored:
 *   ## Section        → a CV section (Summary, Experience, Education, Skills, ...)
 *   ### Company        → a role / company entry within a section
 *   #### Sub-role      → a nested sub-role beneath its parent ### company/umbrella
 *
 * The #### level exists so fractional, interim, or umbrella engagements (several
 * client engagements under one advisory/consulting company) render as nested
 * sub-roles under the parent, instead of being flattened into separate jobs.
 * See modes/docx.md and the CV-authoring notes in README.md.
 *
 * Requires: the `docx` npm package (added as a dependency).
 * Mirrors generate-pdf.mjs / generate-latex.mjs for CLI shape and output path.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Tab,
  AlignmentType,
  TabStopType,
  LevelFormat,
  BorderStyle,
  PageOrientation,
} from 'docx';
import { resolve, dirname, relative, isAbsolute } from 'path';
import { readFile, writeFile } from 'fs/promises';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Geometry (twips: 1/1440in) and type sizes (half-points) ---------------
// US Letter and A4 in twips. Every section repeats page.size explicitly so the
// docx default (A4) never sneaks in and forces a spurious page break.
const PAGE_SIZE = {
  letter: { width: 12240, height: 15840 }, // 8.5 x 11 in
  a4: { width: 11906, height: 16838 },      // 210 x 297 mm
};
const MARGIN = 1080; // 0.75in on all sides

const FONT = 'Calibri'; // Word-safe on every Word / LibreOffice / Google Docs install.

const SZ = {
  name: 32,     // 16pt
  contact: 20,  // 10pt
  section: 24,  // 12pt
  company: 22,  // 11pt
  role: 21,     // 10.5pt
  subrole: 21,  // 10.5pt
  date: 20,     // 10pt
  body: 21,     // 10.5pt
};

const BULLET_REF = 'cv-bullets';

// --- Markdown → structured CV ----------------------------------------------

/**
 * Strip a leading "CV" / "Resume" / "Curriculum Vitae" label from the H1 so the
 * document title is the person's name, not "CV -- Name".
 *
 * @param {string} text - Raw H1 text.
 * @returns {string} The name with any leading document-type label removed.
 */
function stripNameLabel(text) {
  return text.replace(/^\s*(cv|resume|résumé|curriculum vitae)\s*[-–—:]+\s*/i, '').trim();
}

const DATE_RE = /\b(19|20)\d{2}\b|present|current|ongoing|now\b/i;
const BOLD_LINE_RE = /^\*\*(.+)\*\*$/;
const BULLET_RE = /^[-*]\s+(.*)$/;

/**
 * Detect whether a plain (non-heading, non-bullet) line reads as a date range
 * rather than prose. Used to route the line under a role/company or sub-role to
 * its right-flushed date slot.
 *
 * @param {string} line - Trimmed line text.
 * @returns {boolean} True when the line looks like a date / date range.
 */
function looksLikeDate(line) {
  if (line.length > 40) return false; // dates are short; prose is not
  return DATE_RE.test(line);
}

/**
 * Parse a Markdown CV into an ordered structure that preserves the heading
 * hierarchy (## sections, ### company/role entries, #### nested sub-roles).
 *
 * The parser is deliberately format-tolerant: role titles may be a bold line
 * under the heading, dates are a short line that looks like a date range, and
 * bullets attach to the nearest open sub-role, else the open entry, else the
 * section itself (as happens in Projects / Education / Skills lists).
 *
 * @param {string} markdown - Contents of a cv.md-style Markdown file.
 * @returns {{name: string, contact: string[], sections: Array}} Structured CV.
 */
export function parseCvMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);

  const cv = { name: '', contact: [], sections: [] };
  let section = null;   // current ## section
  let entry = null;     // current ### company/role entry
  let subrole = null;   // current #### sub-role
  let seenSection = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const h1 = line.match(/^#\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    const h3 = line.match(/^###\s+(.*)$/);
    const h4 = line.match(/^####\s+(.*)$/);

    if (h4) {
      // Nested sub-role under the current entry. If there is no open entry
      // (a #### with no preceding ###), promote it to an entry so nothing is
      // dropped.
      const title = stripInlineMarkdown(h4[1]);
      if (!section) continue;
      if (!entry) {
        entry = { company: title, role: null, date: null, bullets: [], subroles: [] };
        section.blocks.push({ type: 'entry', ...entry });
        entry = section.blocks[section.blocks.length - 1];
        subrole = null;
        continue;
      }
      subrole = { type: 'subrole', title, date: null, bullets: [] };
      entry.subroles.push(subrole);
      continue;
    }

    if (h3) {
      if (!section) continue;
      entry = { type: 'entry', company: stripInlineMarkdown(h3[1]), role: null, date: null, bullets: [], subroles: [] };
      section.blocks.push(entry);
      subrole = null;
      continue;
    }

    if (h2) {
      seenSection = true;
      section = { title: stripInlineMarkdown(h2[1]), blocks: [] };
      cv.sections.push(section);
      entry = null;
      subrole = null;
      continue;
    }

    if (h1) {
      cv.name = stripNameLabel(h1[1]);
      continue;
    }

    // Before the first ## heading, plain / bold lines are the contact block.
    if (!seenSection) {
      // "**Label:** value" → keep the value; a bare line → keep as-is.
      const labelled = line.match(/^\*\*([^*]+):\*\*\s*(.*)$/);
      const value = labelled ? labelled[2].trim() : stripInlineMarkdown(line);
      if (value) cv.contact.push(value);
      continue;
    }

    const bullet = line.match(BULLET_RE);
    if (bullet) {
      const text = bullet[1].trim();
      if (subrole) subrole.bullets.push(text);
      else if (entry) entry.bullets.push(text);
      else section.blocks.push({ type: 'bullet', text });
      continue;
    }

    // A fully-bold line right under a heading is the role/title.
    const bold = line.match(BOLD_LINE_RE);
    if (bold) {
      const text = bold[1].trim();
      if (subrole && !subrole.role) { subrole.role = text; continue; }
      if (entry && !entry.role) { entry.role = text; continue; }
      // Otherwise it is emphasised prose — fall through to a paragraph.
    }

    if (looksLikeDate(line)) {
      if (subrole && !subrole.date) { subrole.date = line; continue; }
      if (entry && !entry.date) { entry.date = line; continue; }
    }

    // Anything else is prose. Under a section with no open entry it is a
    // paragraph (e.g. the Professional Summary); otherwise attach to the entry.
    const text = stripInlineMarkdown(line);
    if (subrole) subrole.bullets.push(text);
    else if (entry) entry.bullets.push(text);
    else section.blocks.push({ type: 'paragraph', text });
  }

  return cv;
}

/**
 * Reduce inline Markdown to plain text for heading / date contexts where mixed
 * runs are not rendered (links → their label, code / emphasis markers dropped).
 *
 * @param {string} text - Inline Markdown.
 * @returns {string} Plain text.
 */
function stripInlineMarkdown(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // [label](url) → label
    .replace(/\*\*([^*]+)\*\*/g, '$1')       // **bold** → bold
    .replace(/\*([^*]+)\*/g, '$1')           // *italic* → italic
    .replace(/`([^`]+)`/g, '$1')             // `code` → code
    .trim();
}

/**
 * Tokenize inline Markdown into docx TextRuns, preserving **bold** spans and
 * flattening the rest. Keeps a professional touch (e.g. "Languages:" bold in a
 * skills line) without pulling in a full Markdown renderer.
 *
 * @param {string} text - Inline Markdown.
 * @param {{size?: number, italics?: boolean}} [opts] - Run defaults.
 * @returns {TextRun[]} Runs ready to place in a Paragraph.
 */
function inlineRuns(text, opts = {}) {
  const size = opts.size ?? SZ.body;
  const runs = [];
  // Split on **bold** while dropping link/italic/code syntax around it.
  const cleaned = text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1$2'); // strip single-* italics
  const parts = cleaned.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (!part) continue;
    const b = part.match(/^\*\*([^*]+)\*\*$/);
    if (b) runs.push(new TextRun({ text: b[1], bold: true, size, italics: opts.italics }));
    else runs.push(new TextRun({ text: part, size, italics: opts.italics }));
  }
  if (runs.length === 0) runs.push(new TextRun({ text: '', size }));
  return runs;
}

// --- Structured CV → docx paragraphs ---------------------------------------

/**
 * Build a role/company or sub-role heading line with the title on the left and
 * an optional date flushed right via a right tab stop.
 *
 * @param {string} styleId - Paragraph style id (Company or SubRole).
 * @param {string} title - Left-aligned title text.
 * @param {string|null} date - Optional right-flushed date.
 * @param {number} size - Run size in half-points.
 * @returns {Paragraph} The heading paragraph.
 */
function headingLine(styleId, title, date, size) {
  const children = [new TextRun({ text: title, bold: true, size })];
  if (date) {
    // A real <w:tab/> element (not a literal "\t") advances to the paragraph's
    // right tab stop reliably across Word, LibreOffice, and Google Docs.
    children.push(new TextRun({ children: [new Tab(), date], size: SZ.date }));
  }
  return new Paragraph({ style: styleId, children });
}

/**
 * Render one bullet as a numbered (Word-native) list paragraph at the given
 * level. Level 1 sits under a sub-role, giving nested engagements a visible
 * deeper indent.
 *
 * @param {string} text - Bullet text (inline Markdown allowed).
 * @param {0|1} level - Numbering level.
 * @returns {Paragraph} The bullet paragraph.
 */
function bulletParagraph(text, level) {
  return new Paragraph({
    style: 'Bullet',
    numbering: { reference: BULLET_REF, level },
    children: inlineRuns(text),
  });
}

/**
 * Convert a parsed CV structure into the ordered list of docx paragraphs.
 *
 * @param {ReturnType<typeof parseCvMarkdown>} cv - Parsed CV.
 * @returns {Paragraph[]} Document body paragraphs in source order.
 */
function renderParagraphs(cv) {
  const out = [];

  if (cv.name) {
    out.push(new Paragraph({ style: 'Name', children: [new TextRun({ text: cv.name })] }));
  }
  if (cv.contact.length) {
    out.push(new Paragraph({
      style: 'Contact',
      children: [new TextRun({ text: cv.contact.join('  |  '), size: SZ.contact })],
    }));
  }

  for (const section of cv.sections) {
    out.push(new Paragraph({ style: 'SectionHeader', children: [new TextRun({ text: section.title.toUpperCase() })] }));

    for (const block of section.blocks) {
      if (block.type === 'paragraph') {
        out.push(new Paragraph({ style: 'Body', children: inlineRuns(block.text) }));
      } else if (block.type === 'bullet') {
        out.push(bulletParagraph(block.text, 0));
      } else if (block.type === 'entry') {
        out.push(headingLine('Company', block.company, block.date, SZ.company));
        if (block.role) {
          out.push(new Paragraph({ style: 'Role', children: [new TextRun({ text: block.role, italics: true, size: SZ.role })] }));
        }
        for (const b of block.bullets) out.push(bulletParagraph(b, 0));
        for (const sr of block.subroles) {
          const title = sr.role ? `${sr.title} — ${sr.role}` : sr.title;
          out.push(headingLine('SubRole', title, sr.date, SZ.subrole));
          for (const b of sr.bullets) out.push(bulletParagraph(b, 1));
        }
      }
    }
  }

  return out;
}

// --- Document assembly ------------------------------------------------------

/**
 * Named paragraph styles. Generic and theme-free: Word-safe font, black text,
 * a neutral rule under section headers, and keep-together flags so headings do
 * not strand at page breaks.
 */
function paragraphStyles() {
  const keep = { keepNext: true, keepLines: true };
  const contentW = 12240 - MARGIN * 2; // right tab column for the widest page (letter); A4 is narrower and still lands inside.
  return [
    { id: 'Name', name: 'Name', run: { font: FONT, size: SZ.name, bold: true },
      paragraph: { spacing: { after: 40 } } },
    { id: 'Contact', name: 'Contact', run: { font: FONT, size: SZ.contact },
      paragraph: { spacing: { after: 200 } } },
    { id: 'SectionHeader', name: 'Section Header', run: { font: FONT, size: SZ.section, bold: true },
      paragraph: {
        spacing: { before: 220, after: 80 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 2, color: '000000' } },
        ...keep,
      } },
    { id: 'Company', name: 'Company', run: { font: FONT, size: SZ.company, bold: true },
      paragraph: {
        spacing: { before: 160, after: 20 },
        tabStops: [{ type: TabStopType.RIGHT, position: contentW }],
        ...keep,
      } },
    { id: 'Role', name: 'Role', run: { font: FONT, size: SZ.role, italics: true },
      paragraph: { spacing: { after: 40 }, ...keep } },
    { id: 'SubRole', name: 'Sub Role', run: { font: FONT, size: SZ.subrole, bold: true },
      paragraph: {
        spacing: { before: 100, after: 20 },
        indent: { left: 360 },
        tabStops: [{ type: TabStopType.RIGHT, position: contentW }],
        ...keep,
      } },
    { id: 'Body', name: 'Body', run: { font: FONT, size: SZ.body },
      paragraph: { spacing: { after: 80 } } },
    { id: 'Bullet', name: 'Bullet', run: { font: FONT, size: SZ.body },
      paragraph: { spacing: { after: 40 }, keepLines: true } },
  ];
}

const NUMBERING = {
  config: [
    {
      reference: BULLET_REF,
      levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 600, hanging: 280 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1080, hanging: 280 } } } },
      ],
    },
  ],
};

/**
 * Build the docx Document object from a Markdown CV string.
 *
 * @param {string} markdown - cv.md-style Markdown.
 * @param {{format?: 'letter'|'a4'}} [opts] - Page format (default a4, mirroring generate-pdf.mjs).
 * @returns {Document} An in-memory docx Document ready for Packer.
 */
export function buildCvDocument(markdown, opts = {}) {
  const format = (opts.format || 'a4').toLowerCase();
  const size = PAGE_SIZE[format] || PAGE_SIZE.a4;
  const cv = parseCvMarkdown(markdown);

  return new Document({
    creator: 'career-ops',
    title: cv.name ? `${cv.name} CV` : 'CV',
    styles: {
      default: { document: { run: { font: FONT, size: SZ.body } } },
      paragraphStyles: paragraphStyles(),
    },
    numbering: NUMBERING,
    sections: [
      {
        properties: {
          page: {
            size: { width: size.width, height: size.height, orientation: PageOrientation.PORTRAIT },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
          },
        },
        children: renderParagraphs(cv),
      },
    ],
  });
}

/**
 * Build the .docx as a Buffer (convenience for tests and programmatic callers).
 *
 * @param {string} markdown - cv.md-style Markdown.
 * @param {{format?: 'letter'|'a4'}} [opts] - Page format.
 * @returns {Promise<Buffer>} The .docx file bytes.
 */
export async function buildCvDocxBuffer(markdown, opts = {}) {
  return Packer.toBuffer(buildCvDocument(markdown, opts));
}

// --- CLI --------------------------------------------------------------------

/**
 * CLI entrypoint: read a Markdown CV, render the .docx, write it, and report.
 *
 * @returns {Promise<{outputPath: string, size: number}>}
 */
async function main() {
  const args = process.argv.slice(2);
  let inputPath, outputPath, format = 'a4';

  for (const arg of args) {
    if (arg.startsWith('--format=')) format = arg.split('=')[1].toLowerCase();
    else if (!inputPath) inputPath = arg;
    else if (!outputPath) outputPath = arg;
  }

  if (!inputPath || !outputPath) {
    console.error('Usage: node generate-docx.mjs <input.md> <output.docx> [--format=letter|a4]');
    process.exit(1);
  }

  const validFormats = ['a4', 'letter'];
  if (!validFormats.includes(format)) {
    console.error(`Invalid format "${format}". Use: ${validFormats.join(', ')}`);
    process.exit(1);
  }

  inputPath = resolve(inputPath);
  outputPath = resolve(outputPath);

  // Path-traversal guard: keep the .docx write inside the project directory so a
  // crafted output argument (e.g. "../../etc/cron.d/x") cannot escape the repo.
  const relOut = relative(process.cwd(), outputPath);
  if (relOut === '' || relOut.startsWith('..') || isAbsolute(relOut)) {
    console.error(`Refusing to write the .docx outside the project directory: ${outputPath}`);
    process.exit(1);
  }

  console.log(`📄 Input:  ${inputPath}`);
  console.log(`📁 Output: ${outputPath}`);
  console.log(`📏 Format: ${format.toUpperCase()}`);

  const markdown = await readFile(inputPath, 'utf-8');
  const buffer = await buildCvDocxBuffer(markdown, { format });

  mkdirSync(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buffer);

  console.log(`✅ DOCX generated: ${outputPath}`);
  console.log(`📦 Size: ${(buffer.length / 1024).toFixed(1)} KB`);
  return { outputPath, size: buffer.length };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error('❌ DOCX generation failed:', err.message);
    process.exit(1);
  });
}
