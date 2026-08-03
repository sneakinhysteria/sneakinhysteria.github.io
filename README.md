# holgerschueler.com

Static rebuild of the Ghost blog, built with [Eleventy](https://www.11ty.dev/)
and deployed to GitHub Pages.

## Local

```bash
npm install
npm start          # dev server on http://localhost:8080
npm run build      # writes _site/
```

## Layout

```
src/
  posts/           one Markdown file per post; published at /<slug>/
  pages/           standalone pages; published at /<slug>/
  content/images/  mirrored from Ghost, original paths preserved
  _includes/       Nunjucks layouts and partials
  _data/site.json  title, nav, tag names, newsletter embed
  css/style.css
tools/
  convert.mjs      one-off Ghost export -> Markdown converter
```

## Writing a post

Add a Markdown file to `src/posts/`:

```markdown
---
title: "Post title"
date: "2026-08-03T09:00:00.000Z"
excerpt: "One line used in listings, meta description and RSS."
image: "/content/images/2026/08/photo.jpg"
tags: ["posts", "thoughts"]
---

Body text.
```

| Field     | Required | Notes                                                        |
| --------- | -------- | ------------------------------------------------------------ |
| `title`   | yes      | Also the `<title>` and OG title.                              |
| `date`    | yes      | ISO 8601. Sets the ordering; omit and Eleventy guesses.       |
| `tags`    | yes      | Must contain `posts`. Anything else becomes a tag page.       |
| `slug`    | no       | Defaults to the filename, which is the usual case.            |
| `excerpt` | no       | Falls back to the first ~200 characters of the body.          |
| `image`   | no       | Feature image; also the social preview.                       |
| `draft`   | no       | `true` keeps the post out of the build entirely.              |

Tag display names (`thoughts` → `Thoughts`) live in `src/_data/site.json`. A tag
used without an entry there just displays as its slug.

Images go in `src/content/images/<year>/<month>/` and are referenced from the
site root: `/content/images/2026/08/photo.jpg`.

### The loop

```bash
npm start                      # http://localhost:8080, live reloads on save
git add . && git commit -m "New post: title"
git push                       # Actions rebuilds and deploys in ~1 minute
```

Editing on GitHub works too — press `.` in the repo to open the web editor, or
edit a file directly in the GitHub UI. Committing there triggers the same
deploy.

## Newsletter

`src/_data/site.json` has an empty `newsletterEmbed`. Paste the form snippet
from your provider (Buttondown, MailerLite, Kit, …) into it and the signup
block appears at the bottom of every page.

## URLs carried over from Ghost

Post and page slugs, `/tag/<slug>/`, `/rss/` and `/sitemap.xml` all match the
Ghost site. Ghost's `/author/holger/` and `/author/holgerschueler/` pages were
not recreated.

The RSS feed is written to `/rss/index.html` so existing subscriber URLs keep
working; GitHub Pages serves it as `text/html`, which feed readers handle by
sniffing the body. A conventional copy is also written to `/feed.xml`.

## Deployment

`.github/workflows/deploy.yml` builds on every push to `main` and publishes to
GitHub Pages.

While Ghost still serves holgerschueler.com, this site stages at
`https://sneakinhysteria.github.io/`. Canonical tags already point at
holgerschueler.com, so search engines treat the live Ghost site as the original.

### Cutover

1. `git mv tools/CNAME src/static/CNAME` and push. Pages picks the custom
   domain up from the build output; the file must stay in the output on every
   deploy or Pages drops the domain setting.
2. Point DNS at GitHub: apex `holgerschueler.com` to A records
   `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`;
   `www` to a CNAME at `sneakinhysteria.github.io`.
3. Wait for the certificate, then enable "Enforce HTTPS" in the repo's Pages
   settings.

## The Ghost export

`*.ghost.*.json` is gitignored. That file holds Ghost's private keys, session
secrets and user password hashes — keep it out of this repository and off any
public host. `tools/convert.mjs` reads it from the working directory when you
need to re-run the conversion.
