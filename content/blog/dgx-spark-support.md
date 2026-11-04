+++
title = "AgenticLinux on the NVIDIA DGX Spark"
description = "AgenticLinux now runs on the DGX Spark (NVIDIA GB10, aarch64): the NVIDIA 580 driver, claude, codex, opencode and openclaw on a local Qwen 3.8 27B through llmman, and how we installed it over the stock Ubuntu."
date = 2026-11-04

[taxonomies]
tags = ["announcement", "nvidia", "dgx-spark"]
+++

AgenticLinux now runs on the NVIDIA DGX Spark. On a Spark running the KDE
variant, `nvidia-smi` sees the GB10 GPU with the 580.196.07 driver, the
Wi-Fi, NetworkManager and `sshd` come up on their own, and the agents run on
a local Qwen 3.8 27B.

This post covers the driver, the agents running on the Spark, how we
installed AgenticLinux over the Spark's stock Ubuntu, and what we did not
test.

<!-- more -->

## The NVIDIA driver

AgenticLinux builds the NVIDIA kernel module into the image. On aarch64 it
now uses NVIDIA's 580 series, the one the Spark's stock Ubuntu runs
(580.178 on ours), with the CUDA driver libraries from the matching package.
The module builds for Fedora's 7.2.15 kernel. `nvtop` is in the image too,
so there is a `top` for the GPU out of the box.

## Local models on the Spark

The point of the machine is the agents, and with 128 GB of memory shared by
the CPU and the GPU, the Spark can run them on a model of its own.
AgenticLinux has `claude`, `codex`, `opencode`, `openclaw` and `goose`
installed, and [llmman](https://github.com/llmmanorg/llmman) to run any of
them on a local model:

```sh
llmman launch claude --model qwen3.8:27b-nvfp4
```

Everything below runs Qwen 3.8 27B (the `27b-nvfp4` build) on the GB10
through llmman. No hosted model is involved.

llmman runs this model with vLLM in a container. On the Spark that needed a
few settings, in the environment of the llmman daemon:

```sh
export LLMMAN_VLLM_ARGS="--gpu-memory-utilization 0.80 --enable-auto-tool-choice --tool-call-parser qwen3_coder --reasoning-parser qwen3"
export LLMMAN_LOAD_TIMEOUT=30m
llmman serve
```

The first start takes about ten minutes, and the loaded model holds about
92 GiB of memory.

<figure>
<img src="https://github.com/agenticlinux/agenticlinux.github.io/releases/download/assets/dgx-spark-nvidia-smi.png" alt="nvidia-smi on the Spark: an NVIDIA GB10, driver 580.196.07, CUDA 13.0, and vLLM's engine using 94058 MiB" width="1132" height="812">
<figcaption><code>nvidia-smi</code> on the Spark with the model loaded: the GB10, driver 580.196.07 and CUDA 13.0, and vLLM's engine holding about 92 GiB.</figcaption>
</figure>

### Claude Code, Codex and OpenCode

The three terminal agents got the same question, `explain what git stash does
in one sentence`, through `llmman launch` with `--model qwen3.8:27b-nvfp4`.
The sessions ran on the Spark and were recorded there. In the videos, pauses
longer than three seconds are shortened.

<figure>
<video controls preload="none" poster="https://github.com/agenticlinux/agenticlinux.github.io/releases/download/assets/dgx-spark-llmman-claude.png" width="1228" height="812">
<source src="https://github.com/agenticlinux/agenticlinux.github.io/releases/download/assets/dgx-spark-llmman-claude.webm" type="video/webm">
<source src="https://github.com/agenticlinux/agenticlinux.github.io/releases/download/assets/dgx-spark-llmman-claude.mp4" type="video/mp4">
</video>
<figcaption>Claude Code on Qwen 3.8 27B. Its notice that the model is not recognized is Claude Code's own: it does not know a local model's context size.</figcaption>
</figure>

<figure>
<video controls preload="none" poster="https://github.com/agenticlinux/agenticlinux.github.io/releases/download/assets/dgx-spark-llmman-codex.png" width="1228" height="812">
<source src="https://github.com/agenticlinux/agenticlinux.github.io/releases/download/assets/dgx-spark-llmman-codex.webm" type="video/webm">
<source src="https://github.com/agenticlinux/agenticlinux.github.io/releases/download/assets/dgx-spark-llmman-codex.mp4" type="video/mp4">
</video>
<figcaption>Codex on the same model. Codex asks to trust the folder every time it starts, so the recording presses Enter once.</figcaption>
</figure>

<figure>
<video controls preload="none" poster="https://github.com/agenticlinux/agenticlinux.github.io/releases/download/assets/dgx-spark-llmman-opencode.png" width="1228" height="812">
<source src="https://github.com/agenticlinux/agenticlinux.github.io/releases/download/assets/dgx-spark-llmman-opencode.webm" type="video/webm">
<source src="https://github.com/agenticlinux/agenticlinux.github.io/releases/download/assets/dgx-spark-llmman-opencode.mp4" type="video/mp4">
</video>
<figcaption>OpenCode on the same model, answering in about three seconds of thinking.</figcaption>
</figure>

### OpenClaw

[OpenClaw](https://github.com/openclaw/openclaw) has a web Control UI. Its
gateway and the model ran on the Spark; the browser was Chrome on another
machine, connected through an SSH tunnel. The question needed real work, not a recalled
answer: `Check this machine's health: failed systemd units, disk and memory.
Keep it short.` OpenClaw ran commands on the Spark and reported.

<figure>
<video controls preload="none" poster="https://github.com/agenticlinux/agenticlinux.github.io/releases/download/assets/dgx-spark-openclaw.png" width="1440" height="900">
<source src="https://github.com/agenticlinux/agenticlinux.github.io/releases/download/assets/dgx-spark-openclaw.webm" type="video/webm">
<source src="https://github.com/agenticlinux/agenticlinux.github.io/releases/download/assets/dgx-spark-openclaw.mp4" type="video/mp4">
</video>
<figcaption>OpenClaw's web Control UI, on Qwen 3.8 27B through llmman, checking the Spark's health. It took 47 seconds.</figcaption>
</figure>

<figure>
<img src="https://github.com/agenticlinux/agenticlinux.github.io/releases/download/assets/dgx-spark-openclaw.png" alt="OpenClaw's reply: two failed units, plymouth-start and systemd-suspend; 3.7T disk, 34% used; 119Gi of memory with only 12Gi available" width="1440" height="900">
<figcaption>What it found: two failed units (<code>plymouth-start</code> and <code>systemd-suspend</code>), a disk 34% full, and only 12 GiB of memory available. The last is the model server: vLLM is holding about 92 GiB.</figcaption>
</figure>

The reply is the model's own reading of the output, so treat its judgements
as the model's: it called both failed units cosmetic, and we did not check
that.

## Installing over the stock Ubuntu

Our Spark came with Ubuntu 24.04 on a single NVMe disk, split into the
EFI system partition and the root filesystem and nothing else. We
installed AgenticLinux onto that disk without booting an installer, with
`bootc install to-existing-root`, run from a container of the image on the
running Ubuntu:

```sh
sudo docker run --rm --privileged --pid=host \
  -v /dev:/dev -v /:/target \
  -v "$HOME/.ssh/authorized_keys:/root_keys:ro" \
  docker.io/ericcurtin044/agenticlinux:kde \
  bootc install to-existing-root --acknowledge-destructive \
  --source-imgref docker://docker.io/ericcurtin044/agenticlinux:kde \
  --target-imgref docker.io/ericcurtin044/agenticlinux:kde \
  --root-ssh-authorized-keys /root_keys
```

This replaces the bootloader and `/boot`, so the machine boots
AgenticLinux next and Ubuntu no longer starts. It does not delete the
rest of the disk. The old root is still there after the reboot, mounted
read-only at `/sysroot`, so the old home directory is at
`/sysroot/home/<user>`. The `--root-ssh-authorized-keys` option gives root
your key, which is a way in if the account set up below does not work.

We installed from an image built on the Spark, with `podman run`. The
`docker run` form above, which pulls the image from the registry, is the
same install but has not been run.

## What to do before the first reboot

A bootc image carries no user accounts and no network configuration, and
the Spark we used had only Wi-Fi connected. Before rebooting, we wrote
into the new deployment, under `/ostree/deploy/default/deploy/*.0/etc`
and `/ostree/deploy/default/var`:

- **A user.** Entries in `passwd`, `group` and `shadow`, the home
  directory in `/var/home`, and an `authorized_keys` file.
- **The network.** The Wi-Fi connection as a NetworkManager keyfile in
  `/etc/NetworkManager/system-connections`. The Spark's MediaTek MT7925
  uses the kernel's `mt7925e` driver, and its firmware is in the image.
- **`sshd`.** The image does not enable it, so a symlink in
  `multi-user.target.wants`.

The machine took a new DHCP address after the install, so the old one
did not answer. `avahi` is in the image, so `<hostname>.local` did.

## What went wrong, and the fixes

**SELinux labels.** Files written from Ubuntu have no SELinux labels, and
the first boot logged denials against them, `sshd` reading our
`authorized_keys` file among them. We booted that first time with
`enforcing=0`, ran `restorecon` on the files we had
added, checked that nothing under `/etc` or `/var/home` was still
`unlabeled_t`, and removed the argument.

**Staged updates did not apply.** With no separate `/boot` partition,
`systemd-gpt-auto-generator` creates a `boot.automount` that mounts the
EFI system partition on `/boot`, on top of ostree's bind mount of the
root's `/boot`. At shutdown `ostree-finalize-staged` failed with
`Remounting /boot read-write: Invalid argument`, so a staged deployment
never took effect, and `bootc upgrade` would have hit the same wall.
Masking the unit fixed it:

```sh
sudo ln -sf /dev/null /etc/systemd/system/boot.automount
```

We checked by staging a throwaway kernel argument and rebooting: it
applied. The images do not do this for you, because it only matters on
a disk without its own `/boot`; the Spark's layout is one.

**Secure Boot.** The NVIDIA module is unsigned, as it is on every
AgenticLinux image. Secure Boot was off on our Spark. If yours has it on,
disable it or enroll your own MOK.

## What we did not test

- Only the KDE variant was installed, and only on aarch64. The other
  desktops share its build, and their base images exist for both
  architectures, but they have not been built yet.
- The agents were tried on one question each, and only OpenClaw's used
  tools. None of this measures how well a 27B model codes or how quickly an
  agent finishes real work.
- The vLLM settings above worked on our machine with llmman 0.1.614. Other
  versions may need different ones.
- Nothing about the desktop on the Spark's display was checked. We tested
  from the command line and the network.
- The wired ports were not connected, so only Wi-Fi was exercised. The
  image has the kernel drivers for the Spark's other network controllers,
  and they are untested.
- The ISO is untested on a Spark.
- The `init_on_alloc=0` and `pci=pcie_bus_safe` kernel arguments came
  from the Spark's stock command line. We added them to the install and
  have not tried without them.

Questions and problems go to the
[issue tracker](https://github.com/agenticlinux/agenticlinux/issues).
