# Mode: docx — Word (.docx) CV Export

Export a tailored, ATS-friendly CV as a Microsoft Word `.docx` file, generated directly from `cv.md`. This is the third output format alongside `pdf` (HTML → PDF) and `latex` (LaTeX/Overleaf → PDF).

Use `docx` when the user wants an editable Word document — some employers and application portals ask for `.docx` specifically, and recruiters often want to make light edits before forwarding.

## Pipeline

1. Read `cv.md` as the source of truth
2. Read `config/profile.yml` for candidate identity and contact info
3. Ask the user for the JD if not already in context (text or URL)
4. Extract 15-20 keywords from the JD
5. Detect JD language → CV language (EN default)
6. Detect company location → paper format: US/Canada → `letter`, rest of the world → `a4`
7. Detect role archetype → adapt framing
8. Rewrite Professional Summary injecting JD keywords (same rules as `pdf` mode — NEVER invent skills)
9. Select the top 3-4 most relevant projects for the offer
10. Reorder experience bullets by JD relevance
11. Inject keywords naturally into existing achievements
12. Write the tailored CV to a Markdown file (a tailored copy of `cv.md`), e.g. `output/cv-{candidate}-{company}.md`
13. Run: `node generate-docx.mjs output/cv-{candidate}-{company}.md output/cv-{candidate}-{company}-{YYYY-MM-DD}.docx --format={letter|a4}`
    *(Replace `{candidate}`, `{company}`, `{YYYY-MM-DD}` with actual values.)*
14. Report: `.docx` path, file size, page format

**Requires:** the `docx` npm package (a project dependency — installed with `npm install`). No external toolchain, unlike `latex` (which needs a TeX engine) or `pdf` (which needs Playwright/Chromium).

## Heading hierarchy (the fractional / interim / umbrella convention)

`generate-docx.mjs` parses the Markdown hierarchy generically and renders it faithfully:

| Markdown | Renders as |
|----------|------------|
| `## Section` | A CV section (Professional Summary, Experience, Education, Skills, ...) |
| `### Company` | A role / company entry within a section |
| `#### Sub-role` | A **nested sub-role** beneath its parent `###` company/umbrella |

The `####` level is what lets one company entry hold several nested engagements. This is the convention for representing **fractional, interim, and umbrella work** — for example, an advisory or consulting practice (`###`) with several distinct client engagements (`####`) underneath it:

```markdown
### Vale Advisory -- Remote (advisory practice)
**Founder and Principal, Fractional Operations**
2021-Present

- One or two umbrella-level bullets describing the practice.

#### NorthStar Analytics -- Interim VP Operations
2023-2024

- Engagement-specific achievement.
- Another engagement-specific achievement.

#### Cobalt Systems -- Fractional Chief of Staff
2022-2023

- Engagement-specific achievement.
```

The export renders each `####` as a nested sub-role under its parent `###`, with a distinct indented style and its own right-flushed date, instead of flattening the engagements into separate standalone jobs. A `###` with no `####` children renders as an ordinary role.

Under each heading the parser recognises:

- A bold line (`**Founder and Principal**`) directly under the heading → the role/title.
- A short line that reads as a date range (`2021-Present`, `2023-2024`) → the right-flushed date.
- `-` / `*` bullets → achievement bullets (nested one level deeper under a `####` sub-role).

There is a runnable, non-personal example at `examples/cv-fractional-example.md`.

Note: only the `docx` export honors this `####` nesting today. The `pdf` and `latex` paths render their own layouts and do not read the `####` sub-role level.

## Formatting

- **Fonts:** Calibri (Word-safe on every Word / LibreOffice / Google Docs install). No color, no theme, no graphics — a clean single-column layout.
- **Page:** US Letter (`letter`) or A4 (`a4`), set explicitly so Word never repaginates to its own default.
- **Dates:** right-flushed on the same line as the company/role via a right tab stop.
- **Bullets:** real Word list numbering with hanging indents; sub-role bullets sit one level deeper.
- **Section headers:** bold, uppercase, with a thin rule underneath.

The exporter is intentionally generic. It applies no personal branding, colors, or skill pills — those belong in the user's own layer, never in this shared script.

## ATS Rules (same as pdf mode)

- Single-column layout (no sidebars, no parallel columns)
- Standard section headers: Professional Summary, Work Experience, Education, Skills, Certifications, Projects
- Selectable UTF-8 text (not rasterized), no text inside images
- Keywords distributed: Summary, first bullet of each role, Skills section
- No hidden text, keyword stuffing, or white-font tricks

## Keyword Injection Strategy

Same ethical rules as `modes/pdf.md`:

- NEVER add skills the candidate does not have
- Only reformulate existing experience using JD vocabulary
- Examples:
  - JD says "RAG pipelines" → reword "LLM workflows with retrieval" to "RAG pipeline design"
  - JD says "MLOps" → reword "observability, evals" to "MLOps and observability"
