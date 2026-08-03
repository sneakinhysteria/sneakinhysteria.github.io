export default {
  layout: "page.njk",
  eleventyComputed: {
    permalink: (data) =>
      data.draft ? false : `/${data.slug || data.page.fileSlug}/`,
    eleventyExcludeFromCollections: (data) => Boolean(data.draft),
  },
};
