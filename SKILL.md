---
name: jp-magazine-poster
description: Generate Japanese magazine style poster HTML and PNG from a user topic, source text, or provided images using the bundled white and midnight vertical templates. Use when creating one or more fixed-layout Japanese magazine posters, filling title, golden quote, detail text, and image zones while preserving template typography and layout.
---

# JP Magazine Poster

## Workflow

Use this skill to turn a user topic, source text, or image set into Japanese magazine style poster files.

1. Read `references/template-contract.md` before selecting templates or filling slots.
2. Before production work, ask exactly one form-style clarification round:
   - Summarize the user's current request in 1-3 short sentences.
   - Ask for missing or confirmable choices about style/theme, poster count, image sourcing, template selection, copy tone, output directory, and any must-use/must-avoid content.
   - Prefer compact numbered questions with concrete options where useful.
   - Ask only once. Do not loop for more clarification after the user answers.
   - If the user still leaves gaps, proceed with reasonable defaults and record those assumptions in the spec or manifest.
3. Understand the user's theme and requested output count from the original request plus that one answer.
4. Choose templates:
   - Use the user's explicit template IDs when provided.
   - Use all 8 templates when the user asks for every style.
   - Otherwise choose the fewest templates that fit the content shape.
5. Create concise content for each zone:
   - `title`: no final punctuation. Short clauses may use commas inside the title.
   - `goldenQuote`: must end with a Chinese or English sentence-ending mark.
   - `detail`: normal punctuation and factual source context.
   - Replace Chinese quotation marks with corner brackets unless the user explicitly requires original quoted text.
   - Avoid single-character lines and single-character-plus-punctuation lines.
6. Choose images by priority:
   - User-provided image paths or URLs.
   - User-specified visual plan.
   - Available image generation tools.
   - Built-in generated raster PNG fallback.
   - SVG may be used only as an internal drawing source and must be rasterized before final HTML rendering.
7. Write an input JSON spec and run:

```bash
node scripts/render_poster.js --spec input.json --out output/<run-name>
node scripts/validate_poster.js --html output/<run-name>/*.html
```

If validation fails, shorten or rewrite copy, adjust explicit line breaks, change image focus, then render and validate again.

## Quality Requirements

- Do not start rendering, image generation, or copy fitting until the one-round intake form has been asked and answered, unless the user explicitly says to skip questions.
- Missing details after the one-round intake must be filled by practical defaults rather than more questions.
- Final HTML must not reference `.svg` files or `data:image/svg+xml`.
- Generated or fallback images must be written as PNG files under the output directory before they are placed into image zones.
- PNG poster export defaults to 2x scale for sharper review output.
- Template 03 object-card notes must be very short because each card has a fixed 216px row height.
- Template 06 image zones must keep `.jp-photo-zone { width: 100%; max-width: 100%; }` so the left image cannot intrude into the right text column.

## Spec Format

Minimum input:

```json
{
  "theme": "white",
  "templates": ["vertical-02"],
  "sourceText": "User topic or source text",
  "assumptions": ["Any defaults used after the one-round intake."],
  "images": [
    {
      "slot": "single-photo-feature",
      "src": "D:/path/to/image.png",
      "fit": "cover",
      "focus": "center 50%"
    }
  ],
  "content": {
    "title": "Poster title",
    "goldenQuote": "A clear editorial sentence.",
    "details": ["Detail one.", "Detail two."]
  }
}
```

Notes:

- `theme` accepts `white`, `midnight`, `light`, or `dark`.
- `templates` accepts template IDs such as `vertical-02`, template names such as `vertical-single-photo-headline`, or `all`.
- `content.details` may be an array of strings or objects with `heading`, `title`, and `body`.
- `images[].slot` should match a `data-slot-id` or `data-relation-id` listed in the template contract.

## Output

The render script creates:

- One HTML file per poster.
- One PNG file per poster when Playwright is installed and Chromium is available.
- `manifest.json` with template, theme, image source, output file paths, and validation/export status.
- `generated-images/*.png` when generated, fallback, or SVG-source images are rasterized.

Keep original template layout intact. Do not change font sizes, line heights, widths, safe margins, grid settings, or visual structure to force content to fit. Fix content instead.
