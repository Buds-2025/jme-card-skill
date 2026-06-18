#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const values = [];
    while (argv[i + 1] && !argv[i + 1].startsWith("--")) {
      values.push(argv[i + 1]);
      i += 1;
    }
    args[key] = values.length > 1 ? values : values[0] ?? true;
  }
  return args;
}

function expandHtmlInputs(input) {
  const raw = Array.isArray(input) ? input : [input];
  const files = [];
  for (const item of raw.filter(Boolean)) {
    if (!String(item).includes("*")) {
      files.push(path.resolve(item));
      continue;
    }
    const resolved = path.resolve(item);
    const dir = path.dirname(resolved);
    const pattern = new RegExp(`^${path.basename(resolved).replaceAll(".", "\\.").replaceAll("*", ".*")}$`);
    for (const name of fs.readdirSync(dir)) {
      if (pattern.test(name)) files.push(path.join(dir, name));
    }
  }
  return files;
}

function textOnly(html) {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function checkStatic(html, file, issues) {
  if (/data:image\/svg\+xml|\.svg(?:["?#])/i.test(html)) {
    issues.push({ file, type: "svg-final-image", message: "Final HTML references SVG image data or .svg files; rasterize images to PNG/JPEG/WebP before rendering." });
  }
  for (const match of html.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/g)) {
    const text = textOnly(match[1]);
    if (/[。！？!?；;：:，,、.]$/u.test(text)) {
      issues.push({ file, type: "title-punctuation", message: `Title ends with punctuation: ${text}` });
    }
  }
  for (const match of html.matchAll(/<div[^>]*class="[^"]*jp-template-quote-zone[^"]*"[^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>/g)) {
    const text = textOnly(match[1]);
    if (text && !/[。！？.!?]$/u.test(text)) {
      issues.push({ file, type: "quote-ending", message: `Golden quote has invalid ending: ${text}` });
    }
  }
  if (/[“”‘’]/u.test(html)) {
    issues.push({ file, type: "quote-style", message: "Chinese curly quotes found; use 「」 unless preserving explicit source quotes." });
  }
  for (const line of html.replace(/<br\s*\/?>/gi, "\n").split(/\r?\n/)) {
    const text = textOnly(line);
    if (/^[\p{Script=Han}][，,。.!！？?；;：:、]?$/u.test(text)) {
      issues.push({ file, type: "orphan-line", message: `Single-character manual line found: ${text}` });
    }
  }
}

async function checkBrowser(files, issues) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    issues.push({ file: "*", type: "browser-skipped", message: "Playwright is not installed; browser overflow and PNG dimension checks were skipped." });
    return;
  }

  const browser = await chromium.launch();
  try {
    for (const file of files) {
      const page = await browser.newPage({ viewport: { width: 1200, height: 1600 }, deviceScaleFactor: 1 });
      await page.goto(pathToFileURL(file).href, { waitUntil: "networkidle" });
      const checks = await page.evaluate(() => {
        const output = [];
        const poster = document.querySelector("section.poster");
        if (!poster) {
          output.push({ type: "missing-poster", message: "No section.poster found." });
        } else {
          const box = poster.getBoundingClientRect();
          if (Math.round(box.width) !== 1080 || Math.round(box.height) !== 1440) {
            output.push({ type: "poster-size", message: `Poster size is ${Math.round(box.width)}x${Math.round(box.height)}, expected 1080x1440.` });
          }
        }

        for (const element of document.querySelectorAll("[data-text-zone]")) {
          const slot = element.getAttribute("data-slot-id") || element.getAttribute("data-text-zone");
          const style = getComputedStyle(element);
          const hasFixedHeight = style.maxHeight !== "none" || /height\s*:/.test(element.getAttribute("style") || "");
          if (element.scrollWidth > element.clientWidth + 2 || (hasFixedHeight && element.scrollHeight > element.clientHeight + 2)) {
            output.push({ type: "text-overflow", message: `${slot} overflows its text box.` });
          }

          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          const lines = new Map();
          while (walker.nextNode()) {
            const node = walker.currentNode;
            const value = node.nodeValue || "";
            for (let i = 0; i < value.length; i += 1) {
              const char = value[i];
              if (!char.trim()) continue;
              const range = document.createRange();
              range.setStart(node, i);
              range.setEnd(node, i + 1);
              const rect = range.getBoundingClientRect();
              range.detach();
              if (!rect.width && !rect.height) continue;
              const key = Math.round(rect.top);
              lines.set(key, `${lines.get(key) || ""}${char}`);
            }
          }
          for (const lineText of lines.values()) {
            const compact = lineText.replace(/\s+/g, "");
            if (/^[\u4e00-\u9fff][，,。.!！？?；;：:、]?$/u.test(compact)) {
              output.push({ type: "orphan-rendered-line", message: `${slot} has a rendered single-character line: ${compact}` });
            }
          }
        }

        for (const frame of document.querySelectorAll(".jp-photo-zone")) {
          const slot = frame.getAttribute("data-slot-id") || frame.getAttribute("data-relation-id") || "image";
          const img = frame.querySelector("img");
          const box = frame.getBoundingClientRect();
          if (!img || !img.getAttribute("src")) {
            output.push({ type: "image-missing", message: `${slot} has no image source.` });
          }
          if (box.width <= 0 || box.height <= 0) {
            output.push({ type: "image-frame", message: `${slot} image frame has invalid size.` });
          }
        }
        for (const frame of document.querySelectorAll(".jp-frame-inset")) {
          const box = frame.getBoundingClientRect();
          const hasConstrainedHeight = box.height > 0 && box.height < frame.scrollHeight - 2;
          if (hasConstrainedHeight) {
            output.push({ type: "frame-overflow", message: `A framed content block overflows its fixed area.` });
          }
        }
        return output;
      });
      for (const issue of checks) issues.push({ file, ...issue });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const files = expandHtmlInputs(args.html);
  if (!files.length) {
    console.error("[validate_poster] Missing --html file or glob");
    process.exit(1);
  }

  const issues = [];
  for (const file of files) {
    const html = fs.readFileSync(file, "utf8");
    checkStatic(html, file, issues);
  }
  await checkBrowser(files, issues);

  const blocking = issues.filter((issue) => issue.type !== "browser-skipped");
  const result = { ok: blocking.length === 0, files, issues };
  console.log(JSON.stringify(result, null, 2));
  process.exit(blocking.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
