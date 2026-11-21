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

## Editing the landing page

The docs live in the README of the
[main repository](https://github.com/agenticlinux/agenticlinux#readme), not
here: this site is the landing page and the blog. Copy lives in `[extra]` in
`config.toml`; layout lives in `templates/`.

| Key | Used for |
| --- | --- |
| `extra.badge` | the pill above the headline |
| `extra.tagline` | the headline, also used in the page `<title>`. It breaks into two lines before the word " for " |
| `extra.subtitle` | the muted paragraph under the headline |
| `extra.hero_cmd` | the install command in the pill, with its copy button |
| `extra.start_url` | the "Get started" button (the main repository's Quick start) |
| `extra.docs_url` | the "Docs" links in the header, footer and home page (the main repository's README) |
| `extra.releases_url` | "Prefer an ISO? Download" |
| `extra.demo_url` | an optional "Watch the demo" link. Remove the key to hide it |
| `extra.repo_url`, `extra.repo_name` | the GitHub link, and the `owner/repo` the star count is read from |

The home page must fit on one screen with no scrollbar from 1920x1080 down
to 360x640. The body is a flex column with `min-height: 100dvh`, the headline
uses `clamp()`, and `max-height` media queries in `static/style.css` tighten
it on short screens. Viewports under about 340x560 scroll normally. Recheck
those sizes after changing the home page, and keep the subtitle short.

`static/site.js` fetches the star count from the GitHub API (cached for 10
minutes, hidden on failure) and wires up the copy buttons. If a copy is
blocked, the command is selected and the button says "Press Ctrl+C". Without
JavaScript the buttons stay hidden and clicking a command selects it (CSS
`user-select: all`).

## Layout

```
config.toml              site config and home page copy
content/_index.md        home page (templates/index.html)
content/blog/            blog posts, one markdown file each
templates/               base shell, macros, home, blog, post, tags, 404
static/style.css         all styling
static/site.js           copy buttons and star count
static/*.png             logo (agenticlinux-mark), favicon, apple-touch-icon
```

## Deployment

`.github/workflows/deploy.yml` builds with Zola and publishes to GitHub
Pages on every push to `main`. Pages is configured with "GitHub Actions"
as the source, so there is no `gh-pages` branch to manage.
