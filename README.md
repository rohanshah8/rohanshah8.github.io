# rohanshah8.github.io

## What this is

Rohan Shah's personal site: a vCard-style portfolio (About, Writing, a 2026
list) plus a blog. It's a plain Jekyll site built for GitHub Pages — there is
no remote theme. Every layout, include, and stylesheet lives in this
repository.

## Structure

| Path | What it is |
| --- | --- |
| `_config.yml` | Site settings: title/url/description, plugins (`jekyll-seo-tag`, `jekyll-sitemap`), permalink style, the `posts` collection, per-type layout defaults, `navigation_header`, the view-counter endpoint, and the `exclude` list. |
| `Gemfile` | Pins the `github-pages` gem, so a local build uses the same Jekyll and plugin versions GitHub Pages runs, plus `webrick` (needed for `jekyll serve` on Ruby 3.x). |
| `_data/profile.yml` | Name, role, tagline, location, email, photo path, and social links — feeds the vCard and the footer. |
| `_data/resume.yml` | Experience and education entries rendered by `resume-timeline.html`. |
| `_layouts/default.html` | Base HTML shell: `<head>`, sticky header (site name, nav, theme toggle), `{{ content }}`, footer, and the two site scripts. Every other layout extends this. |
| `_layouts/home.html` | vCard sidebar plus a "recent writing" list; used by `index.md`. |
| `_layouts/card.html` | Two-column vCard-sidebar shell used by About, Writing, and the 2026 list. |
| `_layouts/post.html` | Sidebar-free layout for a single post: title, subtitle, meta row, prose body, prev/next nav. |
| `_includes/vcard.html` | The photo/name/role/tagline/location/email/socials card. |
| `_includes/site-nav.html` | Top nav links, built from `navigation_header` in `_config.yml`. |
| `_includes/theme-toggle.html` | Markup for the sun/moon/auto button; behaviour lives in `assets/js/theme.js`. |
| `_includes/social-icon.html` | Inline SVG for a social `icon` key (`linkedin`, `github`); falls back to plain text if the key has no icon. |
| `_includes/site-footer.html` | Footer: social icons plus copyright line. |
| `_includes/post-list.html` | Renders a list of posts (title, subtitle/excerpt, meta row); used on Writing and the homepage. |
| `_includes/post-meta.html` | Date, reading time, optional author, and the view count for one post. |
| `_includes/post-nav.html` | Previous/next post links on a post page. |
| `_includes/resume-timeline.html` | Renders `_data/resume.yml` as an experience-and-education timeline. |
| `assets/css/main.scss` | Compiles to `main.css`. Contains no rules itself — just `@import`s the six `_sass/` partials in order. |
| `_sass/_tokens.scss` | Every colour, type, spacing, and layout value, as CSS custom properties, per theme. |
| `_sass/_base.scss` | Element resets, body font/colour, focus states, skip link. |
| `_sass/_layout.scss` | Shell width, header, nav, theme toggle, the two-column page grid, footer, responsive breakpoints. |
| `_sass/_vcard.scss` | vCard styling, including the mobile horizontal-strip layout. |
| `_sass/_prose.scss` | Article/page body typography, plus post title and subtitle sizing. |
| `_sass/_components.scss` | Post list, post meta row, prev/next nav, resume timeline. |
| `assets/js/theme.js` | Theme toggle: cycles light/dark/auto and animates the auto-mode accent hue. |
| `assets/js/views.js` | Fetches (and, on post pages, increments) per-post view counts and writes them into the meta row. |

## Layouts

- **`home`** — the vCard landing page plus a short list of recent writing. Used by `index.md`.
- **`card`** — the general-purpose two-column shell: vCard sidebar on the left, content on the right. Used by About, Writing, and the 2026 list.
- **`post`** — drops the sidebar entirely for a centred, `--measure`-wide (68ch) reading column, with a title/subtitle/meta header and prev/next navigation at the bottom.

## Editing content

**Add a post.** Create `_posts/YYYY-MM-DD-title.md` with front matter:

```yaml
---
layout: post
title: "Your Title"
subtitle: "Optional one-line summary"
date: YYYY-MM-DD
author: Rohan Shah
---
```

Post lists (`post-list.html`, used on Writing and the homepage) show `subtitle`
if it's set, and fall back to the post's `excerpt` if it isn't.

**Publish a draft.** Drafts sit in `_drafts/` (filename without a date) and
are never built. To publish one, move it into `_posts/` and rename it with a
`YYYY-MM-DD-` prefix.

**Change identity.** Edit `_data/profile.yml`. `tagline`, `location`, and
`email` are blank by default — the vCard include omits any field that's
empty, so filling one in is enough; no layout changes needed.

**Change the resume.** Edit `_data/resume.yml` (`experience` and `education`
lists); `resume-timeline.html` renders whatever is there.

**Change navigation.** Edit `navigation_header` in `_config.yml` — each entry
is a `title` and a `url`.

## Theming

Every colour, type, spacing, and layout value is a CSS custom property defined
in `_sass/_tokens.scss`. Other partials reference those tokens; they don't
hard-code values. The three themes (light, dark, auto) are just different
sets of token values, selected by `data-theme` on `<html>`.

Auto mode is handled in `assets/js/theme.js`: it continuously cycles the
`--accent` hue on an animation frame. It pauses when the tab is hidden
(`visibilitychange`) and doesn't animate at all under
`prefers-reduced-motion: reduce` — it just paints one static hue instead.

To move article body copy to a serif, change one line in
`_sass/_tokens.scss`:

```scss
--font-prose: var(--font-sans); /* change to a serif font stack */
```

## Local development

The host running this repo has no usable Ruby toolchain for Jekyll — no Ruby
dev headers and no passwordless sudo, so the native gems in `github-pages`
(eventmachine, commonmarker, ffi, etc.) can't compile. Builds run in Docker
instead, using a Dockerfile that lives outside the repo (in `/tmp/jekyll-gh-build`)
on purpose: a Dockerfile at the repo root would get copied into the published
site by Jekyll.

```bash
export SITE=/local/mnt/workspace/rohan_github/rohanshah8.github.io
export DOCKER_API_VERSION=1.42

# build the image once
DOCKER_BUILDKIT=0 docker build -t jekyll-ghpages:local /tmp/jekyll-gh-build

jbuild() {
  docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp \
    -v "$SITE":/site -w /site jekyll-ghpages:local \
    bundle exec jekyll build --trace "$@"
}

jserve() {
  docker run --rm -it -u "$(id -u):$(id -g)" -e HOME=/tmp \
    -p 4000:4000 -v "$SITE":/site -w /site jekyll-ghpages:local \
    bundle exec jekyll serve --host 0.0.0.0 --trace "$@"
}
```

`DOCKER_API_VERSION=1.42` is required because the Docker CLI on this host is
newer than the daemon it talks to. Jekyll must be invoked via `bundle exec` —
running it bare finds an unactivated `kramdown-parser-gfm` and dies with
`cannot load such file -- kramdown-parser-gfm` on the first markdown file.

## Deployment

Push to `main`. GitHub Pages builds and deploys automatically; there's
nothing to trigger by hand.

## Gotchas

- **`exclude` in `_config.yml` replaces Jekyll's defaults, it doesn't extend
  them.** If you add an entry, keep the existing ones (`Gemfile`,
  `Gemfile.lock`, `vendor`, `node_modules`, `docs`, `README.md`) or they stop
  being excluded. `docs` in particular is load-bearing: without it, Jekyll
  parses the Liquid inside the design docs under `docs/` and the build fails
  outright.
- **View-count keys are derived from post URLs.** `/2026/02/01/welcome/`
  becomes the key `2026-02-01-welcome`. Changing a post's permalink after
  publishing orphans its existing view count under the old key.
- **`assets/css/main.scss` needs its empty `---` front matter.** Without it,
  Jekyll treats the file as a static asset and copies it as-is instead of
  running it through Sass.
- **SCSS partials must live in `_sass/`, not next to `main.scss`.** The
  `jekyll-sass-converter` version pinned by `github-pages` (1.5.2) only
  resolves `@import`s from that load path.
- **A missing or misspelled layout does not fail the build.** The
  `github-pages` gem always makes `jekyll-theme-primer` available as a
  fallback theme, so a typo in a page's `layout:` renders silently with the
  wrong (or no) styling instead of raising an error.
