// Extracts the unpublished Ghost drafts to Markdown, so the export JSON (and
// the credentials it carries) no longer has to be kept around for them.
// Writes posts with `draft: true`, which keeps them out of the build.
// Usage: node tools/convert-drafts.mjs <export.json>
import fs from "node:fs";
import path from "node:path";
import TurndownService from "turndown";

const data = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).db[0].data;
const tagsById = Object.fromEntries(data.tags.map((t) => [t.id, t]));
const postTags = {};
for (const pt of data.posts_tags) {
  (postTags[pt.post_id] ||= []).push(tagsById[pt.tag_id]);
}

const td = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "_",
});
td.keep(["figure", "iframe", "script"]);
td.addRule("ghostCards", {
  filter: (node) =>
    node.nodeName === "DIV" &&
    /\bkg-(card|callout-card|embed-card)\b/.test(node.className || ""),
  replacement: (_c, node) => "\n\n" + node.outerHTML + "\n\n",
});

const clean = (html) =>
  (html || "")
    .replaceAll("__GHOST_URL__", "")
    .replace(/\s(?:srcset|sizes)="[^"]*"/g, "");

const images = new Set();
const SKIP = new Set(["test"]);

for (const p of data.posts) {
  if (p.status === "published" || SKIP.has(p.slug)) continue;

  const html = clean(p.html);
  const feature = p.feature_image ? clean(p.feature_image) : null;
  for (const s of [html, feature]) {
    for (const m of (s || "").matchAll(/\/content\/images\/[^"'\s)>]+/g)) {
      images.add(m[0].split("?")[0]);
    }
  }

  const tags = (postTags[p.id] || [])
    .filter((t) => t && t.visibility === "public")
    .map((t) => t.slug);

  const front = Object.entries({
    title: p.title,
    date: p.published_at || p.updated_at || p.created_at,
    slug: p.slug,
    excerpt: p.custom_excerpt || null,
    image: feature,
    tags: ["posts", ...tags],
    draft: true,
  })
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join("\n");

  const out = path.join("src/posts", `${p.slug}.md`);
  if (fs.existsSync(out)) {
    console.log(`skip (exists): ${p.slug}`);
    continue;
  }
  fs.writeFileSync(out, `---\n${front}\n---\n\n${td.turndown(html)}\n`);
  console.log(`wrote: ${p.slug}`);
}

fs.writeFileSync("tools/images-drafts.txt", [...images].sort().join("\n") + "\n");
console.log(`images referenced: ${images.size}`);
