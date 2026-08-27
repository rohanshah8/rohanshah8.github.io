# vCard Portfolio Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the garth remote theme with a self-contained Jekyll layout — a sticky vCard sidebar on pages, a sidebar-free 68ch reading column on posts — driven by `_data` files and one stylesheet.

**Architecture:** Four layouts (`default`, `home`, `card`, `post`) over eight includes. All colour, type, and spacing values live in CSS custom properties in `_tokens.scss`, so the light/dark/auto switch is a token swap rather than duplicated rules. Profile and resume content moves out of hand-written HTML into `_data/profile.yml` and `_data/resume.yml`. Two vanilla-JS files handle theming and view counts, both driven by markup attributes rather than DOM scraping.

**Tech Stack:** Jekyll (via the `github-pages` gem), SCSS through Jekyll's built-in Sass converter, vanilla ES5 JavaScript, no build step beyond Jekyll itself.

**Spec:** `docs/superpowers/specs/2026-08-27-vcard-portfolio-redesign-design.md`

---

## Environment: how to build and verify

The host cannot run Jekyll. Ruby 3.0.2 and `gem` are present, but Ruby dev headers are missing and there is no passwordless sudo, so the native extensions in the `github-pages` gem set (`eventmachine`, `http_parser.rb`, `commonmarker`, `ffi`) cannot compile. Docker is available and working, so every build runs in a container built from `/tmp/jekyll-gh-build/Dockerfile` as image `jekyll-ghpages:local`. That image carries `github-pages` 232 — Jekyll 3.10.0 on Ruby 3.1.7, matching GitHub's own build.

The image is deliberately **not** stored in the repo — a `Dockerfile` at the repo root would be copied into the published site.

**Three environment quirks on this host, all already accounted for below. Each one was hit and fixed during plan validation:**

1. The Docker CLI is newer than the daemon (client API 1.52 against a 1.42 maximum). Every `docker` invocation needs `DOCKER_API_VERSION=1.42` exported, and `docker build` additionally needs `DOCKER_BUILDKIT=0`. Without these it fails with `client version 1.52 is too new`.
2. **Jekyll must run under `bundle exec`.** Invoking `jekyll` bare fails on the first markdown file with `cannot load such file -- kramdown-parser-gfm`, even though that gem is installed — running outside Bundler leaves it unactivated. The image carries its own `/gems/Gemfile` and sets `BUNDLE_GEMFILE`, so `bundle exec` works from any directory.
3. Piping `docker build` into `tail` hides failures, because a pipeline reports the exit status of its last command. Use `set -o pipefail` or check `${PIPESTATUS[0]}` when you care whether a build succeeded. A build reported "exit code 0" this way while actually having failed.

**Paste this once per shell session.** Every task below refers to `jbuild` and `jserve`, defined here:

```bash
export SITE=/local/mnt/workspace/rohan_github/rohanshah8.github.io
export DOCKER_API_VERSION=1.42

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

When a build fails, read the **head** of the output, not the tail — Jekyll's `--trace` backtrace buries the actual message dozens of lines above the end.

If `jekyll-ghpages:local` is missing, rebuild it:

```bash
DOCKER_API_VERSION=1.42 DOCKER_BUILDKIT=0 docker build -t jekyll-ghpages:local /tmp/jekyll-gh-build
```

**Testing approach.** A static site has no unit-test surface, so the red/green loop asserts against generated HTML in `_site/`. Each task writes a `grep` assertion first, runs it to watch it fail, implements, then runs it again to watch it pass. Assertions use `grep -q` with an explicit echo so the result is unambiguous:

```bash
grep -q 'PATTERN' _site/index.html && echo PASS || echo FAIL
```

Work happens on branch `redesign/vcard-portfolio`, already pushed. Commit after every task.

---

## File structure

| File | Responsibility |
| --- | --- |
| `_config.yml` | Site metadata, plugins, nav source, view-counter endpoint, build excludes |
| `Gemfile` | Pin to GitHub Pages' actual gem set |
| `_data/profile.yml` | vCard content — the single source for identity |
| `_data/resume.yml` | Experience + education entries for the timeline |
| `_layouts/default.html` | Document shell: head, SEO, theme bootstrap, header, footer, scripts |
| `_layouts/home.html` | vCard landing + recent writing |
| `_layouts/card.html` | Two-column shell for About / Writing / 2026 |
| `_layouts/post.html` | Centred reading column, no sidebar |
| `_includes/vcard.html` | Renders `_data/profile.yml`; omits blank fields |
| `_includes/site-nav.html` | Renders `navigation_header` |
| `_includes/theme-toggle.html` | Toggle button markup |
| `_includes/site-footer.html` | Socials + copyright |
| `_includes/post-list.html` | Reusable post list, optional `limit` |
| `_includes/post-meta.html` | Date / read time / author / views for one post |
| `_includes/post-nav.html` | Prev + next post links |
| `_includes/resume-timeline.html` | Renders `_data/resume.yml` |
| `assets/css/main.scss` | Entry point; imports the six partials |
| `assets/css/_tokens.scss` | Custom properties for all three themes |
| `assets/css/_base.scss` | Reset, base type, links, focus |
| `assets/css/_layout.scss` | Shell, two-column grid, header, footer |
| `assets/css/_vcard.scss` | Card, full and compact variants |
| `assets/css/_prose.scss` | Article body typography |
| `assets/css/_components.scss` | Post list, timeline, meta, post nav |
| `assets/js/theme.js` | light/dark/auto toggle + accent cycling |
| `assets/js/views.js` | View counter for both read and increment modes |

Deleted: `assets/styles.scss`.

---

## Task 1: Stop Jekyll parsing the docs, then baseline the build

Establishes a working baseline before anything changes, so later failures are attributable.

**This task must come first, and its `exclude` step must come before the first build.** `_config.yml` currently has no `exclude`, so Jekyll treats `docs/**/*.md` as content and executes the Liquid inside this plan's own code blocks. The build dies with:

```
Liquid Exception: Could not locate the included file 'theme-toggle.html' ...
  in docs/superpowers/plans/2026-08-27-vcard-portfolio-redesign.md
```

So the `exclude` key is not merely about keeping the spec off the live site — without it the repository cannot build at all while these documents exist.

**Files:**
- Modify: `_config.yml` (add `exclude` only)
- Modify: `.gitignore`

- [ ] **Step 1: Confirm the image exists**

```bash
docker image inspect jekyll-ghpages:local >/dev/null 2>&1 && echo PRESENT || echo MISSING
```

Expected: `PRESENT`. If `MISSING`, run the `docker build` line from the Environment section.

- [ ] **Step 2: Reproduce the failure**

```bash
cd "$SITE" && jbuild 2>&1 | head -12
```

Expected: the `Liquid Exception` shown above, naming this plan file.

- [ ] **Step 3: Append `exclude` to `_config.yml`**

Add at the end of the existing file. Task 2 rewrites the whole config and restates this block; it is added early here purely so the site can build.

```yaml

# Setting `exclude` REPLACES Jekyll's defaults, so the standard entries are
# restated here. `docs` is load-bearing: without it Jekyll parses the Liquid
# inside the spec and plan markdown and the build fails outright.
exclude:
  - Gemfile
  - Gemfile.lock
  - vendor
  - node_modules
  - docs
  - README.md
```

- [ ] **Step 4: Build the current site**

```bash
jbuild
```

Expected: `done in N seconds`, exit 0. A `Pagination: ... couldn't find an index.html page` warning is expected and disappears in Task 2. The remote theme is fetched over the network, so this needs connectivity.

- [ ] **Step 5: Record the baseline**

```bash
ls _site/ && ls -d _site/2026/02/*/*/
```

Expected: `index.html`, `about`, `list_2026`, `assets`, `sitemap.xml`, `robots.txt`, and three post directories. Note that slugs preserve case — `_site/2026/02/03/How-Zip-Works/` — which is why the view-key filter's `downcase` matters.

- [ ] **Step 6: Confirm docs and README stay out of the build**

```bash
test -d _site/docs && echo "LEAKED" || echo "DOCS EXCLUDED"
ls _site/README.md 2>/dev/null && echo LEAKED || echo CLEAN
```

Expected: `DOCS EXCLUDED` then `CLEAN`.

- [ ] **Step 7: Confirm no SEO tags today**

```bash
grep -qi 'og:title' _site/index.html && echo "SEO PRESENT" || echo "SEO ABSENT (expected)"
```

Expected: `SEO ABSENT (expected)` — garth never calls `{% seo %}`. Task 3 fixes this.

- [ ] **Step 8: Ignore build output in git**

Append to `.gitignore` if not already present:

```
_site/
.jekyll-cache/
.jekyll-metadata
```

- [ ] **Step 9: Commit**

```bash
git add .gitignore _config.yml
git commit -m "fix: exclude docs from the build so jekyll stops parsing the spec"
```

---

## Task 2: Replace `_config.yml` and `Gemfile`

**Files:**
- Modify: `_config.yml` (full rewrite)
- Modify: `Gemfile` (full rewrite)

- [ ] **Step 1: Write the assertion**

```bash
cd "$SITE" && grep -q 'remote_theme' _config.yml && echo "GARTH STILL PRESENT" || echo "GARTH GONE"
```

Expected: `GARTH STILL PRESENT`.

- [ ] **Step 2: Rewrite `_config.yml`**

```yaml
title: Rohan Shah
url: "https://rohanshah8.github.io"
baseurl: ""
description: >-
  My personal blog where I share thoughts on technology, life, and building things.

plugins:
  - jekyll-seo-tag
  - jekyll-sitemap

permalink: pretty
timezone: America/New_York
encoding: utf-8
lang: en-US

collections:
  posts:
    title: Writing
    output: true

defaults:
  - scope:
      path: ""
      type: pages
    values:
      layout: card
  - scope:
      path: ""
      type: posts
    values:
      layout: post

navigation_header:
  - title: About
    url: /about/
  - title: Writing
    url: /writing/
  - title: 2026 List
    url: /list_2026/

# Consumed by assets/js/views.js via data attributes.
views:
  endpoint: "https://api.counterapi.dev/v1/rohanshah8-github-io"

# Setting `exclude` REPLACES Jekyll's defaults, so the standard entries are
# restated here. `docs` matters most: without it the design spec publishes
# to the live site.
exclude:
  - Gemfile
  - Gemfile.lock
  - vendor
  - node_modules
  - docs
  - README.md
```

Removed versus the old file: `remote_theme`, `jekyll-remote-theme`, `jekyll-paginate`, `paginate`, `paginate_path`, `excerpt_separator`, and the collection `description`.

- [ ] **Step 3: Rewrite `Gemfile`**

```ruby
source "https://rubygems.org"

# Pins the exact Jekyll and plugin versions GitHub Pages runs, so a clean
# local build means a clean build on GitHub.
gem "github-pages", group: :jekyll_plugins

# Ruby 3.x dropped webrick from stdlib; `jekyll serve` needs it.
gem "webrick", "~> 1.8"
```

- [ ] **Step 4: Run the assertion**

```bash
grep -q 'remote_theme' _config.yml && echo "GARTH STILL PRESENT" || echo "GARTH GONE"
```

Expected: `GARTH GONE`.

- [ ] **Step 5: Build — expect layout warnings**

```bash
jbuild
```

Expected: the build **completes** rather than hard-failing, but emits `Build Warning: Layout 'default' requested ... does not exist` for every page, and the output HTML is unwrapped content with no `<head>`. Jekyll treats a missing layout as a warning, not an error. Task 3 closes this gap. Record the warning text.

- [ ] **Step 6: Commit**

```bash
git add _config.yml Gemfile
git commit -m "feat: drop garth remote theme, pin github-pages gem"
```

---

## Task 3: Build the document shell

**Files:**
- Create: `_layouts/default.html`
- Create: `_includes/site-nav.html`
- Create: `_includes/theme-toggle.html`
- Modify: `_includes/site-footer.html`

- [ ] **Step 1: Write the assertion**

```bash
cd "$SITE" && jbuild >/dev/null 2>&1; grep -qi 'og:title' _site/index.html && echo PASS || echo FAIL
```

Expected: `FAIL`.

- [ ] **Step 2: Create `_layouts/default.html`**

```html
<!DOCTYPE html>
<html lang="{{ site.lang | default: 'en-US' }}" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <script>
    /* Runs before first paint so there is no flash of the wrong theme.
       Must stay inline and stay here. */
    (function () {
      try {
        var t = localStorage.getItem('site-theme') || 'light';
        document.documentElement.setAttribute('data-theme', t);
      } catch (e) {}
    })();
  </script>

  {% seo %}

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
  <link rel="stylesheet" href="{{ '/assets/css/main.css' | relative_url }}">
</head>
<body>

<a class="skip-link" href="#content">Skip to content</a>

<header class="site-header">
  <div class="shell site-header__inner">
    <a class="site-name" href="{{ '/' | relative_url }}">{{ site.title }}</a>
    <div class="site-header__right">
      {% unless page.layout == 'post' %}{% include site-nav.html %}{% endunless %}
      {% include theme-toggle.html %}
    </div>
  </div>
</header>

{{ content }}

{% include site-footer.html %}

<script src="{{ '/assets/js/theme.js' | relative_url }}" defer></script>
<script src="{{ '/assets/js/views.js' | relative_url }}" defer></script>
</body>
</html>
```

- [ ] **Step 3: Create `_includes/site-nav.html`**

```html
<nav class="site-nav" aria-label="Main">
  {% for item in site.navigation_header %}
    <a class="site-nav__link{% if page.url == item.url %} site-nav__link--current{% endif %}"
       href="{{ item.url | relative_url }}">{{ item.title }}</a>
  {% endfor %}
</nav>
```

- [ ] **Step 4: Create `_includes/theme-toggle.html`**

The three icon classes are load-bearing: `theme.js` and the CSS visibility rules both key off `icon-sun`, `icon-moon`, and `icon-auto`. Do not rename them.

```html
<button id="theme-toggle" class="theme-toggle" aria-label="Toggle theme" title="Toggle theme">
  <svg class="icon-sun" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
  <svg class="icon-moon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
  <svg class="icon-auto" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 2a10 10 0 0 1 0 20" fill="currentColor" stroke="none"/>
  </svg>
</button>
```

- [ ] **Step 5: Rewrite `_includes/site-footer.html`**

Socials now come from `_data/profile.yml`, created in Task 6. Until then the loop renders nothing, which is fine.

```html
<footer class="site-footer">
  <div class="shell site-footer__inner">
    {% if site.data.profile.socials %}
    <ul class="site-footer__socials">
      {% for s in site.data.profile.socials %}
      <li>
        <a href="{{ s.url }}" target="_blank" rel="noopener noreferrer" aria-label="{{ s.name }}">{{ s.name }}</a>
      </li>
      {% endfor %}
    </ul>
    {% endif %}
    <p class="site-footer__copyright">&copy; {{ site.title }} {{ site.time | date: '%Y' }}</p>
  </div>
</footer>
```

- [ ] **Step 6: Run the assertion**

```bash
jbuild && grep -qi 'og:title' _site/index.html && echo PASS || echo FAIL
```

Expected: `PASS` — `{% seo %}` now emits Open Graph tags for the first time.

- [ ] **Step 7: Assert the nav comes from config**

```bash
grep -q 'href="/writing/"' _site/index.html && echo PASS || echo FAIL
```

Expected: `PASS`. The `/writing/` page doesn't exist until Task 12; the nav link is still rendered.

- [ ] **Step 8: Commit**

```bash
git add _layouts/default.html _includes/site-nav.html _includes/theme-toggle.html _includes/site-footer.html
git commit -m "feat: self-contained document shell with working seo tags"
```

---

## Task 4: Stylesheet foundation

**Files:**
- Create: `assets/css/main.scss`, `_tokens.scss`, `_base.scss`, `_layout.scss`
- Delete: `assets/styles.scss`

Jekyll compiles `main.scss` to `/assets/css/main.css` because of its front matter. Partials prefixed `_` are not emitted directly.

**Import resolution risk.** Jekyll's Sass converter adds `_sass/` to the load path, but Sass also resolves relative to the importing file, so `@import "tokens"` inside `assets/css/main.scss` should find `assets/css/_tokens.scss`. If Step 8 fails with `File to import not found or unreadable`, the fix is to move all six partials to a top-level `_sass/` directory and leave `main.scss` where it is — the `@import` lines need no change. Do not add a `sass:` block to `_config.yml` for this; the default `sass_dir` of `_sass` is what the fallback relies on.

- [ ] **Step 1: Write the assertion**

```bash
cd "$SITE" && test -f _site/assets/css/main.css && echo PASS || echo FAIL
```

Expected: `FAIL`.

- [ ] **Step 2: Create `assets/css/main.scss`**

The front matter is required — without it Jekyll copies the file verbatim instead of compiling it.

```scss
---
---

@import "tokens";
@import "base";
@import "layout";
@import "vcard";
@import "prose";
@import "components";
```

- [ ] **Step 3: Create the five remaining partials as empty stubs**

`main.scss` imports all six; a missing partial fails the build. Create `_vcard.scss`, `_prose.scss`, and `_components.scss` containing only a comment for now — Tasks 6, 9, and 14 fill them.

```bash
cd "$SITE/assets/css"
echo '/* filled in Task 6 */'  > _vcard.scss
echo '/* filled in Task 9 */'  > _prose.scss
echo '/* filled in Task 14 */' > _components.scss
```

- [ ] **Step 4: Create `assets/css/_tokens.scss`**

```scss
/* All themes are a swap of these custom properties. Rules elsewhere in the
   stylesheet must reference the tokens, never raw colour values. */

:root,
[data-theme="light"] {
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  /* Swap this one line to put article body copy in a serif. */
  --font-prose: var(--font-sans);

  --step--1: 0.875rem;
  --step-0:  1.125rem;
  --step-1:  1.375rem;
  --step-2:  1.75rem;
  --step-3:  2.25rem;
  --step-4:  2.75rem;

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
  --space-7: 3rem;
  --space-8: 4rem;

  --measure: 68ch;
  --sidebar-w: 300px;
  --shell-max: 1100px;
  --gutter: clamp(1.25rem, 4vw, 3rem);
  --header-h: 60px;
  --radius: 8px;

  --bg: #ffffff;
  --bg-subtle: #f7f8fa;
  --bg-card: #ffffff;
  --header-bg: rgba(255, 255, 255, 0.85);
  --border: #e6e9ee;
  --text: #16161d;
  --text-secondary: #4a4f5c;
  --text-muted: #878d9a;
  --accent: #ff6b35;
  --accent-hover: #e2521d;
  --accent-soft: rgba(255, 107, 53, 0.08);
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.04);
}

[data-theme="dark"] {
  --bg: #14141b;
  --bg-subtle: #1b1c25;
  --bg-card: #1b1c25;
  --header-bg: rgba(20, 20, 27, 0.85);
  --border: #2a2c38;
  --text: #e6e6ea;
  --text-secondary: #a6a9b6;
  --text-muted: #6e7280;
  --accent: #ff8c5a;
  --accent-hover: #ffa478;
  --accent-soft: rgba(255, 140, 90, 0.10);
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.25);
}

/* Auto starts from the light palette; theme.js overwrites the accent
   tokens inline on each animation frame. */
[data-theme="auto"] {
  --bg: #ffffff;
  --bg-subtle: #f7f8fa;
  --bg-card: #ffffff;
  --header-bg: rgba(255, 255, 255, 0.85);
  --border: #e6e9ee;
  --text: #16161d;
  --text-secondary: #4a4f5c;
  --text-muted: #878d9a;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.04);
}
```

- [ ] **Step 5: Create `assets/css/_base.scss`**

```scss
*, *::before, *::after { box-sizing: border-box; }

html { -webkit-text-size-adjust: 100%; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: var(--step-0);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4 {
  margin: 0 0 var(--space-4);
  line-height: 1.25;
  font-weight: 700;
  letter-spacing: -0.015em;
}

h1 { font-size: var(--step-3); }
h2 { font-size: var(--step-2); }
h3 { font-size: var(--step-1); }

p { margin: 0 0 var(--space-4); }

a {
  color: var(--accent);
  text-decoration: none;
  transition: color 0.15s ease;
}
a:hover { color: var(--accent-hover); }

img { max-width: 100%; height: auto; }

ul, ol { margin: 0 0 var(--space-4); padding-left: 1.25em; }

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 2px;
}

.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  padding: var(--space-3) var(--space-4);
  background: var(--bg-card);
  color: var(--text);
  z-index: 100;
}
.skip-link:focus { left: var(--space-4); top: var(--space-4); }
```

- [ ] **Step 6: Create `assets/css/_layout.scss`**

```scss
.shell {
  width: 100%;
  max-width: var(--shell-max);
  margin: 0 auto;
  padding-inline: var(--gutter);
}

/* ---- Header ---- */

.site-header {
  position: sticky;
  top: 0;
  z-index: 50;
  height: var(--header-h);
  display: flex;
  align-items: center;
  background: var(--header-bg);
  backdrop-filter: saturate(180%) blur(12px);
  border-bottom: 1px solid var(--border);
}

.site-header__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.site-name {
  font-weight: 700;
  font-size: var(--step-0);
  color: var(--text);
  letter-spacing: -0.02em;
}
.site-name:hover { color: var(--accent); }

.site-header__right {
  display: flex;
  align-items: center;
  gap: var(--space-5);
}

.site-nav {
  display: flex;
  gap: var(--space-5);
}

.site-nav__link {
  font-size: var(--step--1);
  font-weight: 500;
  color: var(--text-secondary);
}
.site-nav__link:hover { color: var(--accent); }
.site-nav__link--current { color: var(--text); font-weight: 600; }

/* ---- Theme toggle ---- */

.theme-toggle {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}
.theme-toggle:hover { color: var(--accent); border-color: var(--accent); }

/* Exactly one icon shows, chosen by the active theme. */
.theme-toggle svg { display: none; grid-area: 1 / 1; }
[data-theme="light"] .icon-sun,
html:not([data-theme]) .icon-sun,
[data-theme="dark"] .icon-moon,
[data-theme="auto"] .icon-auto { display: block; }

/* ---- Two-column page grid ---- */

.layout--card {
  display: grid;
  grid-template-columns: var(--sidebar-w) minmax(0, 1fr);
  gap: var(--gutter);
  align-items: start;
  padding-block: var(--space-7) var(--space-8);
}

.layout__aside {
  position: sticky;
  top: calc(var(--header-h) + var(--space-6));
  align-self: start;
}

.layout__main { min-width: 0; }

.page-title { margin-bottom: var(--space-6); }

@media (max-width: 1023px) {
  :root { --sidebar-w: 260px; }
}

@media (max-width: 899px) {
  .layout--card {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-6);
    padding-block: var(--space-5) var(--space-7);
  }
  .layout__aside { position: static; top: auto; }
}

/* ---- Footer ---- */

.site-footer {
  border-top: 1px solid var(--border);
  padding-block: var(--space-6);
  margin-top: var(--space-8);
}

.site-footer__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.site-footer__socials {
  display: flex;
  gap: var(--space-5);
  margin: 0;
  padding: 0;
  list-style: none;
}

.site-footer__copyright {
  margin: 0;
  font-size: var(--step--1);
  color: var(--text-muted);
}
```

- [ ] **Step 7: Delete the old stylesheet**

```bash
cd "$SITE" && git rm assets/styles.scss
```

- [ ] **Step 8: Run the assertion**

```bash
jbuild && test -f _site/assets/css/main.css && echo PASS || echo FAIL
```

Expected: `PASS`.

- [ ] **Step 9: Confirm tokens compiled through**

```bash
grep -q -- '--measure: 68ch' _site/assets/css/main.css && echo PASS || echo FAIL
```

Expected: `PASS`.

- [ ] **Step 10: Confirm the old stylesheet is gone**

```bash
test -f _site/assets/styles.css && echo "STILL THERE" || echo "REMOVED"
```

Expected: `REMOVED`.

- [ ] **Step 11: Commit**

```bash
git add assets/css/
git commit -m "feat: token-based stylesheet foundation, drop garth styles"
```

---

## Task 5: Theme toggle script

**Files:**
- Create: `assets/js/theme.js`

Behaviour must match the current site exactly: click cycles `light → dark → auto`, the choice persists under the existing `localStorage` key `site-theme` so returning visitors keep their setting, and auto rotates the accent hue. Two additions: pause while the tab is hidden, and hold a single static hue under `prefers-reduced-motion`.

- [ ] **Step 1: Write the assertion**

```bash
cd "$SITE" && test -f _site/assets/js/theme.js && echo PASS || echo FAIL
```

Expected: `FAIL`.

- [ ] **Step 2: Create `assets/js/theme.js`**

```js
(function () {
  var root = document.documentElement;
  var btn = document.getElementById('theme-toggle');
  if (!btn) return;

  var THEMES = ['light', 'dark', 'auto'];
  var KEY = 'site-theme';
  var ACCENT_VARS = ['--accent', '--accent-hover', '--accent-soft'];

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var raf = null;
  var hue = 0;

  function current() {
    return root.getAttribute('data-theme') || 'light';
  }

  function paint(h) {
    root.style.setProperty('--accent', 'hsl(' + h + ', 70%, 52%)');
    root.style.setProperty('--accent-hover', 'hsl(' + h + ', 70%, 44%)');
    root.style.setProperty('--accent-soft', 'hsla(' + h + ', 70%, 52%, 0.10)');
  }

  function tick() {
    hue = (hue + 0.12) % 360;
    paint(hue);
    raf = requestAnimationFrame(tick);
  }

  function startAuto() {
    if (reduceMotion) { paint(hue); return; }
    if (raf === null) tick();
  }

  /* clearVars false when merely pausing, so the current hue stays on screen. */
  function stopAuto(clearVars) {
    if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
    if (clearVars) {
      ACCENT_VARS.forEach(function (v) { root.style.removeProperty(v); });
    }
  }

  function apply(theme) {
    stopAuto(true);
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch (e) {}
    if (theme === 'auto') {
      hue = (Date.now() / 50) % 360;
      startAuto();
    }
  }

  document.addEventListener('visibilitychange', function () {
    if (current() !== 'auto') return;
    if (document.hidden) { stopAuto(false); } else { startAuto(); }
  });

  btn.addEventListener('click', function () {
    apply(THEMES[(THEMES.indexOf(current()) + 1) % THEMES.length]);
  });

  if (current() === 'auto') {
    hue = (Date.now() / 50) % 360;
    startAuto();
  }
})();
```

- [ ] **Step 3: Run the assertion**

```bash
jbuild && test -f _site/assets/js/theme.js && echo PASS || echo FAIL
```

Expected: `PASS`.

- [ ] **Step 4: Verify in a browser**

```bash
jserve
```

Open `http://localhost:4000`. Click the toggle three times and confirm light → dark → auto → light. In auto, confirm the accent hue drifts. Switch to another tab for ten seconds, return, and confirm the hue resumes. Hard-reload in dark mode and confirm no white flash.

- [ ] **Step 5: Commit**

```bash
git add assets/js/theme.js
git commit -m "feat: theme toggle with paused cycling on hidden tab"
```

---

## Task 6: Profile data and the vCard

**Files:**
- Create: `_data/profile.yml`
- Create: `_includes/vcard.html`
- Modify: `assets/css/_vcard.scss`

- [ ] **Step 1: Write the assertion**

```bash
cd "$SITE" && grep -q 'vcard__name' _site/about/index.html && echo PASS || echo FAIL
```

Expected: `FAIL`.

- [ ] **Step 2: Create `_data/profile.yml`**

`tagline`, `location`, and `email` ship empty on purpose; the card omits blank fields entirely, so they can be filled in later without touching a layout.

```yaml
name: Rohan Shah
role: Senior Machine Learning Engineer
tagline: ""
photo: /assets/images/rohan.jpg
location: ""
email: ""
socials:
  - name: LinkedIn
    url: https://www.linkedin.com/in/rohan-shah-50221612a/
    icon: linkedin
  - name: GitHub
    url: https://github.com/rohanshah8
    icon: github
```

- [ ] **Step 3: Create `_includes/vcard.html`**

Every optional field is guarded with `field and field != ''` so a missing key and an empty string both render nothing. Pass `as_heading=true` on the homepage only, so exactly one `h1` exists per page.

```html
{% assign p = site.data.profile %}
<div class="vcard">
  {% if p.photo %}
  <img class="vcard__photo" src="{{ p.photo | relative_url }}" alt="{{ p.name }}" width="120" height="120">
  {% endif %}

  {% if include.as_heading %}
  <h1 class="vcard__name">{{ p.name }}</h1>
  {% else %}
  <p class="vcard__name">{{ p.name }}</p>
  {% endif %}

  {% if p.role and p.role != '' %}
  <p class="vcard__role">{{ p.role }}</p>
  {% endif %}

  {% if p.tagline and p.tagline != '' %}
  <p class="vcard__tagline">{{ p.tagline }}</p>
  {% endif %}

  {% if p.location and p.location != '' or p.email and p.email != '' %}
  <ul class="vcard__meta">
    {% if p.location and p.location != '' %}
    <li class="vcard__meta-item">{{ p.location }}</li>
    {% endif %}
    {% if p.email and p.email != '' %}
    <li class="vcard__meta-item"><a href="mailto:{{ p.email }}">{{ p.email }}</a></li>
    {% endif %}
  </ul>
  {% endif %}

  {% if p.socials %}
  <ul class="vcard__socials">
    {% for s in p.socials %}
    <li>
      <a class="vcard__social" href="{{ s.url }}" target="_blank" rel="noopener noreferrer" aria-label="{{ s.name }}">
        {% if s.icon == 'linkedin' %}
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
        {% elsif s.icon == 'github' %}
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
        {% else %}
        {{ s.name }}
        {% endif %}
      </a>
    </li>
    {% endfor %}
  </ul>
  {% endif %}
</div>
```

- [ ] **Step 4: Replace `assets/css/_vcard.scss`**

```scss
.vcard {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: var(--space-6) var(--space-5);
  text-align: center;
  box-shadow: var(--shadow-sm);
}

.vcard__photo {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  margin-bottom: var(--space-4);
  border: 3px solid var(--bg);
  box-shadow: 0 0 0 1px var(--border);
}

.vcard__name {
  margin: 0 0 var(--space-2);
  font-size: var(--step-1);
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--text);
}

.vcard__role {
  margin: 0;
  font-size: var(--step--1);
  color: var(--text-secondary);
}

.vcard__tagline {
  margin: var(--space-2) 0 0;
  font-size: var(--step--1);
  color: var(--text-muted);
}

.vcard__meta {
  list-style: none;
  margin: var(--space-4) 0 0;
  padding: 0;
  font-size: var(--step--1);
  color: var(--text-secondary);
}
.vcard__meta-item + .vcard__meta-item { margin-top: var(--space-1); }

.vcard__socials {
  display: flex;
  justify-content: center;
  gap: var(--space-3);
  list-style: none;
  margin: var(--space-5) 0 0;
  padding: 0;
}

.vcard__social {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-secondary);
  transition: color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}
.vcard__social:hover {
  color: var(--accent);
  border-color: var(--accent);
  transform: translateY(-1px);
}
.vcard__social svg { width: 18px; height: 18px; fill: currentColor; }

/* Under 900px the card becomes a horizontal strip so it costs little
   vertical space above the content. */
@media (max-width: 899px) {
  .vcard {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr);
    grid-template-areas:
      "photo name"
      "photo role"
      "socials socials";
    gap: 0 var(--space-4);
    align-items: center;
    text-align: left;
    padding: var(--space-5);
  }
  .vcard__photo {
    grid-area: photo;
    width: 72px;
    height: 72px;
    margin: 0;
  }
  .vcard__name { grid-area: name; margin: 0; }
  .vcard__role { grid-area: role; }
  .vcard__tagline { display: none; }
  .vcard__meta { display: none; }
  .vcard__socials {
    grid-area: socials;
    justify-content: flex-start;
    margin-top: var(--space-4);
  }
}
```

- [ ] **Step 5: Run the assertion**

Requires `card.html` from Task 7 to render on `/about/`. Assert against the build not erroring for now:

```bash
jbuild && echo BUILD_OK
```

Expected: `BUILD_OK`.

- [ ] **Step 6: Commit**

```bash
git add _data/profile.yml _includes/vcard.html assets/css/_vcard.scss
git commit -m "feat: data-driven vcard with compact mobile variant"
```

---

## Task 7: Card layout, post list, post meta

**Files:**
- Create: `_layouts/card.html`
- Create: `_includes/post-list.html`
- Modify: `_includes/post-meta.html` (full rewrite)

- [ ] **Step 1: Write the assertion**

```bash
cd "$SITE" && jbuild >/dev/null 2>&1; grep -q 'vcard__name' _site/about/index.html && echo PASS || echo FAIL
```

Expected: `FAIL`.

- [ ] **Step 2: Create `_layouts/card.html`**

```html
---
layout: default
---

<main class="shell layout layout--card" id="content">
  <aside class="layout__aside">
    {% include vcard.html %}
  </aside>

  <div class="layout__main">
    {% if page.title %}<h1 class="page-title">{{ page.title }}</h1>{% endif %}
    <div class="prose">
      {{ content }}
    </div>
  </div>
</main>
```

- [ ] **Step 3: Rewrite `_includes/post-meta.html`**

Takes the post explicitly as `include.post` rather than relying on the ambient `page`, so it behaves identically inside a loop and on a post page.

The view key must reproduce the algorithm the old inline script used — strip leading and trailing slashes, replace `/`, `.`, `_` with `-`, lowercase — or existing counts orphan. `split: '/'` on `/2026/02/01/welcome/` yields `["", "2026", "02", "01", "welcome"]`, so joining gives `-2026-02-01-welcome` and `remove_first` trims the leading dash.

```liquid
{% assign p = include.post %}
{% assign vkey = p.url | split: '/' | join: '-' | remove_first: '-' | replace: '.', '-' | replace: '_', '-' | downcase %}
{% assign words = p.content | number_of_words %}
<div class="post-meta">
  <time datetime="{{ p.date | date_to_xmlschema }}">{{ p.date | date: "%b %-d, %Y" }}</time>

  {% if words > 0 %}
  <span class="meta-dot">&middot;</span>
  <span>{% if words < 200 %}1{% else %}{{ words | divided_by: 200 }}{% endif %} min read</span>
  {% endif %}

  {% if include.show_author and p.author %}
  <span class="meta-dot">&middot;</span>
  <span>{{ p.author }}</span>
  {% endif %}

  <span class="meta-dot">&middot;</span>
  <span data-views
        data-views-endpoint="{{ site.views.endpoint }}"
        data-views-key="{{ vkey }}"
        {% if include.mode == 'increment' %}data-views-mode="increment"{% endif %}>&hellip;</span>
</div>
```

- [ ] **Step 4: Create `_includes/post-list.html`**

Descriptions use `subtitle` and fall back to `excerpt`, because two of the three posts have no body and would produce empty excerpts.

```liquid
{% assign lim = include.limit | default: 9999 %}
{% if site.posts.size == 0 %}
<p class="postlist__empty">Nothing published yet.</p>
{% else %}
<ul class="postlist">
  {% for item in site.posts limit: lim %}
  <li class="postlist__item">
    <h3 class="postlist__title">
      <a href="{{ item.url | relative_url }}">{{ item.title }}</a>
    </h3>
    {% assign blurb = item.subtitle | default: item.excerpt %}
    {% if blurb and blurb != '' %}
    <p class="postlist__subtitle">{{ blurb | strip_html | strip_newlines | truncatewords: 30 }}</p>
    {% endif %}
    {% include post-meta.html post=item mode="read" %}
  </li>
  {% endfor %}
</ul>
{% endif %}
```

- [ ] **Step 5: Run the assertion**

```bash
jbuild && grep -q 'vcard__name' _site/about/index.html && echo PASS || echo FAIL
```

Expected: `PASS`.

- [ ] **Step 6: Confirm one `h1` on the About page**

```bash
grep -o '<h1' _site/about/index.html | wc -l
```

Expected: `1`. The card renders the name as a `<p>` unless `as_heading` is passed.

- [ ] **Step 7: Commit**

```bash
git add _layouts/card.html _includes/post-list.html _includes/post-meta.html
git commit -m "feat: card layout with reusable post list and meta"
```

---

## Task 8: Homepage

**Files:**
- Create: `_layouts/home.html`
- Modify: `index.md`

- [ ] **Step 1: Write the assertion**

```bash
cd "$SITE" && jbuild >/dev/null 2>&1; grep -q 'home-writing' _site/index.html && echo PASS || echo FAIL
```

Expected: `FAIL`.

- [ ] **Step 2: Create `_layouts/home.html`**

```html
---
layout: default
---

<main class="shell layout layout--card" id="content">
  <aside class="layout__aside">
    {% include vcard.html as_heading=true %}
  </aside>

  <div class="layout__main">
    {% if content and content != '' %}
    <div class="prose">
      {{ content }}
    </div>
    {% endif %}

    <section class="home-writing">
      <h2 class="section-title">Writing</h2>
      {% include post-list.html limit=5 %}
      {% if site.posts.size > 5 %}
      <p class="home-writing__more">
        <a href="{{ '/writing/' | relative_url }}">All writing &rarr;</a>
      </p>
      {% endif %}
    </section>
  </div>
</main>
```

- [ ] **Step 3: Rewrite `index.md`**

Drops the now-unused `collectionpage` key. The body stays empty; the vCard and the writing list carry the page. Add an intro paragraph here later if wanted.

```markdown
---
layout: home
title: Rohan Shah
---
```

- [ ] **Step 4: Run the assertion**

```bash
jbuild && grep -q 'home-writing' _site/index.html && echo PASS || echo FAIL
```

Expected: `PASS`.

- [ ] **Step 5: Confirm the homepage name is the `h1`**

```bash
grep -q '<h1 class="vcard__name">Rohan Shah</h1>' _site/index.html && echo PASS || echo FAIL
```

Expected: `PASS`.

- [ ] **Step 6: Confirm the welcome post is listed with its subtitle**

```bash
grep -q 'The beginning of something new' _site/index.html && echo PASS || echo FAIL
```

Expected: `PASS`.

- [ ] **Step 7: Commit**

```bash
git add _layouts/home.html index.md
git commit -m "feat: vcard landing page with recent writing"
```

---

## Task 9: Post layout, prev/next, view counter, prose styles

**Files:**
- Create: `_layouts/post.html` (full rewrite of the existing file)
- Create: `_includes/post-nav.html`
- Create: `assets/js/views.js`
- Modify: `assets/css/_prose.scss`

- [ ] **Step 1: Write the assertion**

```bash
cd "$SITE" && jbuild >/dev/null 2>&1; grep -q 'data-views-mode="increment"' _site/2026/02/01/welcome/index.html && echo PASS || echo FAIL
```

Expected: `FAIL`.

- [ ] **Step 2: Rewrite `_layouts/post.html`**

No sidebar. `default.html` already suppresses the nav when `page.layout == 'post'`.

```html
---
layout: default
---

<main class="shell post" id="content">
  <article>
    <header class="post__header">
      <h1 class="post__title">{{ page.title }}</h1>
      {% if page.subtitle %}
      <p class="post__subtitle">{{ page.subtitle }}</p>
      {% endif %}
      {% include post-meta.html post=page mode="increment" show_author=true %}
    </header>

    <div class="post__body prose">
      {{ content }}
    </div>
  </article>

  {% include post-nav.html %}
</main>
```

- [ ] **Step 3: Create `_includes/post-nav.html`**

In Jekyll `page.previous` is the older post and `page.next` the newer one.

```html
{% if page.previous or page.next %}
<nav class="post-nav" aria-label="More posts">
  {% if page.previous %}
  <a class="post-nav__link" href="{{ page.previous.url | relative_url }}">
    <span class="post-nav__label">&larr; Previous</span>
    <span class="post-nav__title">{{ page.previous.title }}</span>
  </a>
  {% else %}
  <span></span>
  {% endif %}

  {% if page.next %}
  <a class="post-nav__link post-nav__link--next" href="{{ page.next.url | relative_url }}">
    <span class="post-nav__label">Next &rarr;</span>
    <span class="post-nav__title">{{ page.next.title }}</span>
  </a>
  {% endif %}
</nav>
{% endif %}
```

- [ ] **Step 4: Create `assets/js/views.js`**

Replaces roughly 120 lines of inline JS that were duplicated across two layouts. The key now arrives from Liquid rather than being scraped out of hrefs.

```js
(function () {
  var nodes = document.querySelectorAll('[data-views]');
  if (!nodes.length) return;

  function hide(el) {
    el.style.display = 'none';
    var prev = el.previousElementSibling;
    if (prev && prev.classList.contains('meta-dot')) {
      prev.style.display = 'none';
    }
  }

  Array.prototype.forEach.call(nodes, function (el) {
    var endpoint = el.getAttribute('data-views-endpoint');
    var key = el.getAttribute('data-views-key');
    if (!endpoint || !key) { hide(el); return; }

    /* Post pages increment; list items only read. */
    var increment = el.getAttribute('data-views-mode') === 'increment';
    var url = endpoint + '/' + key + (increment ? '/up' : '');

    fetch(url)
      .then(function (res) {
        /* A counter that does not exist yet is zero, not an error. */
        if (res.status === 404) return { count: 0 };
        if (!res.ok) throw new Error('views request failed');
        return res.json();
      })
      .then(function (data) {
        if (!data || typeof data.count === 'undefined') {
          throw new Error('no count in response');
        }
        el.textContent = data.count === 1 ? '1 view' : data.count + ' views';
      })
      .catch(function () { hide(el); });
  });
})();
```

- [ ] **Step 5: Replace `assets/css/_prose.scss`**

```scss
.prose {
  max-width: var(--measure);
  font-family: var(--font-prose);
  font-size: var(--step-0);
  line-height: 1.7;
  color: var(--text);
}

.prose > :first-child { margin-top: 0; }

.prose h2 {
  margin-top: 2.5em;
  margin-bottom: 0.6em;
  font-size: var(--step-2);
}

.prose h3 {
  margin-top: 2em;
  margin-bottom: 0.5em;
  font-size: var(--step-1);
}

.prose p { margin: 0 0 1.4em; }

.prose a {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 0.18em;
  text-decoration-thickness: 0.07em;
}
.prose a:hover { color: var(--accent-hover); }

.prose strong { font-weight: 600; color: var(--text); }

.prose ul, .prose ol { margin: 0 0 1.4em; padding-left: 1.4em; }
.prose li { margin-bottom: 0.5em; }

.prose blockquote {
  margin: 1.8em 0;
  padding-left: var(--space-5);
  border-left: 3px solid var(--accent);
  color: var(--text-secondary);
}
.prose blockquote p:last-child { margin-bottom: 0; }

.prose code {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.15em 0.4em;
}

.prose pre {
  margin: 1.8em 0;
  padding: var(--space-4);
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  /* Scroll rather than wrap, so code keeps its shape. */
  overflow-x: auto;
}
.prose pre code {
  background: none;
  border: 0;
  padding: 0;
  font-size: 0.875em;
  line-height: 1.6;
}

.prose img {
  display: block;
  width: 100%;
  border-radius: var(--radius);
  margin: 1.8em 0 0.6em;
}

/* Caption support. This only matches when the caption sits on the line
   immediately after the image with NO blank line between them, so kramdown
   keeps both inside one <p>:

       ![alt](/path.png)
       *The caption*

   A blank line puts the <em> in its own <p> and this rule will not apply. */
.prose img + em {
  display: block;
  font-size: var(--step--1);
  color: var(--text-muted);
  font-style: normal;
  margin-bottom: 1.8em;
}

.prose hr {
  border: 0;
  border-top: 1px solid var(--border);
  margin: var(--space-7) 0;
}

.prose table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.8em 0;
  font-size: var(--step--1);
}
.prose th, .prose td {
  text-align: left;
  padding: var(--space-3);
  border-bottom: 1px solid var(--border);
}
.prose th { font-weight: 600; }

/* ---- Post page ---- */

.post {
  padding-block: var(--space-7) var(--space-8);
}

.post > article,
.post .post-nav {
  max-width: var(--measure);
  margin-inline: auto;
}

.post__header {
  margin-bottom: var(--space-6);
}

.post__title {
  font-size: var(--step-4);
  line-height: 1.15;
  margin-bottom: var(--space-3);
}

.post__subtitle {
  font-size: var(--step-1);
  font-weight: 400;
  color: var(--text-secondary);
  line-height: 1.4;
  margin-bottom: var(--space-4);
}

@media (max-width: 479px) {
  .prose { font-size: 1.0625rem; line-height: 1.65; }
  .post__title { font-size: var(--step-3); }
  .post__subtitle { font-size: var(--step-0); }
}
```

- [ ] **Step 6: Run the assertion**

```bash
jbuild && grep -q 'data-views-mode="increment"' _site/2026/02/01/welcome/index.html && echo PASS || echo FAIL
```

Expected: `PASS`.

- [ ] **Step 7: Verify the view key matches the old scheme**

This is the step that protects existing counts.

```bash
grep -o 'data-views-key="[^"]*"' _site/2026/02/01/welcome/index.html
```

Expected: exactly `data-views-key="2026-02-01-welcome"`. Anything else orphans the existing count — stop and fix the Liquid in `post-meta.html` before continuing.

- [ ] **Step 8: Confirm posts have no sidebar and no nav**

```bash
grep -q 'layout__aside' _site/2026/02/01/welcome/index.html && echo "SIDEBAR LEAKED" || echo "NO SIDEBAR"
grep -q 'site-nav__link' _site/2026/02/01/welcome/index.html && echo "NAV LEAKED" || echo "NO NAV"
```

Expected: `NO SIDEBAR` then `NO NAV`.

- [ ] **Step 9: Confirm read time is suppressed on a body-less post**

```bash
grep -c 'min read' _site/2026/02/03/*/index.html
```

Expected: `0`. These posts move to `_drafts/` in Task 13; until then they prove the guard works.

- [ ] **Step 10: Commit**

```bash
git add _layouts/post.html _includes/post-nav.html assets/js/views.js assets/css/_prose.scss
git commit -m "feat: reading-focused post layout, prev/next, consolidated view counter"
```

---

## Task 10: Resume data and timeline

**Files:**
- Create: `_data/resume.yml`
- Create: `_includes/resume-timeline.html`

Content is lifted from the current `about.md`. The advisor's name is corrected to **Sundaresan**, matching the IISc URL slug; `about.md` currently reads "Sunderasan".

- [ ] **Step 1: Write the assertion**

```bash
cd "$SITE" && grep -q 'timeline__role' _site/about/index.html && echo PASS || echo FAIL
```

Expected: `FAIL`.

- [ ] **Step 2: Create `_data/resume.yml`**

`dates` are empty because the current `about.md` gives none; the row is hidden while blank.

```yaml
experience:
  - role: Senior Machine Learning Engineer
    org: Qualcomm
    dates: ""
    bullets:
      - Model quantization and compression
      - Post-mortem analysis of every op inside the model graph
      - Real-time inference optimization
      - Power-efficient ML deployment
      - AI orchestration for on-device LLMs — RAG systems, agents, and complex workflows executed locally
  - role: Machine Learning Intern
    org: Gojek
    dates: ""
    bullets:
      - Built a production-ready image moderation system during the IISc master's program
      - Learned first-hand what it takes to move ML from research into production
    links:
      - label: "How to Moderate Images Based on Text and Logo Using ML/DL"
        url: https://medium.com/the-algorithmic-minds/how-to-moderate-images-based-on-text-and-logo-using-ml-dl-f48a7ef173ac

education:
  - degree: Master's degree, Machine Learning
    org: Indian Institute of Science (IISc), Bangalore
    dates: ""
    note: >-
      Thesis on automated rare disease identification, processing millions of
      data points, advised by Prof. Rajesh Sundaresan.
    advisor_url: https://eecs.iisc.ac.in/people/rajesh-sundaresan/
```

- [ ] **Step 3: Create `_includes/resume-timeline.html`**

```liquid
{% assign r = site.data.resume %}

{% if r.experience %}
<ol class="timeline">
  {% for job in r.experience %}
  <li class="timeline__item">
    <h3 class="timeline__role">{{ job.role }}</h3>
    <p class="timeline__org">
      {{ job.org }}{% if job.dates and job.dates != '' %}<span class="timeline__dates">{{ job.dates }}</span>{% endif %}
    </p>
    {% if job.bullets %}
    <ul class="timeline__bullets">
      {% for b in job.bullets %}<li>{{ b }}</li>{% endfor %}
    </ul>
    {% endif %}
    {% if job.links %}
    <ul class="timeline__links">
      {% for l in job.links %}
      <li><a href="{{ l.url }}" target="_blank" rel="noopener noreferrer">{{ l.label }}</a></li>
      {% endfor %}
    </ul>
    {% endif %}
  </li>
  {% endfor %}
</ol>
{% endif %}

{% if r.education %}
<ol class="timeline">
  {% for ed in r.education %}
  <li class="timeline__item">
    <h3 class="timeline__role">{{ ed.degree }}</h3>
    <p class="timeline__org">
      {{ ed.org }}{% if ed.dates and ed.dates != '' %}<span class="timeline__dates">{{ ed.dates }}</span>{% endif %}
    </p>
    {% if ed.note %}
    <p class="timeline__note">
      {% if ed.advisor_url %}{{ ed.note | replace: 'Prof. Rajesh Sundaresan', '<a href="' | append: ed.advisor_url | append: '" target="_blank" rel="noopener noreferrer">Prof. Rajesh Sundaresan</a>' }}{% else %}{{ ed.note }}{% endif %}
    </p>
    {% endif %}
  </li>
  {% endfor %}
</ol>
{% endif %}
```

- [ ] **Step 4: Run the assertion**

The timeline only renders once `about.md` includes it, which is Task 11. Assert the build stays clean:

```bash
jbuild && echo BUILD_OK
```

Expected: `BUILD_OK`.

- [ ] **Step 5: Commit**

```bash
git add _data/resume.yml _includes/resume-timeline.html
git commit -m "feat: resume timeline from structured data"
```

---

## Task 11: Migrate `about.md`

**Delegate to Sonnet** — mechanical content restructuring with the target structure fully specified.

**Files:**
- Modify: `about.md` (full rewrite)

- [ ] **Step 1: Write the assertion**

```bash
cd "$SITE" && grep -q 'profile-intro' about.md && echo "OLD HTML PRESENT" || echo "MIGRATED"
```

Expected: `OLD HTML PRESENT`.

- [ ] **Step 2: Rewrite `about.md`**

The `profile-intro` and `connect-bar` HTML blocks go away — the vCard supplies photo, name, role, and socials on every page now. Experience becomes the data-driven timeline.

```markdown
---
layout: card
title: About
permalink: /about/
---

Senior Machine Learning Engineer working on running ML and DL models efficiently on edge devices. My focus is optimizing deep learning models for mobile, automotive, and IoT — making AI practical on every device, locally.

## Background

I completed my **Master's degree at the Indian Institute of Science (IISc), Bangalore**, where I built a foundation in machine learning and deep learning. My thesis developed automated rare disease identification systems processing millions of data points.

## Experience

{% include resume-timeline.html %}

## Interests

- **Edge AI** — making machine learning practical on resource-constrained devices
- **Production ML** — building reliable, scalable ML systems
- **Deep Learning** — exploring new architectures and optimization techniques
```

- [ ] **Step 3: Run the assertion**

```bash
grep -q 'profile-intro' about.md && echo "OLD HTML PRESENT" || echo "MIGRATED"
```

Expected: `MIGRATED`.

- [ ] **Step 4: Confirm the timeline renders**

```bash
jbuild && grep -q 'timeline__role' _site/about/index.html && echo PASS || echo FAIL
```

Expected: `PASS`.

- [ ] **Step 5: Confirm the advisor link survived the replace filter**

```bash
grep -q 'eecs.iisc.ac.in/people/rajesh-sundaresan' _site/about/index.html && echo PASS || echo FAIL
```

Expected: `PASS`.

- [ ] **Step 6: Confirm the Gojek article link survived**

```bash
grep -q 'the-algorithmic-minds' _site/about/index.html && echo PASS || echo FAIL
```

Expected: `PASS`.

- [ ] **Step 7: Commit**

```bash
git add about.md
git commit -m "refactor: about page uses vcard and data-driven timeline"
```

---

## Task 12: Add the writing archive, check the 2026 page

**Delegate to Sonnet** — small, fully specified content work.

**Files:**
- Create: `writing.md`
- Modify: `list_2026.md` (front matter only)

- [ ] **Step 1: Write the assertion**

```bash
cd "$SITE" && test -f _site/writing/index.html && echo PASS || echo FAIL
```

Expected: `FAIL`.

- [ ] **Step 2: Create `writing.md`**

```markdown
---
layout: card
title: Writing
permalink: /writing/
---

{% include post-list.html %}
```

- [ ] **Step 3: Update `list_2026.md` front matter**

Body content is unchanged. Only the layout and title change:

```markdown
---
layout: card
title: 2026 Goals & Habits
permalink: /list_2026/
---
```

- [ ] **Step 4: Run the assertion**

```bash
jbuild && test -f _site/writing/index.html && echo PASS || echo FAIL
```

Expected: `PASS`.

- [ ] **Step 5: Confirm the 2026 page still renders its content**

```bash
grep -q 'Stop Overthinking' _site/list_2026/index.html && echo PASS || echo FAIL
```

Expected: `PASS`.

- [ ] **Step 6: Confirm the nav marks the current page**

```bash
grep -q 'site-nav__link--current' _site/writing/index.html && echo PASS || echo FAIL
```

Expected: `PASS`.

- [ ] **Step 7: Commit**

```bash
git add writing.md list_2026.md
git commit -m "feat: writing archive page, 2026 page on card layout"
```

---

## Task 13: Move the body-less posts to drafts

**Files:**
- Move: `_posts/2026-02-03-How-Zip-Works.md` → `_drafts/`
- Move: `_posts/2026-02-06-Overthinking-Trap.md` → `_drafts/`

Front matter is preserved, including `date`, so restoring them later is a one-command move. Their URLs stop existing, so their counter keys go dormant until then.

- [ ] **Step 1: Write the assertion**

```bash
cd "$SITE" && ls -d _site/2026/02/03/* >/dev/null 2>&1 && echo "STILL BUILDING" || echo "GONE"
```

Expected: `STILL BUILDING`.

- [ ] **Step 2: Move both files**

```bash
mkdir -p _drafts
git mv _posts/2026-02-03-How-Zip-Works.md _drafts/2026-02-03-How-Zip-Works.md
git mv _posts/2026-02-06-Overthinking-Trap.md _drafts/2026-02-06-Overthinking-Trap.md
```

- [ ] **Step 3: Run the assertion**

```bash
rm -rf _site && jbuild && ls -d _site/2026/02/03/* >/dev/null 2>&1 && echo "STILL BUILDING" || echo "GONE"
```

Expected: `GONE`. The `rm -rf _site` matters — Jekyll does not remove stale output.

- [ ] **Step 4: Confirm the welcome post is untouched**

```bash
test -f _site/2026/02/01/welcome/index.html && echo PASS || echo FAIL
```

Expected: `PASS`.

- [ ] **Step 5: Confirm drafts are absent from the sitemap**

```bash
grep -c 'How-Zip-Works\|Overthinking' _site/sitemap.xml
```

Expected: `0`.

- [ ] **Step 6: Confirm they can still be previewed on demand**

```bash
jbuild --drafts && ls -d _site/2026/02/03/* >/dev/null 2>&1 && echo "DRAFTS PREVIEWABLE" || echo FAIL
```

Expected: `DRAFTS PREVIEWABLE`. Then rebuild clean: `rm -rf _site && jbuild`.

- [ ] **Step 7: Commit**

```bash
git commit -m "content: move body-less posts to drafts until written"
```

---

## Task 14: Component styles

**Files:**
- Modify: `assets/css/_components.scss`

- [ ] **Step 1: Write the assertion**

```bash
cd "$SITE" && grep -q 'postlist__item' _site/assets/css/main.css && echo PASS || echo FAIL
```

Expected: `FAIL`.

- [ ] **Step 2: Replace `assets/css/_components.scss`**

```scss
/* ---- Section headings ---- */

.section-title {
  font-size: var(--step-1);
  margin-bottom: var(--space-5);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border);
}

.home-writing { margin-top: var(--space-7); }
.home-writing__more { margin-top: var(--space-5); font-size: var(--step--1); }

/* ---- Post list ---- */

.postlist {
  list-style: none;
  margin: 0;
  padding: 0;
}

.postlist__item {
  padding-block: var(--space-5);
  border-bottom: 1px solid var(--border);
}
.postlist__item:first-child { padding-top: 0; }
.postlist__item:last-child { border-bottom: 0; }

.postlist__title {
  font-size: var(--step-1);
  margin: 0 0 var(--space-2);
  line-height: 1.3;
}
.postlist__title a { color: var(--text); }
.postlist__title a:hover { color: var(--accent); }

.postlist__subtitle {
  margin: 0 0 var(--space-3);
  color: var(--text-secondary);
  font-size: var(--step--1);
  line-height: 1.6;
}

.postlist__empty { color: var(--text-muted); }

/* ---- Post meta row ---- */

.post-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--step--1);
  color: var(--text-muted);
}

.meta-dot { color: var(--border); }

/* ---- Prev/next ---- */

.post-nav {
  display: flex;
  justify-content: space-between;
  gap: var(--space-5);
  margin-top: var(--space-8);
  padding-top: var(--space-6);
  border-top: 1px solid var(--border);
}

.post-nav__link {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-width: 45%;
}
.post-nav__link--next { text-align: right; margin-left: auto; }

.post-nav__label {
  font-size: var(--step--1);
  color: var(--text-muted);
}

.post-nav__title {
  font-weight: 600;
  color: var(--text);
  line-height: 1.35;
}
.post-nav__link:hover .post-nav__title { color: var(--accent); }

/* ---- Resume timeline ---- */

.timeline {
  list-style: none;
  margin: 0 0 var(--space-6);
  padding: 0 0 0 var(--space-5);
  border-left: 2px solid var(--border);
}

.timeline__item {
  position: relative;
  padding-bottom: var(--space-6);
}
.timeline__item:last-child { padding-bottom: 0; }

/* Dot sits on the rail; offsets track --space-5 and the 2px border. */
.timeline__item::before {
  content: "";
  position: absolute;
  left: calc(-1 * var(--space-5) - 6px);
  top: 0.45em;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 3px var(--bg);
}

.timeline__role {
  font-size: var(--step-0);
  margin: 0 0 var(--space-1);
}

.timeline__org {
  margin: 0 0 var(--space-3);
  font-size: var(--step--1);
  color: var(--text-secondary);
}

.timeline__dates {
  margin-left: var(--space-2);
  color: var(--text-muted);
}

.timeline__bullets {
  margin: 0;
  padding-left: 1.2em;
  font-size: var(--step--1);
  color: var(--text-secondary);
}
.timeline__bullets li { margin-bottom: var(--space-2); }

.timeline__links {
  list-style: none;
  margin: var(--space-3) 0 0;
  padding: 0;
  font-size: var(--step--1);
}

.timeline__note {
  margin: 0;
  font-size: var(--step--1);
  color: var(--text-secondary);
}
```

- [ ] **Step 3: Run the assertion**

```bash
jbuild && grep -q 'postlist__item' _site/assets/css/main.css && echo PASS || echo FAIL
```

Expected: `PASS`.

- [ ] **Step 4: Commit**

```bash
git add assets/css/_components.scss
git commit -m "feat: post list, meta, prev/next, and timeline styles"
```

---

## Task 15: Validation sweep

**Delegate to Haiku** — mechanical checks, no design judgment.

**Files:** none modified unless a check fails.

- [ ] **Step 1: Confirm no garth references remain**

`README.md` is excluded here because it still documents garth until Task 16 rewrites it.

```bash
cd "$SITE" && grep -rn 'garth\|remote_theme\|jekyll-paginate\|paginator' --include='*.yml' --include='*.html' --include='*.scss' --include='*.md' . | grep -v '^./docs/' | grep -v '^./_site/' | grep -v '^./README.md'
```

Expected: no output.

- [ ] **Step 2: Confirm no retired class names are referenced**

```bash
grep -rn 'goals-dashboard\|profile-intro\|connect-bar\|connect-btn\|profile-photo\|profile-text\|article--page\|list--posts\|item--post\|post-article\|post-meta-bar\|typeset' --include='*.html' --include='*.scss' --include='*.md' . | grep -v '^./docs/' | grep -v '^./_site/'
```

Expected: no output. This is the confirmation that deleting the old `.goals-dashboard` block was safe.

- [ ] **Step 3: Confirm every post has the expected front matter**

```bash
for f in _posts/*.md _drafts/*.md; do
  for k in layout title subtitle date author; do
    grep -q "^$k:" "$f" || echo "MISSING $k in $f"
  done
done; echo "front matter check done"
```

Expected: only `front matter check done`.

- [ ] **Step 4: Confirm the build emits no `docs/`**

```bash
rm -rf _site && jbuild >/dev/null && test -d _site/docs && echo "SPEC LEAKED" || echo "DOCS EXCLUDED"
```

Expected: `DOCS EXCLUDED`.

- [ ] **Step 5: Confirm no Gemfile or README leaked either**

```bash
ls _site/Gemfile _site/README.md 2>/dev/null && echo "LEAKED" || echo "CLEAN"
```

Expected: `CLEAN`.

- [ ] **Step 6: Check every internal link resolves**

```bash
grep -ho 'href="/[^"]*"' _site/index.html _site/about/index.html _site/writing/index.html _site/list_2026/index.html \
  | sed 's/href="//; s/"$//' | sort -u | while read -r p; do
    case "$p" in
      */) t="_site${p}index.html" ;;
      *)  t="_site${p}" ;;
    esac
    test -e "$t" || echo "BROKEN: $p"
  done; echo "link check done"
```

Expected: only `link check done`.

- [ ] **Step 7: Confirm both scripts are referenced and present**

```bash
grep -q 'assets/js/theme.js' _site/index.html && test -f _site/assets/js/theme.js && echo THEME_OK || echo THEME_FAIL
grep -q 'assets/js/views.js' _site/index.html && test -f _site/assets/js/views.js && echo VIEWS_OK || echo VIEWS_FAIL
```

Expected: `THEME_OK` then `VIEWS_OK`.

- [ ] **Step 8: Commit only if a fix was needed**

```bash
git status --short
```

If clean, no commit. Otherwise commit the fix with a message describing it.

---

## Task 16: Rewrite the README

**Delegate to Sonnet** — documentation rewrite against a known-good tree.

**Files:**
- Modify: `README.md` (full rewrite)

The current README documents garth, remote themes, and the override system, none of which will exist. It must be replaced, not patched.

- [ ] **Step 1: Write the assertion**

```bash
cd "$SITE" && grep -q 'garth' README.md && echo "STALE" || echo "CURRENT"
```

Expected: `STALE`.

- [ ] **Step 2: Rewrite `README.md`**

Cover exactly these sections, drawn from the tree as built:

1. **What this is** — personal site: vCard portfolio plus blog, Jekyll on GitHub Pages.
2. **Structure** — the file table from this plan's File Structure section, trimmed to one line per entry.
3. **Editing content** — how to add a post (`_posts/YYYY-MM-DD-title.md`, front matter `layout`, `title`, `subtitle`, `date`, `author`); how to publish a draft (move out of `_drafts/`); how to change identity (`_data/profile.yml`); how to change the resume (`_data/resume.yml`); how to change nav (`navigation_header` in `_config.yml`).
4. **Theming** — all colour, type, and spacing values are custom properties in `assets/css/_tokens.scss`; the three themes are token swaps; `--font-prose` switches article body type.
5. **Local development** — the host lacks Ruby dev headers and passwordless sudo, so builds run in Docker. Include the `jbuild`/`jserve` functions and the `docker build -t jekyll-ghpages:local /tmp/jekyll-gh-build` line verbatim from this plan's Environment section. Note that the image is intentionally outside the repo.
6. **Deployment** — push to `main`; GitHub Pages builds automatically.
7. **Gotchas** — three specific ones: `exclude` in `_config.yml` replaces Jekyll's defaults rather than extending them, so new entries must not drop the existing ones; view-count keys derive from post URLs, so changing a permalink orphans that post's count; `assets/css/main.scss` needs its empty front matter or Jekyll copies it instead of compiling it.

- [ ] **Step 3: Run the assertion**

```bash
grep -q 'garth' README.md && echo "STALE" || echo "CURRENT"
```

Expected: `CURRENT`.

- [ ] **Step 4: Confirm the README stays out of the build**

```bash
rm -rf _site && jbuild >/dev/null && ls _site/README.md 2>/dev/null && echo LEAKED || echo CLEAN
```

Expected: `CLEAN`.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README for the self-contained layout"
```

---

## Task 17: Full verification matrix

This is spec §12 end to end. No file changes expected.

- [ ] **Step 1: Clean build with no warnings**

```bash
cd "$SITE" && rm -rf _site .jekyll-cache && jbuild 2>&1 | tee /tmp/jekyll-build.log | tail -20
grep -ci 'warn\|error' /tmp/jekyll-build.log
```

Expected: build completes; the count is `0`. Investigate anything non-zero.

- [ ] **Step 2: Confirm all five pages exist**

```bash
for p in index.html about/index.html writing/index.html list_2026/index.html 2026/02/01/welcome/index.html; do
  test -f "_site/$p" && echo "OK   $p" || echo "MISS $p"
done
```

Expected: five `OK` lines.

- [ ] **Step 3: Confirm SEO output**

```bash
grep -q '<title>' _site/index.html && grep -q 'og:title' _site/index.html && grep -q 'twitter:card' _site/index.html && echo PASS || echo FAIL
```

Expected: `PASS`.

- [ ] **Step 4: Confirm the view key one final time**

```bash
grep -o 'data-views-key="[^"]*"' _site/2026/02/01/welcome/index.html
```

Expected: `data-views-key="2026-02-01-welcome"`.

- [ ] **Step 5: Serve and walk the site**

```bash
jserve
```

At `http://localhost:4000` confirm, on each of `/`, `/about/`, `/writing/`, `/list_2026/`, `/2026/02/01/welcome/`:

- Light, dark, and auto all render legibly; no flash of the wrong theme on hard reload
- At 1440px the sidebar is present and sticks while the main column scrolls
- At 900px the sidebar is still a column but narrower
- At 375px the card is a horizontal strip and content sits below it
- The post page has no sidebar and no nav links at every width
- The post's reading column is comfortably narrow, roughly 65–70 characters
- Prev/next renders on the post (with only one live post, neither link shows — confirm the block is simply absent rather than broken)

- [ ] **Step 6: Confirm the counter fires**

With devtools open on `/2026/02/01/welcome/`, confirm one request to `api.counterapi.dev/...2026-02-01-welcome/up` and that the meta row shows a count. On `/writing/` confirm the request for the same key has **no** `/up` suffix.

- [ ] **Step 7: Confirm auto mode pauses**

In auto mode, switch tabs for ten seconds and return. The hue should resume from where it paused rather than having advanced.

- [ ] **Step 8: Record the result**

Note any deviation. Fix and re-run from Step 1 if something fails.

---

## Task 18: Merge and publish

Only after Task 17 passes end to end. This is the step that changes the live site.

- [ ] **Step 1: Confirm the tree is clean**

```bash
cd "$SITE" && git status --short
```

Expected: no output.

- [ ] **Step 2: Push the branch**

```bash
git push origin redesign/vcard-portfolio
```

- [ ] **Step 3: Review the full diff against main**

```bash
git diff main...redesign/vcard-portfolio --stat
```

Confirm nothing unexpected — particularly that `_site/` is absent.

- [ ] **Step 4: Confirm with Rohan before merging**

Merging to `main` publishes to the live site. Get explicit confirmation, then:

```bash
git checkout main
git merge --no-ff redesign/vcard-portfolio -m "feat: vCard portfolio redesign"
git push origin main
```

- [ ] **Step 5: Verify the deployed site**

Wait for the Pages build, then load `https://rohanshah8.github.io` and re-check: all four pages, the post, all three themes, and the view counter. Confirm `https://rohanshah8.github.io/docs/superpowers/specs/2026-08-27-vcard-portfolio-redesign-design.md` returns 404 — proof the exclude worked.

---

## Deviations from the spec

None to the design itself. Two small additions the spec did not name, both additive: a `skip-link` in `default.html` for keyboard users, and a `views.endpoint` key in `_config.yml` so the counter URL lives in one place rather than being hard-coded in JavaScript.

One ordering change came out of validating this plan against a real build: the `exclude` key moved from Task 2 into Task 1, because without it Jekyll parses the Liquid in these very documents and the build fails before any redesign work starts.

## Validated before hand-off

The following were confirmed by running against the current repo, not assumed:

- The container builds the existing site clean in ~1.2s once `exclude` is in place.
- `github-pages` 232 in the image resolves to Jekyll 3.10.0 on Ruby 3.1.7, matching GitHub's build.
- The site emits no Open Graph tags today, confirming `{% seo %}` is currently inert.
- All three posts build; slugs preserve case (`How-Zip-Works`).
- `docs/` and `README.md` are absent from `_site` under the planned `exclude` list.
- Host Ruby cannot run Jekyll: no dev headers, no passwordless sudo, native extensions won't compile. Docker is the only viable path.
