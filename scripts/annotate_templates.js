#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(__dirname, "..");

function escapeAttr(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function addAttrIfMissing(tag, name, value) {
  if (new RegExp(`\\s${name}=`).test(tag)) return tag;
  return tag.replace(/>$/, ` ${name}="${escapeAttr(value)}">`);
}

function annotate(html) {
  if (!html.includes(".jp-photo-zone { width: 100%; max-width: 100%; }")) {
    html = html.replace(
      /(\.jp-photo,\s*\n\s*\.jp-shot\s*\{[\s\S]*?\n\s*\})/,
      `$1\n    .jp-photo-zone { width: 100%; max-width: 100%; }`,
    );
  }
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
    const budget = zone === "title" ? "4-18" : zone === "golden-quote" ? "8-36" : "18-90";
    const maxLines = zone === "title" ? "2" : zone === "golden-quote" ? "3" : "6";
    let node = match;
    node = addAttrIfMissing(node, "data-slot-id", `${currentTemplate}-${zone}-${index}`);
    node = addAttrIfMissing(node, "data-copy-budget", budget);
    node = addAttrIfMissing(node, "data-max-lines", maxLines);
    node = addAttrIfMissing(node, "data-no-orphan-line", "true");
    return node;
  });
    return section;
  });
}

for (const theme of ["white", "midnight"]) {
  const file = path.join(skillRoot, "assets", "templates", theme, "index.html");
  const before = fs.readFileSync(file, "utf8");
  const after = annotate(before);
  fs.writeFileSync(file, after, "utf8");
  console.log(`${theme}: ${before.length} -> ${after.length}`);
}
