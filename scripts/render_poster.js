#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function fail(message) {
  console.error(`[render_poster] ${message}`);
  process.exit(1);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function stripTags(value) {
  return String(value ?? "").replace(/<[^>]+>/g, "").trim();
}

function normalizeQuotes(text, preserveSourceQuotes = false) {
  if (preserveSourceQuotes) return String(text ?? "");
  return String(text ?? "")
    .replaceAll("“", "「")
    .replaceAll("”", "」")
    .replaceAll("‘", "「")
    .replaceAll("’", "」");
}

function normalizeTitle(text, preserveSourceQuotes) {
  return normalizeQuotes(text, preserveSourceQuotes).trim().replace(/[。！？!?；;：:，,、.]+$/u, "");
}

function normalizeQuote(text, preserveSourceQuotes) {
  const cleaned = normalizeQuotes(text, preserveSourceQuotes).trim().replace(/[，,、；;：:]+$/u, "");
  return /[。！？.!?]$/u.test(cleaned) ? cleaned : `${cleaned}。`;
}

function normalizeDetail(text, preserveSourceQuotes) {
  return normalizeQuotes(text, preserveSourceQuotes).trim();
}

function normalizeDetails(details, preserveSourceQuotes) {
  const list = Array.isArray(details) ? details : details ? [details] : [];
  return list.map((item) => {
    if (typeof item === "string") {
      return { heading: "", title: "", body: normalizeDetail(item, preserveSourceQuotes) };
    }
    return {
      heading: normalizeTitle(item.heading ?? item.title ?? "", preserveSourceQuotes),
      title: normalizeTitle(item.title ?? item.heading ?? "", preserveSourceQuotes),
      body: normalizeDetail(item.body ?? item.text ?? item.detail ?? "", preserveSourceQuotes),
    };
  });
}

function asList(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (value == null) return fallback;
  return [value];
}

function textAt(values, index, fallback = "") {
  if (!values.length) return fallback;
  return values[index] ?? values[values.length - 1] ?? fallback;
}

function imageSrcToHtml(src) {
  if (!src) return "";
  if (/^(https?:|data:|file:)/i.test(src)) return src;
  return pathToFileURL(path.resolve(src)).href;
}

function svgFallback(slot, theme) {
  const dark = theme === "midnight";
  const bg = dark ? "#1b1916" : "#dedbd2";
  const ink = dark ? "#f1eadc" : "#111111";
  const accent = dark ? "#c7a15a" : "#557c55";
  const red = "#c1121f";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900">
<rect width="1200" height="900" fill="${bg}"/>
<rect x="72" y="72" width="1056" height="756" fill="${dark ? "#24211d" : "#f7f4eb"}" stroke="${ink}" stroke-opacity=".16" stroke-width="2"/>
<path d="M0 640 C170 580 310 700 510 630 S850 565 1200 650 L1200 900 L0 900 Z" fill="${accent}" opacity=".35"/>
<path d="M120 290 C220 165 430 170 555 292 C435 382 245 388 120 290 Z" fill="${accent}" opacity=".88"/>
<path d="M245 215 C305 340 355 455 430 600" fill="none" stroke="${dark ? "#f1eadc" : "#fffaf0"}" stroke-width="24" stroke-linecap="round" opacity=".84"/>
<path d="M720 500 L900 430 L1040 512 L940 640 L755 610 Z" fill="${dark ? "#8f7040" : "#bd9a41"}" opacity=".9"/>
<path d="M740 522 L930 590" stroke="${dark ? "#f1eadc" : "#fffaf0"}" stroke-width="18" stroke-linecap="round" opacity=".8"/>
<circle cx="905" cy="248" r="88" fill="${red}" opacity=".82"/>
<path d="M785 248 H1025 M905 128 V368" stroke="${dark ? "#f1eadc" : "#fffaf0"}" stroke-width="10" opacity=".55"/>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function compactNote(text, maxChars = 18) {
  const clean = stripTags(text).replace(/\s+/g, "").replace(/[。！？!?；;：:，,、]+$/u, "");
  if (!clean) return "";
  const chars = [...clean];
  return `${chars.slice(0, maxChars).join("")}${chars.length > maxChars ? "。" : "。"}`;
}

function addAttrIfMissing(tag, name, value) {
  if (new RegExp(`\\s${name}=`).test(tag)) return tag;
  return tag.replace(/>$/, ` ${name}="${escapeHtml(value)}">`);
}

function annotateTemplate(html) {
  return html.replace(/<section\b[\s\S]*?<\/section>/g, (section) => {
    const currentTemplate = section.match(/\bid="([^"]+)"/)?.[1] ?? "poster";
    const textCounters = {};
    section = section.replace(/<figure\b(?=[^>]*\bjp-photo-zone\b)([^>]*)>/g, (match) => {
    const relation = match.match(/\bdata-relation-id="([^"]+)"/)?.[1];
    const slot = match.match(/\bdata-slot-id="([^"]+)"/)?.[1] ?? relation ?? "image";
    const fit = match.match(/\bdata-fit="([^"]+)"/)?.[1] ?? match.match(/\bdata-fit-decision="([^"]+)"/)?.[1] ?? "cover";
    const ratio = match.match(/\bdata-frame-ratio="([^"]+)"/)?.[1] ?? "free";
    let tag = match;
    tag = addAttrIfMissing(tag, "data-slot-id", slot);
    tag = addAttrIfMissing(tag, "data-fit", fit);
    tag = addAttrIfMissing(tag, "data-frame-ratio", ratio);
    tag = addAttrIfMissing(tag, "data-safe-focus", "center 50%");
    return tag;
  });
    section = section.replace(/<(div|article)\b(?=[^>]*\bdata-text-zone="([^"]+)")([^>]*)>/g, (match, tagName, zone) => {
    textCounters[`${currentTemplate}:${zone}`] = (textCounters[`${currentTemplate}:${zone}`] ?? 0) + 1;
    const index = textCounters[`${currentTemplate}:${zone}`];
    const slot = `${currentTemplate}-${zone}-${index}`;
    const budget = zone === "title" ? "4-18" : zone === "golden-quote" ? "8-36" : "18-90";
    const maxLines = zone === "title" ? "2" : zone === "golden-quote" ? "3" : "6";
    let node = match;
    node = addAttrIfMissing(node, "data-slot-id", slot);
    node = addAttrIfMissing(node, "data-copy-budget", budget);
    node = addAttrIfMissing(node, "data-max-lines", maxLines);
    node = addAttrIfMissing(node, "data-no-orphan-line", "true");
    return node;
  });
    return section;
  });
}

function replaceNth(html, regex, values) {
  let index = 0;
  return html.replace(regex, (match, before, oldText, after) => {
    if (index >= values.length) return match;
    const value = values[index];
    index += 1;
    return `${before}${escapeHtml(value)}${after}`;
  });
}

function fillText(section, content, spec) {
  const preserve = Boolean(spec.preserveSourceQuotes);
  const titleValues = asList(content.titles ?? content.title).map((value) => normalizeTitle(value, preserve));
  const quoteValues = asList(content.goldenQuotes ?? content.goldenQuote ?? content.quote).map((value) => normalizeQuote(value, preserve));
  const detailValues = normalizeDetails(content.details ?? content.detail, preserve);
  const fallbackTitle = normalizeTitle(spec.sourceText ?? "主题标题", preserve);
  const fallbackQuote = normalizeQuote(content.goldenQuote ?? spec.sourceText ?? "让内容在版面里保持清楚的判断。", preserve);

  section = section.replace(/(<p class="jp-issue">)([\s\S]*?)(<\/p>)/g, `$1${escapeHtml(content.issue ?? fallbackTitle)}$3`);
  section = replaceNth(section, /(<h[12][^>]*>)([\s\S]*?)(<\/h[12]>)/g, titleValues.length ? titleValues : [fallbackTitle]);
  if (!/<h[12][^>]*>/.test(section) && titleValues.length) {
    section = replaceNth(section, /(<div[^>]*data-text-zone="title"[^>]*>\s*<p[^>]*>)([\s\S]*?)(<\/p>)/g, titleValues);
  }

  section = replaceNth(
    section,
    /(<div[^>]*class="[^"]*jp-template-quote-zone[^"]*"[^>]*>\s*<p[^>]*>)([\s\S]*?)(<\/p>)/g,
    quoteValues.length ? quoteValues : [fallbackQuote],
  );

  const headings = detailValues.map((item, i) => item.heading || item.title || `NOTE ${i + 1}`);
  const listTitles = detailValues.map((item, i) => item.title || item.heading || ["观察", "关联", "判断"][i] || `要点${i + 1}`);
  const bodies = detailValues.map((item) => item.body).filter(Boolean);
  const fallbackBodies = bodies.length ? bodies : [normalizeDetail(spec.sourceText ?? "详细内容承载场景、人物与来源。", preserve)];

  section = replaceNth(section, /(<p class="[^"]*jp-detail-micro-heading[^"]*"[^>]*>)([\s\S]*?)(<\/p>)/g, headings);
  section = replaceNth(section, /(<p class="[^"]*jp-list-title[^"]*"[^>]*>)([\s\S]*?)(<\/p>)/g, listTitles);
  section = replaceNth(section, /(<p class="[^"]*jp-list-kicker[^"]*"[^>]*>)([\s\S]*?)(<\/p>)/g, headings.map((h) => h.toUpperCase()));
  const listNoteBudget = /vertical-03|vertical-object-grid-grouping/.test(section) ? 8 : 18;
  section = replaceNth(section, /(<p class="[^"]*jp-list-note[^"]*"[^>]*>)([\s\S]*?)(<\/p>)/g, fallbackBodies.map((body) => compactNote(body, listNoteBudget)));
  section = replaceNth(section, /(<p class="[^"]*jp-detail-micro-copy(?![^"]*\b(en|ja)\b)[^"]*"[^>]*>)([\s\S]*?)(<\/p>)/g, fallbackBodies);
  section = replaceNth(section, /(<div[^>]*class="[^"]*jp-template-detail-zone[^"]*"[^>]*>\s*<p class="[^"]*jp-body[^"]*"[^>]*>)([\s\S]*?)(<\/p>)/g, fallbackBodies);
  section = replaceNth(section, /(<div[^>]*class="[^"]*jp-template-detail-zone[^"]*"[^>]*>[\s\S]*?<p class="[^"]*jp-cap[^"]*"[^>]*>)([\s\S]*?)(<\/p>)/g, fallbackBodies);
  return section;
}

function fillImages(section, images, theme) {
  return section.replace(
    /(<figure\b(?=[^>]*\bjp-photo-zone\b)(?=[^>]*\bdata-slot-id="([^"]+)")[^>]*>[\s\S]*?<img\b)([^>]*)(>)/g,
    (match, prefix, slot, imgAttrs, close) => {
      const image = images.get(slot) ?? images.get(match.match(/\bdata-relation-id="([^"]+)"/)?.[1] ?? "");
      const fit = image?.fit ?? match.match(/\bdata-fit="([^"]+)"/)?.[1] ?? "cover";
      const focus = image?.focus ?? match.match(/\bdata-safe-focus="([^"]+)"/)?.[1] ?? "center 50%";
      const src = imageSrcToHtml(image?.src) || svgFallback(slot, theme);
      let attrs = imgAttrs;
      attrs = attrs.replace(/\s+src="[^"]*"/, "");
      attrs = attrs.replace(/\s+alt="[^"]*"/, "");
      attrs = attrs.replace(/\s+style="[^"]*"/, "");
      attrs += ` src="${escapeHtml(src)}" alt="${escapeHtml(image?.alt ?? slot)}" style="object-fit:${escapeHtml(fit)};object-position:${escapeHtml(focus)}"`;
      return `${prefix}${attrs}${close}`;
    },
  );
}

function collectImageSlots(sections) {
  const slots = new Set();
  for (const section of sections) {
    for (const match of section.matchAll(/<figure\b(?=[^>]*\bjp-photo-zone\b)[^>]*>/g)) {
      const slot = match[0].match(/\bdata-slot-id="([^"]+)"/)?.[1] ?? match[0].match(/\bdata-relation-id="([^"]+)"/)?.[1];
      if (slot) slots.add(slot);
    }
  }
  return [...slots];
}

function sourceIsSvg(src) {
  return /\.svg(?:$|[?#])/i.test(String(src)) || /^data:image\/svg\+xml/i.test(String(src));
}

function sourceSvgContent(src, slot, theme) {
  if (!src) return decodeURIComponent(svgFallback(slot, theme).replace(/^data:image\/svg\+xml,/, ""));
  if (/^data:image\/svg\+xml,/i.test(src)) return decodeURIComponent(src.replace(/^data:image\/svg\+xml,?/i, ""));
  const file = path.resolve(src);
  return fs.readFileSync(file, "utf8");
}

function rasterSizeForSlot(slot) {
  if (/equal-height/.test(slot)) return { width: 1200, height: 1800 };
  if (/object-group|square-scene/.test(slot)) return { width: 1200, height: 1200 };
  return { width: 1600, height: 1100 };
}

async function rasterizeSvgToPng(svg, pngFile, size) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return { ok: false, reason: "Playwright is not installed. Run npm install in the skill directory." };
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: size, deviceScaleFactor: 2 });
    await page.setContent(`<html><body style="margin:0;width:${size.width}px;height:${size.height}px;overflow:hidden;background:transparent">${svg}</body></html>`);
    await page.locator("svg").evaluate((element, viewport) => {
      element.setAttribute("width", String(viewport.width));
      element.setAttribute("height", String(viewport.height));
      element.style.width = `${viewport.width}px`;
      element.style.height = `${viewport.height}px`;
      element.style.display = "block";
    }, size);
    await page.screenshot({ path: pngFile, clip: { x: 0, y: 0, width: size.width, height: size.height } });
    return { ok: true };
  } finally {
    await browser.close();
  }
}

async function prepareImageMap(spec, sections, theme, outDir) {
  const provided = new Map();
  for (const image of asList(spec.images)) {
    if (image?.slot) provided.set(image.slot, image);
  }
  const generatedDir = path.join(outDir, "generated-images");
  fs.mkdirSync(generatedDir, { recursive: true });
  const map = new Map();
  for (const slot of collectImageSlots(sections)) {
    const image = provided.get(slot);
    const src = image?.src;
    if (src && !sourceIsSvg(src)) {
      map.set(slot, image);
      continue;
    }
    const pngFile = path.join(generatedDir, `${slot}.png`);
    const svg = sourceSvgContent(src, slot, theme);
    const result = await rasterizeSvgToPng(svg, pngFile, rasterSizeForSlot(slot));
    if (!result.ok) {
      map.set(slot, { ...image, slot, src: src || svgFallback(slot, theme) });
      continue;
    }
    map.set(slot, {
      ...image,
      slot,
      src: pngFile,
      fit: image?.fit ?? "cover",
      focus: image?.focus ?? "center 50%",
      rasterizedFrom: src ? "provided-svg" : "generated-fallback",
    });
  }
  return map;
}

function extractSections(html) {
  const sections = new Map();
  for (const match of html.matchAll(/<section\b[\s\S]*?<\/section>/g)) {
    const id = match[0].match(/\bid="([^"]+)"/)?.[1];
    const templateId = match[0].match(/\bdata-template-id="([^"]+)"/)?.[1];
    if (id) sections.set(id, match[0]);
    if (templateId) sections.set(templateId, match[0]);
  }
  return sections;
}

async function exportPng(htmlFile, pngFile) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch (error) {
    return { ok: false, reason: "Playwright is not installed. Run npm install in the skill directory." };
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 1600 }, deviceScaleFactor: Number(process.env.JP_POSTER_EXPORT_SCALE || 2) });
    await page.goto(pathToFileURL(htmlFile).href, { waitUntil: "networkidle" });
    const poster = page.locator("section.poster").first();
    await poster.screenshot({ path: pngFile });
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error.message };
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.spec) fail("Missing --spec input.json");
  if (!args.out) fail("Missing --out output directory");

  const specPath = path.resolve(args.spec);
  const outDir = path.resolve(args.out);
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8").replace(/^\uFEFF/, ""));
  const theme = ["midnight", "dark"].includes(String(spec.theme ?? "").toLowerCase()) ? "midnight" : "white";
  const templateFile = path.join(skillRoot, "assets", "templates", theme, "index.html");
  let templateHtml = annotateTemplate(fs.readFileSync(templateFile, "utf8"));
  const sheetOpen = '<main class="sheet">';
  const sheetIndex = templateHtml.indexOf(sheetOpen);
  if (sheetIndex < 0) fail("Template is missing <main class=\"sheet\">");
  const prefix = templateHtml.slice(0, sheetIndex + sheetOpen.length);
  const suffix = "\n  </main>\n</body>\n</html>\n";
  const sections = extractSections(templateHtml);
  const requested = spec.templates === "all" || spec.templates?.[0] === "all"
    ? [...new Set([...sections.keys()].filter((key) => /^vertical-\d\d$/.test(key)))]
    : asList(spec.templates, ["vertical-02"]);
  const selectedSections = requested.map((templateKey) => {
    const section = sections.get(templateKey);
    if (!section) fail(`Template not found: ${templateKey}`);
    return annotateTemplate(section);
  });

  fs.mkdirSync(outDir, { recursive: true });
  const imageMap = await prepareImageMap(spec, selectedSections, theme, outDir);
  const manifest = { spec: specPath, theme, exportScale: Number(process.env.JP_POSTER_EXPORT_SCALE || 2), outputs: [] };

  for (let i = 0; i < requested.length; i += 1) {
    const templateKey = requested[i];
    let section = selectedSections[i];
    section = section.replace(/(<p class="jp-page jp-red-mark">)([\s\S]*?)(<\/p>)/g, `$1${String(i + 1).padStart(2, "0")} / ${requested.length}$3`);
    section = fillText(section, spec.content ?? {}, spec);
    section = fillImages(section, imageMap, theme);
    const sectionId = section.match(/\bid="([^"]+)"/)?.[1] ?? `poster-${i + 1}`;
    const htmlFile = path.join(outDir, `${sectionId}-${theme}.html`);
    const pngFile = path.join(outDir, `${sectionId}-${theme}.png`);
    fs.writeFileSync(htmlFile, `${prefix}\n${section}\n${suffix}`, "utf8");
    const exportResult = await exportPng(htmlFile, pngFile);
    manifest.outputs.push({
      template: templateKey,
      html: htmlFile,
      png: exportResult.ok ? pngFile : null,
      export: exportResult,
    });
  }

  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => fail(error.stack || error.message));
