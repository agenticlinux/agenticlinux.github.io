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

## Videos and screenshots

Binary media is not committed: it would stay in the repository's history for
good. It is uploaded to the `assets` GitHub release instead, and a post links
to the file there:

```sh
gh release upload assets dgx-spark-demo.mp4 dgx-spark-demo.webm --clobber
```

```html
<video controls preload="none" poster="https://github.com/agenticlinux/agenticlinux.github.io/releases/download/assets/dgx-spark-demo.png" width="1228" height="812">
<source src="https://github.com/agenticlinux/agenticlinux.github.io/releases/download/assets/dgx-spark-demo.webm" type="video/webm">
<source src="https://github.com/agenticlinux/agenticlinux.github.io/releases/download/assets/dgx-spark-demo.mp4" type="video/mp4">
</video>
```

Prefix each file with the post it belongs to, give a video both WebM and MP4
and a PNG poster, and give images and videos their `width` and `height` so
the page does not jump as they load.

## Editing the landing page and docs

Site copy lives in `[extra]` in `config.toml`, so it can be changed without
touching templates. Layout lives in `templates/`.

The **home page** (`templates/index.html`) uses only `extra.tagline`,
`extra.subtitle`, `extra.hero_cmd`, `extra.releases_url` and, for the small
link line, `extra.demo_url`. The rule for this page: it must fit on one
screen with no scrollbar at common desktop sizes (1920x1080 down to
1280x720) and on a typical phone (390x844). The header, hero and footer
share `100dvh` as a flex column, and sizes use `clamp()`. Only very short or
very narrow viewports fall back to normal scrolling. So keep the subtitle to
a couple of lines, and put anything longer in the docs. After changing
the home page, check it at those sizes.

The **docs** (`content/docs/`) are a Zola section, ordered with `weight`,
rendered by `templates/docs.html` (landing page) and `templates/docs-page.html`
(each page, with a sidebar and previous/next links). Each page's markdown
body is optional prose; a `page.extra.kind` flag in its front matter tells the
template which block of `config.toml` copy to render after it:

| Page | `kind` | Rendered from |
| --- | --- | --- |
| `installation.md` | `install` | `[[extra.install]]`, `extra.hero_cmd_note`, `extra.demo_url` and `extra.demo_text` |
| `included.md` | `points` | `[[extra.points]]`: a title, a markdown `body` and a `cmd` each |
| `variants.md` | `variants` | `[[extra.variants]]` and `extra.image_repo` |
| `source.md` | `source` | `extra.repo_url`, `extra.repo_name` and `extra.releases_url` |

- `[[extra.install]]` entries are steps on the Installation page. Each has a
  `label`, optional `text` (with an optional `link` and `link_text`) and an
  optional `cmd`.
- `[[extra.variants]]` entries feed the variants table. The image column is
  `extra.image_repo` plus the variant name, so a new variant is three
  lines.
- `extra.demo_url` is a plain link to a demo video, not an embed. Remove it
  to hide the link.
- `extra.repo_url` is the GitHub icon in the top navigation.

To add a docs page, create `content/docs/<name>.md` with a `title`, a
`description` and a `weight`. It appears in the sidebar and the previous/next
links by itself. Commands are rendered as copyable boxes (the `cmd` component
in `templates/macros.html`); the copy button is added by a few lines of
script in `templates/base.html` and is hidden when JavaScript or the
clipboard API is not available.

The logo is `static/agenticlinux-mark.png`, the AgenticLinux logo at
256 px. `static/favicon.png` (32 px) and `static/apple-touch-icon.png`
(180 px, on the page background colour) are derived from it.

## Layout

```
config.toml              site config + site copy (home page and docs)
content/_index.md        home page (renders via templates/index.html)
content/docs/            docs section: _index.md plus one markdown file per page
content/blog/            blog posts, one markdown file each
templates/base.html      shared shell: head, top nav, footer, copy-button script
templates/macros.html    the copyable command box component
templates/index.html     home page (one screen)
templates/docs.html      docs landing page
templates/docs-page.html docs page: sidebar, content, previous/next
templates/docs-sidebar.html  docs sidebar, included by both docs templates
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
