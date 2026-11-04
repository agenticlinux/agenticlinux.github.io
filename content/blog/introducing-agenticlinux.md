+++
title = "Introducing AgenticLinux"
description = "A bootc-based Linux desktop with the AI agents, Docker, Docker Sandboxes, QEMU/KVM and GPU runtimes already installed, in ten variants on Fedora 44 and CentOS Stream 10."
date = 2026-11-04

[taxonomies]
tags = ["announcement", "bootc"]
+++

AgenticLinux is a Linux desktop built for working with AI agents.
Everything is there on first boot: the `claude`, `codex`, `opencode`,
`openclaw` and `goose` agents, a way to run them side by side, a way to
watch their usage limits, and the container and GPU tooling they usually
need.

It is a [bootc](https://bootc-dev.github.io/bootc/) image. The whole OS
ships as a container, so updates are atomic and rollback is one command.

<!-- more -->

## What is installed

- **Agents:** `claude`, `codex`, `opencode`, `openclaw` and `goose`.
- **Around the agents:** [herdr](https://herdr.dev) to run them side by
  side, and [CodexBar](https://codex.bar) to keep an eye on their usage
  limits. CodexBar shows them in the tray, or with `codexbar usage` in a
  terminal.
- **Desktop apps:** [ChatGPT](https://learn.chatgpt.com/docs/app) (which
  includes Codex), [OpenCode](https://opencode.ai) and
  [Goose](https://goose-docs.ai), plus Google Chrome.
- **Models:** [llmman](https://github.com/llmmanorg/llmman) runs models
  locally, or connects any agent to any provider.
- **Containers:** [Docker Engine](https://docs.docker.com/engine/), rootful
  and [rootless](https://docs.docker.com/engine/security/rootless/), and
  [Docker Sandboxes](https://docs.docker.com/ai/sandboxes/) to run agents
  in isolation.
- **Virtual machines:** [QEMU](https://www.qemu.org) with KVM.
- **GPUs:** Vulkan, ROCm and NVIDIA/CUDA runtimes.
- **A developer toolset**, listed in
  [packages.txt](https://github.com/agenticlinux/agenticlinux/blob/main/packages.txt).

## Variants

The image comes in ten variants. Seven are built from Fedora 44 packages
on the
[fedora-ostree-desktops](https://quay.io/organization/fedora-ostree-desktops)
images, and three from CentOS Stream 10 packages (with EPEL) on the
[centos-bootc](https://quay.io/repository/centos-bootc/centos-bootc) image.
All are available for x86_64 and aarch64.

| Variant      | Built from       | Desktop    |
|--------------|------------------|------------|
| kde          | Fedora 44        | KDE Plasma |
| gnome        | Fedora 44        | GNOME      |
| sway         | Fedora 44        | Sway       |
| cosmic       | Fedora 44        | COSMIC     |
| xfce         | Fedora 44        | Xfce       |
| budgie       | Fedora 44        | Budgie     |
| base         | Fedora 44        | none       |
| centos-kde   | CentOS Stream 10 | KDE Plasma |
| centos-gnome | CentOS Stream 10 | GNOME      |
| centos-base  | CentOS Stream 10 | none       |

The images are `docker.io/ericcurtin044/agenticlinux:<variant>`. The
variants carry the same packages on both distributions, so the CentOS
list is what CentOS Stream 10, EPEL 10 and RPM Fusion have: GNOME and KDE
Plasma are the desktops that exist there.

## Install

Download the ISO for your desktop and architecture from the
[latest release](https://github.com/agenticlinux/agenticlinux/releases/latest),
boot it and install as usual. The ISO is a network installer preset to
pull the matching image from Docker Hub, so the install needs a network
connection. Disk, user and locale are chosen in the installer, with plain
xfs partitions as the default.

Or switch an existing bootc system:

```sh
sudo bootc switch docker.io/ericcurtin044/agenticlinux:kde
```

## Updates

The whole OS is one image, rebuilt every 4 hours and on every push to
`main`. The variant's tag (`kde`) is always the newest build. `/etc` and
`/var`, so your home directory, carry over between images.

```sh
bootc status                # running, staged and rollback images
sudo bootc upgrade          # fetch the newest image, boot into it next time
sudo bootc upgrade --apply  # the same, and reboot now
sudo bootc rollback         # boot the previous image next time; again to undo
```

A failed update also rolls back by itself. That is
[bootguard](@/blog/updates-that-roll-themselves-back-bootguard.md), the
subject of the next post.

Every build is also tagged `<variant>-<version>`, so you can pin one and
switch back to the variant's tag to follow the newest again.

Nothing updates on its own by default. bootc has a timer for it, which
checks an hour after boot and about every eight hours after that, and
reboots as soon as it finds a new image:

```sh
sudo systemctl enable --now bootc-fetch-apply-updates.timer
```

## Signing in

On a local model, through `llmman launch`, the agents need no account.
Otherwise sign in once per agent, for example `codex login` or
`openclaw onboard`. The ChatGPT app asks you to sign in when it first
starts. Credentials stay in your home directory, which updates leave
alone.

## How it is tested

CI builds every variant on both architectures and runs a smoke test in a
container of each image. It pulls a small local model and runs each agent
on it. Each x86_64 image is also installed to a disk and booted in `qemu`
with [test/smoke.sh](https://github.com/agenticlinux/agenticlinux/blob/main/test/smoke.sh),
which covers what needs a real boot: Docker (rootful and rootless) and
podman. Images are published only if every variant passes on both
architectures.

## Things to know

- The images are not signed. Pulling one, from the ISO or `bootc switch`,
  relies on Docker Hub over HTTPS.
- The NVIDIA kernel module is unsigned, so with an NVIDIA GPU you need to
  disable Secure Boot or enroll your own MOK.
- ChatGPT's Linux build is a preview.
- The desktop apps live in the read-only `/usr`, so they update with the
  image rather than by themselves.

The source is at
[agenticlinux/agenticlinux](https://github.com/agenticlinux/agenticlinux),
under the Apache-2.0 license.
