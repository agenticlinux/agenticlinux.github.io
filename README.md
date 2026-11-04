# agenticlinux.github.io

Source for <https://agenticlinux.github.io>, the website and blog for
[AgenticLinux](https://github.com/agenticlinux/agenticlinux).

Built with [Zola](https://www.getzola.org). No Node, no lockfile: one
static binary.

## Local preview

Install Zola (`brew install zola`, `cargo install zola`, or a
[release binary](https://github.com/getzola/zola/releases)), then:

```sh
zola serve
```

That serves the site on <http://127.0.0.1:1111> and live-reloads on
change. `zola build` writes the site to `public/`.

The deploy workflow pins Zola 0.23.4. Use the same version locally if you
can.

## Writing a post

Create `content/blog/my-post.md`:

```md
+++
title = "My post"
description = "One or two sentences. Used for the post list, the feed and social previews."
date = 2026-11-04

[taxonomies]
tags = ["announcement"]
+++

Intro paragraph, shown as the summary on list pages.

<!-- more -->

The rest of the post.
```

Notes:

- `date` must be a bare `YYYY-MM-DD` (no quotes). Posts sort newest
  first.
- A post with a future date is not built unless you pass
  `zola build --drafts`, so it is a usable way to stage something.
- `<!-- more -->` marks the summary cut-off.
- Filename becomes the URL: `content/blog/my-post.md` becomes
  `/blog/my-post/`. Renaming it breaks existing links.
- Tags generate `/tags/<tag>/` index pages automatically.
- Zola's smart punctuation is on, so a double hyphen in prose renders as
  an en dash. Keep prose to plain sentences, and state only what the
  [main repository](https://github.com/agenticlinux/agenticlinux) supports.

## Editing the landing page

Copy on the home page (the tagline, the subtitle, the hero command, the
get-started commands, the points and the variants table) lives in
`[extra]` in `config.toml`, so it can be changed without touching
templates. Layout lives in `templates/index.html`.

- `[[extra.install]]` entries are rows in the "Get started" block. Each has
  a `label`, optional `text` (with an optional `link` and `link_text`) and
  an optional `cmd`.
- `[[extra.points]]` entries are one plain paragraph and one command each.
  No feature-card grid.
- `[[extra.variants]]` entries feed the variants table. The image column is
  `extra.image_repo` plus the variant name, so a new variant is three
  lines.
- `extra.demo_url` is a plain link to a demo video, not an embed. Remove it
  to hide the line.

The page is meant to answer "what is this?" in the first screen: one
sentence, one command, what that command does.

The logo is `static/agenticlinux-mark.png`, the AgenticLinux logo at
256 px. `static/favicon.png` (32 px) and `static/apple-touch-icon.png`
(180 px, on the page background colour) are derived from it.

## Layout

```
config.toml              site config + landing-page copy
content/_index.md        home page (renders via templates/index.html)
content/blog/            blog posts, one markdown file each
templates/base.html      shared shell: head, header, footer
templates/index.html     landing page
templates/blog.html      blog index
templates/post.html      single post
templates/taxonomy_*.html  tag pages
templates/404.html       not-found page
static/style.css         all styling
static/agenticlinux-mark.png  logo (header and hero)
static/favicon.png
static/apple-touch-icon.png
```

## Deployment

`.github/workflows/deploy.yml` builds with Zola and publishes to GitHub
Pages on every push to `main`. Pages is configured with "GitHub Actions"
as the source, so there is no `gh-pages` branch to manage.
