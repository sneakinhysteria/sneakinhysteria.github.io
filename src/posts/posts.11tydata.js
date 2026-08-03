// Post bodies bypass the template engine, so the permalink is computed here
// rather than interpolated in front matter.
export default {
  layout: "post.njk",
  eleventyComputed: {
    permalink: (data) => `/${data.slug}/`,
  },
};
