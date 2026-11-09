+++
title = "AgenticLinux on the DGX Spark with 64 KiB pages: the 64k variants"
description = "The 64k- variants of AgenticLinux are the Fedora 45 variants with a 64 KiB-page kernel, built from Fedora's source. We booted 64k-fedora45-kde on the DGX Spark: the page size is 65536, the NVIDIA 580 module loads, and a CUDA 13 llama.cpp container runs a model on the GPU. The system came up degraded, and this is what we saw."
date = 2026-11-09

[taxonomies]
tags = ["announcement", "64k", "aarch64", "dgx-spark"]
+++

AgenticLinux now has `64k-` variants, and we have booted one on the NVIDIA
DGX Spark. The Spark already ran the 4 KiB-page KDE image, and the
`64k-fedora45-kde` tag is its new deployment, with the 4 KiB one kept as the
rollback. It runs kernel `7.2.15-300.fc45.aarch64+64k`, `getconf PAGESIZE`
says `65536`, `nvidia-smi` sees the GB10 with the 580.196.07 driver and the
module built for the 64k kernel, and Docker runs a CUDA 13 llama.cpp
container on the GPU, where a small model answers. The system is `degraded`,
with four failed units, one of them new.

This post covers what the `64k-` variants are, why 64 KiB pages, what we
looked at on the Spark, how the kernel and the images are built, how to
switch to one, what went wrong, and what we did not test.

<!-- more -->

## What they are

A `64k-` variant is the Fedora 45 variant of the same name with its kernel
swapped for one with 64 KiB pages. `64k-kde` is `kde` with the 64k kernel,
and the same goes for `gnome`, `sway`, `cosmic`, `xfce`, `budgie` and
`base`. Each is also published as `64k-fedora45-<desktop>`.

The naming is the one the [16k variants](@/blog/apple-silicon-16k-variants.md)
use: it is the kernel's page size, not the hardware, so other 64 KiB-page
machines are not excluded. The two differ in where the kernel comes from:

- The `16k-` kernel is the Asahi project's, installed with their platform
  packages, for Apple Silicon. There is no NVIDIA driver in those images.
- The `64k-` kernel is built by AgenticLinux, from Fedora's own source, and
  nothing else of the system is swapped. The NVIDIA driver is built for it,
  as for the other aarch64 images.

They are aarch64 only, and Fedora only: `build.sh` refuses a `64k-` variant
on x86_64 or on CentOS Stream.

The repository names the DGX Spark and "other Arm servers" as the targets.
We have tried the Spark only. No other Arm server has run one.

## Why 64 KiB pages

The page is the unit the kernel maps memory in. With 64 KiB pages, one page
table entry, and one TLB entry, covers 16 times the memory it does with the
4 KiB pages of Fedora's aarch64 kernel. A page-table page of 8-byte entries
then holds 8192 of them, which maps 512 MiB, and that is the kernel's huge
page on the Spark: `/proc/meminfo` says `Hugepagesize` is 524288 kB. This
matters most for machines with a lot of memory and large working sets, and
the Spark has 128 GB shared by the CPU and the GPU.

Fedora's own `kernel.spec` has a 64k variant and turns it off, and a comment
in `kernel64k.sh` gives the reason: RHEL ships it.

There are costs. Memory is handed out in 64 KiB units, so many small files
and small mappings can waste more of it, and software written with 4 KiB
pages in mind can misbehave. Nothing was benchmarked. We did not compare
memory use or speed with the 4 KiB kernel, and this post does not claim the
Spark is faster, or uses less memory, with 64 KiB pages.

## On the Spark

The Spark is the one in [the Spark post](@/blog/dgx-spark-support.md). Its
KDE image was moved to the 64k tag, and it has run the 64k kernel since
Nov 6, with no reboot since. What we looked at, on Nov 9, was read-only
inspection over SSH and one small model run.

```sh
uname -r
getconf PAGESIZE
```

```
7.2.15-300.fc45.aarch64+64k
65536
```

The kernel:

- `kernel-64k-core-7.2.15-300.fc45.aarch64` is installed, and is the only
  directory in `/usr/lib/modules`.
- The running configuration has `CONFIG_ARM64_64K_PAGES=y`, `CONFIG_ARM64_4K_PAGES`
  not set, `CONFIG_ARM64_VA_BITS=48` and `CONFIG_TRANSPARENT_HUGEPAGE=y`.
  Transparent huge pages are set to `madvise`.
- `/sys/kernel/mm/hugepages` lists 2048 kB, 524288 kB and 16777216 kB sizes.
- Python's `mmap.PAGESIZE` is 65536 as well.

The image:

- `/usr/lib/os-release` says `NAME=AgenticLinux`, `VERSION="45 (KDE Plasma)"`
  and `VARIANT_ID=64k-fedora45-kde`.
- There are two ostree deployments. The booted one has the origin
  `ostree-unverified-registry:docker.io/ericcurtin044/agenticlinux:64k-fedora45-kde`.
  The other has `docker.io/ericcurtin044/agenticlinux:fedora45-kde`, the 4 KiB
  image it ran before, and is the rollback.
- SELinux is enforcing, Secure Boot is disabled, and the boot is EFI. The
  disk is a 3.7 TB NVMe with the root on ext4 at `/sysroot`.

The NVIDIA driver:

- `nvidia-smi` shows an NVIDIA GB10, driver 580.196.07 and CUDA 13.0. Its
  memory usage reads `Not Supported` and `N/A`, as the GB10 shares memory
  with the CPU.
- `modinfo nvidia` points at
  `/lib/modules/7.2.15-300.fc45.aarch64+64k/extra/nvidia-580xx/nvidia.ko.xz`,
  from the package `kmod-nvidia-580xx-7.2.15-300.fc45.aarch64+64k`. So the
  module that CI builds on a best-effort basis did build, loads and works on
  the 64k kernel here.
- `nvidia-smi` lists `kwin_wayland` as a graphics client.

A model on the GPU, run through llmman, which was already serving:

```sh
llmman run qwen3.5:0.8b "Reply with one sentence: what is a page table?"
```

It answered correctly, in 12.6 seconds of wall-clock time including the load.
While it ran, `nvidia-smi --query-compute-apps` listed `/app/llama-server`
using 4499 MiB, and `llmman ps` showed the processor as `llama-server` in a
container under Docker, with a context of 262144. The container image is
`ghcr.io/ggml-org/llama.cpp:server-cuda13-b11960`. So Docker, a CUDA 13
container and llama.cpp's CUDA backend work with the 64 KiB kernel on the
GB10, with a small model.

Also seen: Wi-Fi is up with an address, `sshd` and NetworkManager are active,
and `llmman 0.1.621`, `claude`, `codex`, `opencode`, `openclaw`, `goose`,
`nvtop`, `docker` and `podman` are on the `PATH`.

## How the kernel is built

Fedora's `kernel.spec` has the 64k variant but forces it off, and Fedora
has no configuration for it. [kernel64k.sh](https://github.com/agenticlinux/agenticlinux/blob/main/kernel64k.sh)
does the work, in a Fedora 45 container on an aarch64 machine:

- It takes the newest Fedora 45 kernel, or the one named by `KERNEL_NVR`,
  and downloads its source package from Fedora's build system.
- It edits `kernel.spec` to switch the 64k variant on.
- It makes the configuration: Fedora's aarch64 one, with the options that
  differ between Fedora's own RT kernel and its RT 64k kernel applied. That
  is only page-size options, and the script stops if the difference grows
  to 20 options or more.
- It replaces `sha512hmac`, which the kernel build uses for its FIPS
  checksum, with a version that uses `openssl`. The original asks the
  running kernel for `hmac(sha512)` over `AF_ALG`, which a container's host
  may not offer. The output is the same.
- It builds only the 64k kernel, without the stock and debug kernels,
  tools, perf, documentation or selftests.

The output is the `kernel-64k`, `-core`, `-modules`, `-modules-core`,
`-modules-extra`, `-devel` and `-devel-matched` RPMs. The kernel's modules
are signed with a key made for the build, not Fedora's, so Secure Boot has
to be off.

## How the images are built

The `Build 64k` workflow has two stages, on GitHub's aarch64 runners.

A `kernel` job finds the newest Fedora 45 kernel version and builds the RPMs
with `kernel64k.sh`. This takes hours, so the result is cached by kernel
version and the script's hash, and a cache miss rebuilds it. The RPMs go to
the next stage as an artifact. No kernel image is published.

Then a `build` job per desktop runs the Dockerfile on the same
`fedora-ostree-desktops` base image the variant without the prefix uses
(`kinoite` for KDE, `silverblue` for GNOME, and so on). `build.sh`:

- removes Fedora's kernel and installs the five `kernel-64k` runtime RPMs,
- installs the `-devel` RPMs from the same build, builds the NVIDIA module
  for the new kernel and removes the build-time packages again,
- builds the initramfs for the new kernel with `dracut`, as the `16k-`
  variants do.

The NVIDIA driver is RPM Fusion's 580xx stream on Fedora 45 aarch64, the
branch the GB10's driver is on. On aarch64 that build is best effort: if
it fails, `build.sh` prints a warning and the image is built without the
driver, and with nouveau. The smoke test does not check for the module, so
whether a given image has it is something to check on the image:

```sh
modinfo -k "$(uname -r)" nvidia
```

The workflow runs on every push to `main` and every twelve hours.

## What CI tests

Each variant goes through the same container smoke test as the others:
the image is loaded, its layer count is checked against a limit of 100, and
`smoke-vm` runs in a container of it. That script runs `bootc status`,
runs `--version` on `sbx`, `llmman`, `herdr`, the agents and a few other
tools, checks that the desktop applications' shared libraries resolve, and
runs each agent on a one-word prompt with a small local model
(`qwen3.5:0.8b`) through llmman.

A container uses the runner's kernel, not the image's. No hosted runner
has a 64 KiB-page arm64 machine or can boot an arm64 VM, so CI does not boot
the 64k kernel. What CI shows is that the kernel builds, that the image
builds around it, and that the userspace works. The boot above was done by
hand, on the Spark.

## Tags

For each of the seven desktops the workflow pushes four tags, with the
registry and name the other posts use:

| Tag | Example |
|-----|---------|
| `64k-<desktop>` | `docker.io/ericcurtin044/agenticlinux:64k-kde` |
| `64k-<desktop>-<version>` | |
| `64k-fedora45-<desktop>` | `docker.io/ericcurtin044/agenticlinux:64k-fedora45-kde` |
| `64k-fedora45-<desktop>-<version>` | |

The version is `45.<date>.<run number>`. There is one architecture, so
these are plain tags, not manifest lists. The `64k-fedora45-kde` tag is on
Docker Hub, and it is the origin of the Spark's booted deployment. We did
not record which version of it that is, and we have used only the KDE tags.

## Switching to one

From a running AgenticLinux, or any bootc system, switch and reboot:

```sh
sudo bootc switch docker.io/ericcurtin044/agenticlinux:64k-kde
sudo systemctl reboot
```

`/home` and `/var` carry over and the previous image stays as the rollback.
That is what the Spark's two deployments show: the booted origin is the
`64k-fedora45-kde` registry tag and the other is the `fedora45-kde` one. We
could not run `bootc status` there, which needs root, and we did not observe
which command was typed, so we do not claim it was the one above.

Turn Secure Boot off first, as for the NVIDIA module on every image. It is
off on the Spark. The image is large and has to fit beside the old one, so
look at the free space first, for example with `df -h /sysroot`. We did not
measure the size of the 64k images, and the Spark's 3.7 TB disk was no test
of a small one.

To build one yourself, name the kernel stage, which takes hours:

```sh
docker build --target chunked --build-arg VARIANT=64k-kde --build-arg KERNEL=kernel64k \
  --build-arg BASE=quay.io/fedora-ostree-desktops/kinoite:45 -o type=tar,dest=image.tar .
```

## What went wrong, and what we saw

### Booting it

The system on the Spark is `degraded`: `systemctl is-system-running` says so,
with four failed units. We looked into each one, read-only and over SSH, so
the causes below come from the journal, the coredump metadata and the
upstream source. We had no root on the Spark, so no fix has been tried there.

**`tuned-ppd.service` is new compared with the Spark post.** Python died at
start, at `from _ctypes import Union, Structure, Array`, with a `MemoryError`.
The journal has an SELinux denial for each start:

```
avc: denied { write } for comm="tuned-ppd" path="/memfd:libffi (deleted)"
  scontext=system_u:system_r:tuned_ppd_t:s0 tcontext=system_u:object_r:tmpfs_t:s0 tclass=file
```

So `import ctypes` asks libffi for a closure, libffi writes to a memfd, and the
`tuned_ppd_t` domain is not allowed to. The same `python3` as an ordinary user
imports `ctypes` and makes a closure without trouble. We do not know why it
fails here and not elsewhere. An x86_64 Fedora 45 machine with 4 KiB pages,
the same `selinux-policy` (45.23), `libffi` (3.5.2) and `tuned-ppd` (2.28.0),
runs the service. We did not boot the Spark's 4 KiB image to see whether it
has the same denial, so we cannot say 64 KiB pages are the cause. No fix has
been sent upstream for this one: we could not reproduce it without root on
the Spark.

**`plymouth-start.service` crashed, and it is a plymouth bug.** The coredump
metadata has the stack `strcmp` called from `main`. On the Spark `/proc/consoles`
is empty (0 bytes, and the kernel command line has no `console=`), so
`ply_get_primary_kernel_console_type()` returns `NULL`, and
`plymouthd_console_type_is_virtual()` passes it to `strcmp()`. The Spark post
also listed this unit as failed on the 4 KiB image, so it is not new with 64
KiB pages. We have a patch that treats a missing console as not virtual, with a
test that segfaults without it and passes with it, built and run in a Fedora 45
container. It is
[merge request 525](https://gitlab.freedesktop.org/plymouth/plymouth/-/merge_requests/525)
on plymouth's GitLab, not merged as we write this, and nothing was tried on the
Spark.

**`systemd-suspend.service` failed.** A suspend was tried on Nov 6, a few
minutes after boot, by KDE's power management. The kernel log has
`nvidia 000f:01:00.0: PM: pci_pm_suspend(): nv_pmops_suspend [nvidia] returns
-5`. `nvidia-suspend.service` and `nvidia-resume.service` are disabled, though
the driver package's preset enables them, and the driver is set to preserve video
memory (`PreserveVideoMemoryAllocations: 1`), which is when NVIDIA expects
them. We think that is the cause, and
[a change](https://github.com/agenticlinux/agenticlinux/pull/58) enables them in the image, but we
have not tried it: suspend was not retried on the Spark, and we do not know
that suspend works on a GB10. This one is in the Spark post too.

**`efi.automount` failed.** `Failed to check directory /efi: No such file or
directory`. With no `/etc/fstab`, systemd's `gpt-auto-generator` makes this
unit for `/efi` and relies on the automount to create the directory, which it
cannot on a read-only root. We
[reported it to systemd](https://github.com/systemd/systemd/issues/44735), and
the same change ships an empty `/efi` in the image. That is also untested on
the Spark.

The early-boot log (`journalctl -b -p err`) also has firmware and initrd
errors, from the CMA reservation to `Failed to resolve group` lines from
`systemd-tmpfiles` and `udev`. We did not look into them or compare them with
the 4 KiB kernel, so we do not attribute any of them to 64 KiB pages.

### Building it

These come from the build scripts, their comments and the commit messages.

**Fedora has no 64k kernel.** The variant is in `kernel.spec` but forced off
before the `%if` that reads it, and there is no configuration for it. The
script inserts the switch before that `%if`, and asserts that it matches
exactly once, so a change in Fedora's spec fails the build instead of
building the wrong kernel. The configuration is derived from Fedora's own,
as above.

**The kernel's checksum tool.** The build's FIPS checksum step needs the
host kernel to offer `hmac(sha512)` over `AF_ALG`, and a container's host
may not. Hence the `openssl` replacement.

**The development package has another name.** The 64k kernel's modules
directory ends in `+64k`, and its `-devel` package is named without that.
`build.sh` strips the suffix when it removes the package after building the
NVIDIA module.

**Docker Hub answered 502.** The registry failed a push in the main `Build`
workflow on a blob `HEAD` request, and failed the whole job. That workflow
now retries its pushes and its manifest creation. The `Build 64k` workflow
pushes with `skopeo copy --retry-times 3`, as `Build 16k` does since its
first push failed with `insufficient_scope`.

## What we did not test

- The Qwen 3.8 27B model of the Spark post was not run on the 64k kernel, and
  neither was vLLM. Only `qwen3.5:0.8b` on llama.cpp was.
- The coding agents (`claude`, `codex`, `opencode`, `openclaw`) were not run
  on the 64k kernel. Only the CI smoke test, in a container, has run them.
- Nothing was compared with the 4 KiB kernel: no benchmark, no memory use,
  no model speed.
- The desktop on the Spark's display was not looked at. `kwin_wayland` runs
  and a `plasma-setup` session sits on `tty1`, but nobody completed Plasma's
  first-run setup, so nobody has logged in to the desktop there.
- Only Wi-Fi was exercised. The wired ports were down, with nothing plugged in.
- Suspend: it failed on Nov 6, as above, and was not retried.
- Only the KDE variant was booted. The other six are built the same way, and
  nobody has used them.
- Other Arm servers are named as targets, and none has been tried. No other
  64 KiB-page machine has either.
- Software that assumes a 4 KiB page size has not been looked for.
- Whether the `tuned-ppd` denial happens on the 4 KiB kernel on aarch64, and
  what fixes it: it has not been reproduced or fixed.
- Any of the fixes for the four failed units on the Spark itself.
- Secure Boot is off on the Spark, because the kernel's modules are signed
  with a key made for the build. Enrolling a key was not tried.
- Installing over a stock Ubuntu with a `64k-` image, the route in the Spark
  post, was not tried. This Spark was moved from the 4 KiB AgenticLinux
  image.

Questions and problems go to the
[issue tracker](https://github.com/agenticlinux/agenticlinux/issues).
