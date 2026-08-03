import fs from "node:fs";

// Read directly rather than through the data cascade so collections and
// filters can use it too.
const site = JSON.parse(fs.readFileSync("src/_data/site.json", "utf8"));

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/content");
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy({ "src/static": "." });

  eleventyConfig.addCollection("posts", (api) =>
    api.getFilteredByTag("posts").sort((a, b) => b.date - a.date)
  );

  eleventyConfig.addCollection("tagList", (api) => {
    const counts = new Map();
    for (const item of api.getFilteredByTag("posts")) {
      for (const tag of item.data.tags || []) {
        if (tag === "posts") continue;
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count, name: site.tagNames[tag] || tag }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  const dateFormat = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Amsterdam",
  });
  eleventyConfig.addFilter("readableDate", (d) => dateFormat.format(d));
  eleventyConfig.addFilter("isoDate", (d) => d.toISOString());
  eleventyConfig.addFilter("dateOnly", (d) => d.toISOString().slice(0, 10));

  eleventyConfig.addFilter("absolute", (url) => new URL(url, site.url).href);

  eleventyConfig.addFilter("summary", (content, length = 200) => {
    const text = String(content)
      .replace(/<figure[\s\S]*?<\/figure>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length <= length) return text;
    return text.slice(0, text.lastIndexOf(" ", length)) + "…";
  });

  eleventyConfig.addFilter("tagName", (slug) => site.tagNames[slug] || slug);

  eleventyConfig.addFilter("limit", (arr, n) => arr.slice(0, n));
}

export const config = {
  dir: {
    input: "src",
    output: "_site",
    includes: "_includes",
    data: "_data",
  },
  // Post bodies are prose, not templates — do not run them through Nunjucks.
  markdownTemplateEngine: false,
  htmlTemplateEngine: "njk",
};
