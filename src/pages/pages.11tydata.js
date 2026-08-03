export default {
  layout: "page.njk",
  eleventyComputed: {
    permalink: (data) => `/${data.slug}/`,
  },
};
