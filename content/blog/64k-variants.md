+++
title = "AgenticLinux with 64 KiB pages: the 64k variants"
description = "The 64k- variants of AgenticLinux are the Fedora 45 variants with a 64 KiB-page kernel, for the NVIDIA DGX Spark and other aarch64 machines. Fedora has no such kernel, so we build one from its source. This is how it is built, how to switch to one and what we did not test."
date = 2026-11-09

[taxonomies]
tags = ["announcement", "64k", "aarch64", "dgx-spark"]
+++

AgenticLinux now has `64k-` variants: the Fedora 45 variants with a kernel
built for 64 KiB pages, for the NVIDIA DGX Spark (GB10, aarch64) and other
Arm machines. Fedora does not ship a 64k kernel, so CI builds one from
Fedora's kernel source. None of this has been booted yet, on a Spark or
anywhere else: CI builds the images and smoke-tests them in a container.

This post covers what the `64k-` variants are, why the page size matters,
how the kernel and the images are built, how to switch to one, what went
wrong on the way, and what we did not test.

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

## Why the page size matters

The page is the unit the kernel maps memory in. With 64 KiB pages, 16 times
the memory is covered by one page table entry, and by one TLB entry, than
with the 4 KiB pages of Fedora's aarch64 kernel. That helps machines with a
lot of memory and large working sets, and the DGX Spark has 128 GB shared by
the CPU and the GPU. The repository names the Spark and "other Arm servers"
as the targets. Fedora's own `kernel.spec` has a 64k variant and turns it
off, and a comment in `kernel64k.sh` gives the reason: RHEL ships it.

There is a cost. Memory is handed out in 64 KiB units, so many small files
and small mappings waste more of it, and software written with 4 KiB pages
in mind can misbehave. We have not measured either effect, and we do not
claim the Spark is faster, or needs this, with 64 KiB pages. The variants
exist so that you can try it.

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
runs the agents on a small local model (`qwen3.5:0.8b`) through llmman.

A container uses the runner's kernel, not the image's. No hosted runner
has a 64 KiB-page arm64 machine or can boot an arm64 VM, so the 64k kernel
is not run by CI at all. What CI shows is that the kernel builds, that the
image builds around it, and that the userspace works.

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
these are plain tags, not manifest lists. We have not looked at the registry
since the workflow was added, so check it for the tags before relying on
them.

## Switching to one

From a running AgenticLinux, or any bootc system, switch and reboot:

```sh
sudo bootc switch docker.io/ericcurtin044/agenticlinux:64k-kde
sudo systemctl reboot
```

`/home` and `/var` carry over and the previous image stays as the rollback.
Turn Secure Boot off first, as for the NVIDIA module on every image. The
image is large: the 16k post has the numbers for the other variants, and
`btrfs filesystem usage /sysroot` shows what you have. We have not measured
the 64k ones.

To install onto a Spark that still runs its stock Ubuntu, the steps in
[the Spark post](@/blog/dgx-spark-support.md), `bootc install
to-existing-root` and what to do before the first reboot, are the ones to
start from, with a `64k-` tag in place of `kde`. We have not run them with a
`64k-` image.

To build one yourself, name the kernel stage, which takes hours:

```sh
docker build --target chunked --build-arg VARIANT=64k-kde --build-arg KERNEL=kernel64k \
  --build-arg BASE=quay.io/fedora-ostree-desktops/kinoite:45 -o type=tar,dest=image.tar .
```

## What went wrong, and the fixes

These come from the build scripts, their comments and the commit messages,
not from a boot.

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

- No `64k-` image has been booted: not on a DGX Spark, not on any other
  aarch64 machine, not in a VM. CI runs its smoke test in a container.
- The 64k kernel has not been run, so we do not know that it boots on the
  Spark's firmware, or what Fedora's aarch64 configuration with the 64k
  options does there. Only the page-size options differ from Fedora's, but
  we have not tried it.
- The NVIDIA module is built for the kernel when RPM Fusion's driver builds.
  Whether it builds, loads and works on a 64 KiB-page kernel, on the GB10
  or on another GPU, is untested.
- `bootc switch` to a published `64k-` tag, and `bootc install
  to-existing-root` with one, have not been run.
- Nothing was measured: not memory use, not performance, not how local
  models or the agents behave with 64 KiB pages compared with 4 KiB ones.
- Software that assumes a 4 KiB page size has not been looked for.
  Nothing beyond what the smoke test starts has been run.
- All seven desktops are built the same way, and nobody has used any of
  them.
- Other Arm servers are named as targets, and none has been tried.
- Secure Boot is off in every case above, because the kernel's modules are
  signed with a key made for the build. Enrolling a key was not tried.

Questions and problems go to the
[issue tracker](https://github.com/agenticlinux/agenticlinux/issues).
