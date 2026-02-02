# Garth Theme Integration - Documentation

## Overview
This site uses the [Garth Jekyll theme](https://github.com/daviddarnes/garth) as a remote theme for a personal portfolio + blog website.

## Current Configuration

### Theme Setup
- **Theme**: `daviddarnes/garth` (remote theme)
- **Jekyll Version**: 3.9
- **Plugins**:
  - `jekyll-remote-theme` - Enables remote theme support
  - `jekyll-seo-tag` - SEO optimization
  - `jekyll-sitemap` - Automatic sitemap generation
  - `jekyll-paginate` - Blog pagination support

### Site Structure
```
rohanshah.github.io/
├── _posts/              # Blog posts
├── assets/
│   └── styles.scss      # Custom styles (overrides theme)
├── _config.yml          # Site configuration
├── index.md             # Home page (blog list)
├── about.md             # About/Portfolio page
└── Gemfile              # Ruby dependencies
```

### Key Features

#### 1. Custom Color Scheme
The site uses a warm beige color scheme:
- Background: `#ffefc8`
- Text: `#46412A`
- Links: `#2c5f2d` (hover: `#1a3a1b`)

#### 2. Navigation
Two main sections:
- **About me** (`/about/`) - Portfolio/bio page
- **Blog** (`/`) - Blog post listing (home page)

#### 3. Layouts
The theme provides three main layouts:
- `home` - Blog listing page with pagination
- `page` - Standard pages (About, etc.)
- `post` - Individual blog posts

## How the Theme Works

### File Override System
Jekyll's remote theme system allows you to override any theme file by creating a file with the same path in your repository:

- **Override styles**: Create `assets/styles.scss` (✓ Done)
- **Override layouts**: Create `_layouts/[layout-name].html` (Not needed currently)
- **Override includes**: Create `_includes/[include-name].html` (Not needed currently)

### Current Overrides
1. **`assets/styles.scss`** - Imports the base Garth theme styles and adds custom color scheme

### Theme Inheritance
Since we're using the remote theme, all layouts, includes, and base styles come from the Garth theme repository. Our custom files only override specific aspects.

## Customization Guide

### Adding Blog Posts
Create a new file in `_posts/` with the format: `YYYY-MM-DD-title.md`

```markdown
---
layout: post
title: "Your Post Title"
date: YYYY-MM-DD
---

Your content here...
```

### Modifying Colors
Edit `assets/styles.scss` and change the color values:

```scss
body {
    background-color: #your-color !important;
    color: #your-text-color;
}
```

### Adding Navigation Items
Edit `_config.yml` under `navigation_header`:

```yaml
navigation_header:
  - title: Your Page
    url: /your-page/
```

### Changing Site Information
Edit the following in `_config.yml`:
- `title` - Site name
- `description` - Site description
- `url` - Site URL
- `lang` - Language code

## Troubleshooting

### Theme Not Loading
1. Ensure `remote_theme: daviddarnes/garth` is in `_config.yml`
2. Verify `jekyll-remote-theme` is in the plugins list
3. Check that GitHub Pages is enabled in repository settings

### Styles Not Applying
1. Ensure `assets/styles.scss` has proper YAML front matter (`---` at top)
2. Verify the `@import "garth";` line is present
3. Clear browser cache

### Posts Not Showing
1. Check post filename format: `YYYY-MM-DD-title.md`
2. Ensure post has proper front matter with `layout: post`
3. Verify post date is not in the future

## Building Locally

### Prerequisites
- Ruby (2.7 or higher)
- Bundler

### Steps
```bash
# Install dependencies
bundle install

# Serve locally
bundle exec jekyll serve

# View at http://localhost:4000
```

## Deployment
The site automatically deploys to GitHub Pages when you push to the main branch.

## Resources
- [Garth Theme Documentation](https://github.com/daviddarnes/garth)
- [Jekyll Documentation](https://jekyllrb.com/docs/)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
