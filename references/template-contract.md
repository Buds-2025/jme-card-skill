# Template Contract

All templates are 1080 x 1440 vertical posters. The white and midnight versions use the same layout and differ only by theme color. The original project templates remain unchanged; use the optimized copies in `assets/templates`.

## Global Rules

- Before generation, perform exactly one form-style intake round. Summarize the known request, ask compact questions about style/theme, count, image method, template selection, copy tone, output path, and constraints, then proceed after the answer.
- Do not keep asking follow-up questions. If information is still missing after that one round, choose reasonable defaults and record them in the spec or manifest.
- Preserve CSS typography, spacing, width, height, grid, and safe-area rules.
- Replace content only inside `data-text-zone` and `.jp-photo-zone` regions.
- Use `data-slot-id` as the stable replacement key. If missing in older markup, use `data-relation-id`.
- Image replacement changes only `<img src>`, `alt`, `object-fit`, and `object-position`.
- Final image sources must be raster files (`.png`, `.jpg`, `.jpeg`, `.webp`) or remote bitmap URLs. Do not leave `.svg` or `data:image/svg+xml` in rendered HTML.
- If SVG is used to construct fallback art, rasterize it into `generated-images/*.png` before filling the template.
- Text replacement changes only text content inside the target zone.
- Validation must check punctuation, quote style, overflow, poster dimensions, and image frame fill.

## Text Rules

- Title zones: no final punctuation. Internal commas are allowed for short clauses.
- Golden quote zones: final character must be `。`, `！`, `？`, `.`, `!`, or `?`.
- Detail zones: use normal punctuation.
- Chinese quote marks should be `「」`, except when preserving explicitly quoted source text.
- Avoid manual or rendered lines containing only one CJK character or one CJK character plus punctuation.

## Templates

| ID | Template name | Use for | Image slots | Text shape |
| --- | --- | --- | --- | --- |
| `vertical-01` | `vertical-photo-story-notes` | Feature opening with one dominant lifestyle/story image and three detail notes | `large-lifestyle-scene` | Large title, optional English line, 3 compact detail blocks |
| `vertical-02` | `vertical-single-photo-headline` | One photo leading into a headline and thesis | `single-photo-feature` | Large title, one quote, one detail/caption |
| `vertical-03` | `vertical-object-grid-grouping` | Object grouping, product grouping, six related evidence items | `object-group-1` to `object-group-6` | Medium title, one quote, six short item notes |
| `vertical-04` | `vertical-ruled-hierarchy-list` | Hierarchical list or framework without images | none | Medium title, one quote, three numbered rows |
| `vertical-05` | `vertical-image-row-note-list` | Upper image mapped to lower observation rows | `upper-image-sequence` | Short title/meta, one quote, three numbered rows |
| `vertical-06` | `vertical-equal-photo-voice-note` | Quote/person/source voice with equal image and text weight | `equal-height-voice-source-image` | Medium title, one quote, one rich detail block |
| `vertical-07` | `vertical-before-after-cards` | Two-sided comparison, before/after, A/B viewpoints | none | Two paired title/quote/detail groups |
| `vertical-08` | `vertical-square-photo-board` | Four-scene environment board or visual mood board | `square-scene-1` to `square-scene-4` | Medium title, one quote, one detail block |

## Copy Budgets

- Large title: 4-18 Chinese characters, max 2 lines.
- Medium title: 4-16 Chinese characters, max 2 lines.
- Golden quote: 8-36 Chinese characters, max 3 lines.
- Detail block: 18-90 Chinese characters unless the template uses compact list rows.
- Compact list item title: 2-8 Chinese characters.
- Compact list item note: 8-28 Chinese characters.
- `vertical-03` object-card notes: 6-10 Chinese characters, one visual line preferred.

Prefer rewriting over squeezing. If content exceeds the zone, reduce text before changing markup.

## Layout Guardrails

- `.jp-photo-zone` must have `width: 100%; max-width: 100%;`. This prevents tall image frames, especially `vertical-06`, from expanding beyond their grid column.
- Validate `.jp-frame-inset` overflow. Fixed-height cards in `vertical-03` must not scroll or overlap the next row.
- Export poster PNGs at 2x scale unless the user explicitly asks for 1x.
