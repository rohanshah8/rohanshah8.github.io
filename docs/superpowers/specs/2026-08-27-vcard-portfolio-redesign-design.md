# vCard Portfolio Redesign — Design Spec

**Date:** 2026-08-27
**Repo:** `rohanshah8/rohanshah8.github.io`
**Status:** Approved for planning

## 1. Goal

Replace the current garth-derived layout with a self-contained, simple vCard portfolio whose primary job is presenting readable long-form writing. Identity (who Rohan is) and content (what he wrote) should both be visible without a click, and the article reading experience should be uncompromised.

### Non-goals

- No projects/portfolio showcase section (deliberately excluded).
- No contact page; contact lives in the vCard.
- No tags, tag archives, RSS feed, or scroll-progress indicator.
- No pagination until the post count exceeds ~20.
- No new blog content authored as part of this work.

## 2. Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Layout shape | Hybrid: sticky vCard sidebar on pages, no sidebar on posts | Keeps vCard identity without narrowing the reading measure |
| Homepage | vCard landing + recent writing | Identity and content both visible on arrival |
| Sections | About (with resume timeline), Writing, 2026 List | Matches existing content; timeline replaces prose Experience |
| Theme foundation | Self-contained; drop `remote_theme` | 895 lines of overrides already fight the theme for control |
| Preserved features | Light/dark/auto toggle, view counter, reading time | All three explicitly kept |
| Extras | Prev/next post navigation only | Keeps readers moving without adding chrome |
| Body-less posts | Move to `_drafts/` | Live site shows only real content |
| Post list descriptions | `subtitle`, falling back to `excerpt` | Every post has a subtitle; two would yield empty excerpts |

## 3. Current-state findings

These drove several decisions and must be preserved or corrected during implementation.

1. **Two of three posts have no body.** `2026-02-03-How-Zip-Works.md` and `2026-02-06-Overthinking-Trap.md` contain front matter only. `2026-02-01-welcome.md` has 38 words. After drafting, the live site has **one** post.
2. **`jekyll-seo-tag` is inert.** Garth's `_layouts/default.html` never calls `{% seo %}`. The plugin is loaded but emits nothing. The new `default.html` must call it.
3. **`navigation_header` in `_config.yml` is ignored.** Garth's `site-nav.html` iterates `site.pages` and skips entries with `title: false` — which is why `assets/styles.scss` carries that flag. The new nav reads `navigation_header` explicitly.
4. **`.goals-dashboard` (~200 SCSS lines) appears unreferenced.** No layout or include uses it and `list_2026.md` is plain markdown. Confirm before deleting.
5. **View-count keys are derived client-side** by scraping `h2 a` hrefs and `window.location.pathname`. Keys must be reproduced exactly to preserve existing counts (see §8.2).
6. **Post front matter is consistent:** every post has `layout`, `title`, `subtitle`, `date`, `author`. No post uses the configured `<!-- more -->` excerpt separator.

## 4. File structure

```
_config.yml
Gemfile
index.md                 layout: home
about.md                 layout: card,  /about/
writing.md               layout: card,  /writing/          (new)
list_2026.md             layout: card,  /list_2026/
_data/
  profile.yml                                              (new)
  resume.yml                                               (new)
_posts/
  2026-02-01-welcome.md
_drafts/
  2026-02-03-How-Zip-Works.md                              (moved)
  2026-02-06-Overthinking-Trap.md                          (moved)
_layouts/
  default.html           html/head/seo/theme bootstrap/header/footer
  home.html              vCard landing + recent writing
  card.html              two-column: vCard aside + content
  post.html              centered reading column, no sidebar
_includes/
  vcard.html             profile card, renders from _data/profile.yml
  site-nav.html          from _config.yml navigation_header
  theme-toggle.html      button markup only
  post-list.html         reusable list, accepts a limit
  post-meta.html         date / read time / author / views
  post-nav.html          prev + next links
  resume-timeline.html   renders _data/resume.yml
  site-footer.html
assets/
  css/main.scss          @imports the partials below
  css/_tokens.scss       custom properties: color, type, space, layout
  css/_base.scss         reset, base typography, links, focus states
  css/_layout.scss       shell, grid, header, footer
  css/_vcard.scss        card, both full and compact variants
  css/_prose.scss        markdown body typography
  css/_components.scss   post list, timeline, meta, buttons
  js/theme.js            light/dark/auto toggle + accent cycling
  js/views.js            view counter, single implementation
  images/rohan.jpg
docs/superpowers/specs/  design specs (excluded from the build)
```

Deleted: `assets/styles.scss`.

## 5. Data contracts

### `_data/profile.yml`

```yaml
name: Rohan Shah
role: Senior Machine Learning Engineer
tagline: ""            # optional
photo: /assets/images/rohan.jpg
location: ""           # optional
email: ""              # optional
socials:
  - name: LinkedIn
    url: https://www.linkedin.com/in/rohan-shah-50221612a/
    icon: linkedin
  - name: GitHub
    url: https://github.com/rohanshah8
    icon: github
```

`vcard.html` must render nothing at all — no label, no empty row — for any blank or absent field. `tagline`, `location`, and `email` ship blank and are filled in later without touching a layout.

### `_data/resume.yml`

```yaml
experience:
  - role: Senior Machine Learning Engineer
    org: Qualcomm
    dates: ""          # optional; row hidden when blank
    bullets:
      - Model quantization and compression
      - Post-mortem analysis of every op inside the model graph
      - Real-time inference optimization
      - Power-efficient ML deployment
      - AI orchestration for on-device LLMs — RAG, agents, and complex workflows
  - role: Machine Learning Intern
    org: Gojek
    dates: ""
    bullets:
      - Built a production image-moderation system during the IISc master's program
    links:
      - label: How to Moderate Images Based on Text and Logo Using ML/DL
        url: https://medium.com/the-algorithmic-minds/how-to-moderate-images-based-on-text-and-logo-using-ml-dl-f48a7ef173ac
education:
  - degree: Master's, Machine Learning
    org: Indian Institute of Science (IISc), Bangalore
    note: >-
      Thesis on automated rare-disease identification over millions of
      data points, advised by Prof. Rajesh Sundaresan.
    advisor_url: https://eecs.iisc.ac.in/people/rajesh-sundaresan/
```

Icons are inline SVG in `vcard.html`, selected by the `icon` key. Only `linkedin` and `github` are required; an unknown key renders a text link rather than breaking.

**Content correction:** `about.md` currently spells the advisor "Sunderasan" while the link slug reads `rajesh-sundaresan`. Use **Sundaresan**, matching IISc's own URL.

## 6. Layouts

### `default.html`

Owns `<html>`, `<head>`, and the page shell. Responsibilities, in order:

1. `<meta charset>`, `<meta viewport>`
2. Theme bootstrap — the existing inline `localStorage` read that sets `data-theme` on `<html>` **before** any rendering, preventing a flash of the wrong theme. Must stay inline and stay in `<head>`.
3. `{% seo %}` — newly functional.
4. Preconnect + Google Fonts (Inter, JetBrains Mono), then `assets/css/main.css`.
5. Site header: name linking home, `site-nav.html`, `theme-toggle.html`. Sticky. On post pages the nav is suppressed, leaving name + toggle only.
6. `{{ content }}`
7. `site-footer.html`, then `theme.js` and `views.js` deferred.

### `home.html`

vCard beside a heading plus the most recent posts via `{% include post-list.html limit=5 %}`, and a link to `/writing/` when more posts exist than are shown.

### `card.html`

The two-column shell: `layout__aside` holding `vcard.html`, `layout__main` holding `{{ content }}` wrapped in `.prose`. Used by About, Writing, and 2026 List.

### `post.html`

No sidebar. Single centered column:

- `.post__header` — title, subtitle when present, then a meta row of date · read time · author · views
- `.post__body.prose` — `{{ content }}`
- `post-nav.html` — prev/next

Reading time keeps the existing rule: under 200 words renders "1 min read", otherwise `words / 200`. When a post has no body, suppress the read time rather than printing "1 min read" for an empty page.

## 7. CSS architecture

Single entry point `assets/css/main.scss` importing six partials. No SCSS nesting deeper than three levels. Colors, spacing, and type sizes are referenced only through custom properties so the theme switch is a token swap.

### Tokens

```
Light                          Dark
--bg           #ffffff         #14141b
--bg-subtle    #f7f8fa         #1b1c25
--bg-card      #ffffff         #1b1c25
--header-bg    rgba(255,255,255,.85)   rgba(20,20,27,.85)
--border       #e6e9ee         #2a2c38
--text         #16161d         #e6e6ea
--text-secondary #4a4f5c       #a6a9b6
--text-muted   #878d9a         #6e7280
--accent       #ff6b35         #ff8c5a
--accent-hover #e2521d         #ffa478
--accent-soft  rgba(255,107,53,.08)    rgba(255,140,90,.10)
```

Type scale, 1.25 ratio on a 1.125rem base: `--step--1: .875rem`, `--step-0: 1.125rem`, `--step-1: 1.375rem`, `--step-2: 1.75rem`, `--step-3: 2.25rem`, `--step-4: 2.75rem`.

Layout: `--measure: 68ch`, `--sidebar-w: 300px`, `--shell-max: 1100px`, `--gutter: clamp(1.25rem, 4vw, 3rem)`, `--header-h: 60px`.

Fonts: `--font-sans` (Inter), `--font-mono` (JetBrains Mono), and `--font-prose` defaulting to `--font-sans`. Switching article body copy to a serif is then a one-line token change.

### Class inventory

New: `.shell`, `.site-header`, `.site-name`, `.site-nav`, `.site-nav__link`, `.site-nav__link--current`, `.theme-toggle`, `.layout--card`, `.layout__aside`, `.layout__main`, `.vcard` (+ `__photo __name __role __tagline __meta __socials`, and a `--compact` variant), `.postlist` (+ `__item __title __subtitle __meta`), `.post` (+ `__header __title __subtitle __meta __body __nav`), `.prose`, `.timeline` (+ `__item __role __org __dates __bullets`), `.site-footer` (+ `__socials __copyright`), `.meta-dot`.

Retired with garth: `article`, `article--page`, `content`, `main`, `typeset`, `small`, `time`, `list`, `list--posts`, `item`, `item--post`, `item--nav`, `nav`, `header-right`, `post-article`, `post-header`, `post-title`, `post-subtitle`, `post-body`, `post-meta-bar`, `post-meta`, `footer`, `footer-social-links`, `copyright`, `goals-dashboard`, `profile-intro`, `profile-photo`, `profile-text`, `connect-bar`, `connect-btn`.

The icon classes `.icon-sun`, `.icon-moon`, `.icon-auto` are **kept unchanged** — `theme.js` and the CSS visibility rules both key off them.

### Reading typography (`_prose.scss`)

- `max-width: var(--measure)`; body `var(--step-0)` at `line-height: 1.7`
- `h2` gets `margin-top: 2.5em` against `margin-bottom: .6em`, so sections separate visually
- Links: `color: var(--accent)`, `text-decoration: underline`, `text-underline-offset: .18em`, `text-decoration-thickness: .07em`. No background highlight.
- Blockquote: `border-left: 3px solid var(--accent-soft)`, padding-left, `color: var(--text-secondary)`, no forced italics
- `pre`: `overflow-x: auto`, never wraps; `code` inline gets `--bg-subtle` and `.9em`
- Images: full column width, `border-radius: 8px`; a trailing `<em>` on its own line styles as a caption
- `hr`: hairline in `--border` with generous vertical margin

### Responsive

| Width | Behavior |
| --- | --- |
| ≥ 1024px | Two columns `var(--sidebar-w) minmax(0, 1fr)`, gutter gap, sticky aside at `top: calc(var(--header-h) + 2rem)`, `align-self: start` |
| 900–1023px | Same two columns, sidebar narrows to 260px |
| < 900px | Single column. `.vcard--compact`: photo left at 72px, name/role right, socials in a row beneath. Content follows. |
| < 480px | Gutter floors at 1.25rem; prose drops to `1.0625rem / 1.65` |

Post pages ignore all of this and simply center `--measure` inside the gutter.

## 8. JavaScript

Both files are plain ES5-compatible IIFEs, no build step, loaded `defer`.

### 8.1 `theme.js`

Preserves today's behavior exactly: cycles `light → dark → auto` on click, persists to `localStorage` under the existing key **`site-theme`**, and sets `data-theme` on `<html>`.

Auto mode continues to rotate the accent hue via `requestAnimationFrame`, writing `--accent`, `--accent-hover`, and `--accent-soft` as inline custom properties, and removing those inline values when leaving auto. The old script also wrote `--border-card-hover`; that token belonged to garth's card-hover styling and is not part of the new token set, so it is dropped. Two additions:

- Pause the loop on `document.hidden` (`visibilitychange`), resume on return.
- When `prefers-reduced-motion: reduce` matches, pick one static hue instead of animating.

Visually identical for a user watching the tab; no CPU burn in a background tab.

### 8.2 `views.js` — counter consolidation

Replaces ~120 lines of inline JS duplicated across `home.html` and `post.html` with one implementation driven by markup attributes:

```html
<span data-views data-views-key="2026-02-01-welcome" data-views-mode="increment">…</span>
```

- `data-views-mode="increment"` (post pages) calls `…/{key}/up`
- absent or `"read"` (list items) reads without incrementing
- HTTP 404 resolves to `0`, matching today's homepage behavior
- Any other failure hides the element and its preceding `.meta-dot`

The key is emitted by Liquid at build time rather than scraped from the DOM, removing the fragile href parsing. The key must reproduce the existing algorithm — strip `.html`, strip leading/trailing slashes, replace `/`, `.`, `_` with `-`, lowercase — via:

```liquid
{% assign vkey = page.url | split: '/' | join: '-' | remove_first: '-' | replace: '.', '-' | replace: '_', '-' | downcase %}
```

**Required verification:** for `/2026/02/01/welcome/` this must produce exactly `2026-02-01-welcome`. Confirm against the built HTML before pushing; if it differs, existing counts orphan. Endpoint and project slug stay `https://api.counterapi.dev/v1/rohanshah8-github-io/`.

## 9. Content migration

- **`about.md`** — strip the inline `profile-intro` and `connect-bar` HTML blocks; the vCard now supplies photo, name, role, and socials. Keep prose Background and Interests. Experience becomes `{% include resume-timeline.html %}` fed by `_data/resume.yml`. Apply the Sundaresan spelling fix.
- **`writing.md`** — new, `layout: card`, `permalink: /writing/`, title "Writing", body is `{% include post-list.html %}` with no limit.
- **`list_2026.md`** — content unchanged; verify it renders correctly under `.prose` and that no `.goals-dashboard` markup is needed.
- **`_posts` → `_drafts`** — move the two body-less files, front matter intact. Filenames keep their date prefixes; front-matter `date` governs regardless. They stop building, so `/2026/02/03/…` and `/2026/02/06/…` 404 and their counter keys go dormant until restored.
- **`README.md`** — rewrite. The current version documents garth, remote themes, and override mechanics that will no longer exist.

## 10. Configuration

`_config.yml`:

- Remove `remote_theme`, `jekyll-remote-theme`, `jekyll-paginate`, `paginate`, `paginate_path`.
- Keep `jekyll-seo-tag`, `jekyll-sitemap`, `permalink: pretty`, `timezone`, `title`, `description`, `url`, `baseurl`, `lang`, `encoding`.
- Keep the `posts` collection block and the `pages`/`posts` layout defaults, changing the page default to `card`.
- Keep `navigation_header`, now actually consumed: About → `/about/`, Writing → `/writing/`, 2026 List → `/list_2026/`.
- Add `exclude:` listing `docs`, `README.md`, `Gemfile`, `Gemfile.lock`, `vendor`, `node_modules`. Setting `exclude` replaces Jekyll's defaults, so the standard entries must be restated. `docs` matters because this spec would otherwise publish to the live site.
- Drop `excerpt_separator`; no post uses it and post lists render `subtitle` instead.

`Gemfile`: replace individual gems with `gem "github-pages", group: :jekyll_plugins` so local builds match GitHub's actual build environment, plus `gem "webrick"` for local serving on Ruby 3.x.

## 11. Compatibility

| Surface | Change |
| --- | --- |
| `/`, `/about/`, `/list_2026/` | Unchanged |
| `/writing/` | New |
| `/2026/02/01/welcome/` | Unchanged — view count preserved |
| Two drafted posts | Removed from the live site; counts dormant |
| `/assets/styles.css` | Removed; replaced by `/assets/css/main.css` |
| `localStorage` key `site-theme` | Unchanged — returning visitors keep their theme |
| Counter project slug | Unchanged |

## 12. Verification

A static Jekyll site has no unit-test surface, so verification is a build plus a manual matrix.

1. `bundle exec jekyll build` completes with no Liquid warnings or errors.
2. `bundle exec jekyll serve` and walk `/`, `/about/`, `/writing/`, `/list_2026/`, `/2026/02/01/welcome/`.
3. Each page in all three themes: light, dark, auto. Confirm no flash of the wrong theme on hard reload, and that auto stops animating when the tab is hidden.
4. Each page at 1440px, 900px, and 375px. Confirm the sidebar goes sticky on desktop and compact under 900px, and that the post page has no sidebar at any width.
5. Confirm the generated `data-views-key` for the welcome post equals `2026-02-01-welcome`, and that the network call fires (`/up` on the post, plain read on lists).
6. Confirm `{% seo %}` emits `<title>`, description, and Open Graph tags in the built HTML.
7. Confirm the built `_site` contains no `docs/` directory.
8. Confirm the drafted posts are absent from `_site` and from `sitemap.xml`.

## 13. Phasing

Each phase leaves the site in a working state — buildable, and with no layout referencing an asset that does not yet exist.

| Phase | Work | Model |
| --- | --- | --- |
| 1 | `_config.yml`, `Gemfile`, `default.html`, `site-nav.html`, `theme-toggle.html`, `theme.js`, `_tokens`, `_base`, `_layout`; delete `styles.scss` and garth. Site builds, plain but correct, toggle working. | Opus |
| 2 | `_data/*.yml`, `vcard.html`, `resume-timeline.html`, `card.html`, `home.html`, `post-list.html`, `_vcard.scss` | Opus |
| 3 | `post.html`, `post-meta.html`, `post-nav.html`, `views.js`, `_prose.scss` | Opus |
| 4 | `about.md` migration, `writing.md`, `list_2026.md` check, move drafts | Sonnet |
| 5 | `_components.scss` — post list, timeline, meta, footer, buttons | Opus |
| 6 | Dead-CSS confirmation, front-matter and link validation, build smoke test | Haiku |
| 7 | `README.md` rewrite | Sonnet |
| 8 | Full §12 verification, then commit and push | Opus |

`theme.js` lands in phase 1 because `default.html` ships the toggle button in the header from the start. `views.js` lands in phase 3 alongside the markup that carries `data-views`.

## 14. Risks

| Risk | Mitigation |
| --- | --- |
| View-count key drift orphans existing counts | Explicit verification step (§12.5) before push |
| `exclude:` override drops Jekyll defaults, publishing `Gemfile` or `docs` | Restate all default entries; assert `_site` has no `docs/` (§12.7) |
| `github-pages` gem pins a different Jekyll than 3.9, shifting behavior | Full build + visual matrix after the Gemfile swap in phase 1 |
| Sticky sidebar overlaps the sticky header | `top: calc(var(--header-h) + 2rem)`; check at 900px and 1440px |
| Live site left with one post looks empty | Accepted; homepage copy should read acceptably with a single entry |
| Deleting `.goals-dashboard` breaks the 2026 page | Confirm unreferenced in phase 6 before deleting |

## 15. Open items

Non-blocking. All three are single-line edits to `_data/profile.yml` whenever Rohan supplies values; the card omits blanks until then.

1. `email`
2. `location`
3. `tagline` under the role line
4. `dates` for the Qualcomm and Gojek entries in `_data/resume.yml`
