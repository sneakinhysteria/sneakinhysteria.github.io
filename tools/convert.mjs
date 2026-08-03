// Converts a Ghost export JSON into Eleventy content files.
// Usage: node tools/convert.mjs <export.json>
import fs from "node:fs";
import path from "node:path";
import TurndownService from "turndown";

const exportPath = process.argv[2];
if (!exportPath) {
  console.error("usage: node tools/convert.mjs <export.json>");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(exportPath, "utf8")).db[0].data;
const tagsById = Object.fromEntries(data.tags.map((t) => [t.id, t]));
const postTags = {};
for (const pt of data.posts_tags) {
  (postTags[pt.post_id] ||= []).push(tagsById[pt.tag_id]);
}
const metaById = Object.fromEntries(
  (data.posts_meta || []).map((m) => [m.post_id, m])
);

const td = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "_",
});

// Ghost card markup carries layout/styling that Markdown cannot express.
// Pass those blocks through untouched rather than flattening them.
td.keep(["figure", "iframe", "script"]);
td.addRule("ghostCards", {
  filter: (node) =>
    node.nodeName === "DIV" &&
    /\bkg-(card|callout-card|embed-card)\b/.test(node.className || ""),
  replacement: (_content, node) => "\n\n" + node.outerHTML + "\n\n",
});

// Feature images Ghost hotlinked from Unsplash, mirrored locally so the site
// carries its own assets. Keys are matched on the path, ignoring query strings.
const externalImages = {
  "https://images.unsplash.com/photo-1483412033650-1015ddeb83d1":
    "/content/images/external/records-photo-1483412033650.jpg",
};

const localiseExternal = (url) => {
  if (!url) return url;
  const base = url.split("?")[0];
  return externalImages[base] || url;
};

const clean = (html) =>
  (html || "")
    .replaceAll("__GHOST_URL__", "")
    // Ghost writes responsive srcsets pointing at size-variant files that only
    // exist on its image server; the originals are what we mirror.
    .replace(/\s(?:srcset|sizes)="[^"]*"/g, "");

const yaml = (obj) =>
  Object.entries(obj)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) =>
      Array.isArray(v) ? `${k}: ${JSON.stringify(v)}` : `${k}: ${JSON.stringify(v)}`
    )
    .join("\n");

const images = new Set();
const collectImages = (s) => {
  for (const m of (s || "").matchAll(/\/content\/images\/[^"'\s)>]+/g)) {
    images.add(m[0].split("?")[0]);
  }
};

const outDirs = { post: "src/posts", page: "src/pages" };
for (const d of Object.values(outDirs)) fs.mkdirSync(d, { recursive: true });

let counts = { post: 0, page: 0, skipped: 0 };
for (const p of data.posts) {
  if (p.status !== "published") {
    counts.skipped++;
    continue;
  }
  const html = clean(p.html);
  const feature = p.feature_image ? localiseExternal(clean(p.feature_image)) : null;
  collectImages(html);
  collectImages(feature);

  const meta = metaById[p.id] || {};
  const tags = (postTags[p.id] || [])
    .filter((t) => t && t.visibility === "public")
    .map((t) => t.slug);

  const front = yaml({
    title: p.title,
    date: p.published_at,
    slug: p.slug,
    excerpt: p.custom_excerpt || meta.meta_description || null,
    image: feature,
    tags: p.type === "post" ? ["posts", ...tags] : undefined,
    layout: p.type === "post" ? "post.njk" : "page.njk",
  });

  const body = td.turndown(html);
  const dir = outDirs[p.type];
  fs.writeFileSync(
    path.join(dir, `${p.slug}.md`),
    `---\n${front}\n---\n\n${body}\n`
  );
  counts[p.type]++;
}

// Site-wide settings the templates read from src/_data/site.json.
const settings = Object.fromEntries(data.settings.map((s) => [s.key, s.value]));
collectImages(clean(settings.icon));
collectImages(clean(settings.logo));
collectImages(clean(settings.cover_image));

const site = {
  title: settings.title,
  description: settings.description,
  url: "https://holgerschueler.com",
  accent: settings.accent_color || "#ff0534",
  locale: settings.locale || "en",
  logo: clean(settings.logo) || null,
  icon: clean(settings.icon) || null,
  cover: clean(settings.cover_image) || null,
  nav: JSON.parse(settings.navigation || "[]"),
  author: "Holger Schueler",
  tagNames: Object.fromEntries(
    data.tags
      .filter((t) => t.visibility === "public")
      .map((t) => [t.slug, t.name])
  ),
  // Paste the <form> or embed snippet from your newsletter provider here.
  newsletterEmbed: "",
};
fs.mkdirSync("src/_data", { recursive: true });
fs.writeFileSync("src/_data/site.json", JSON.stringify(site, null, 2) + "\n");

fs.writeFileSync("tools/images.txt", [...images].sort().join("\n") + "\n");

console.log(
  `posts: ${counts.post}  pages: ${counts.page}  skipped (drafts): ${counts.skipped}  images: ${images.size}`
);
