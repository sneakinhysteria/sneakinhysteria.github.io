// Post bodies bypass the template engine, so the permalink is computed here
// rather than interpolated in front matter.
export default {
  layout: "post.njk",
  eleventyComputed: {
    // Falls back to the filename, so a post without an explicit slug still
    // gets a sensible URL. `draft: true` keeps a post out of the build.
    permalink: (data) =>
      data.draft ? false : `/${data.slug || data.page.fileSlug}/`,
    eleventyExcludeFromCollections: (data) => Boolean(data.draft),
  },
};
