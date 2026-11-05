+++
title = "AgenticLinux on Apple Silicon: the 16k variants"
description = "The 16k- variants of AgenticLinux are the Fedora 45 variants with a 16 KiB-page kernel and the Asahi project's platform packages. We switched a Mac mini M1 to one, and this is how it is built, how to install it and what we did not test."
date = 2026-11-04

[taxonomies]
tags = ["announcement", "apple-silicon", "asahi", "16k"]
+++

AgenticLinux now has variants for Apple Silicon Macs. On a Mac mini M1 that
we switched to the KDE one, the kernel reports a 16 KiB page size, the
Plasma login screen comes up, the Wi-Fi joins on its own, the GPU shows up
in Vulkan as `Apple M1 (G13G B1)` on the Honeykrisp driver, and
`claude`, `codex`, `openclaw` and `goose` start.

This post covers what the `16k-` variants are, how they are built, how to
switch to one, what went wrong on the way, and what we did not test.

<!-- more -->

## What they are

Apple Silicon needs a kernel with 16 KiB pages, and Fedora's aarch64 kernel
has 4 KiB ones. The [Asahi project](https://asahilinux.org/fedora/)
maintains a kernel for these Macs, with a 16k build, plus the rest of what
a Mac needs: firmware loading, the m1n1 and U-Boot boot chain, a Mesa with
Apple's GPU drivers, audio and Touch Bar support.

A `16k-` variant is the Fedora 45 variant of the same name with those
swapped in. `16k-kde` is `kde` with the 16k kernel and the Asahi packages,
and the same goes for `gnome`, `sway`, `cosmic`, `xfce`, `budgie` and `base`.
It is named for the page size, not the hardware, so other 16 KiB-page
machines can follow. The branding is AgenticLinux's, as it is for every
variant: `/etc/os-release` says `AgenticLinux 45 (KDE Plasma)`. The kernel's
own version string still says `asahi`, which we cannot change.

They are aarch64 only. There is no NVIDIA driver, CUDA or ROCm in them: the
GPU is Apple's.

## How the build works

The `16k-` variants start from the same `fedora-ostree-desktops` image as
the ones without the prefix, and `build.sh` does the swap:

- It installs `asahi-repos`, which brings the Asahi project's kernel, Mesa and
  U-Boot repositories, then removes Fedora's kernel and installs
  `kernel-16k` and the Asahi platform packages.
- It pins Mesa, U-Boot and the kernel tools to the builds in the Asahi
  repositories. Those packages are already installed from Fedora's own,
  and dnf5 ignores repository priority for an installed package, so
  without the pin Fedora's builds stay.
- It copies GRUB into the `EFI/BOOT` directory of the image's bootloader
  payload, where U-Boot looks for it, and builds the new kernel's
  initramfs.
- It leaves out the NVIDIA packages.

The result has one kernel, `7.2.12-402.asahi.fc45.aarch64+16k`, and the
same Mesa (26.0.6), U-Boot (2026.07) and m1n1 (1.9.9) as the Asahi project's
own images at the time.

## Switching to one

There is no installer for these. The Asahi installer is what sets up m1n1
and U-Boot on the Mac, and it is theirs to run, so install an atomic
[Fedora Asahi Remix](https://github.com/fedora-asahi-remix-atomic-desktops/images#how-to-use)
first, then switch the installed system to AgenticLinux:

```sh
sudo bootc switch docker.io/ericcurtin044/agenticlinux:16k-kde
sudo systemctl reboot
```

`/home` and `/var` carry over, so the user, the Wi-Fi connection and the SSH
keys are still there after the reboot. The previous image stays as the
rollback. On our Mac, `bootc status` after the switch:

```
Booted image: 127.0.0.1:5000/agenticlinux:16k-kde
  Version: 45.20261104.0
Rollback image: quay.io/fedora-asahi-remix-atomic-desktops/base-atomic:44
  Version: 44.20260919.0
```

Our Mac was running Fedora Asahi Remix 44. The booted image is from a local
registry, because we switched before CI had published the images. They are
on Docker Hub now, as `16k-kde` and the other six, and as
`16k-fedora45-kde` and so on. Each also has a tag with the build's version.

### Check the disk first

The new image has to fit beside the old one. It is large: against the Asahi
base image it adds about 15 GB for KDE Plasma and about 14 GB with no
desktop. Our root filesystem is 111 GB and is 90% full after the switch, with 12 GB
free, and the old image is still on it. Look at
`btrfs filesystem usage /sysroot` first: a Mac that is already full needs
room made, and mounting with `compress=zstd:1` roughly halves the size.

## What went wrong

**The first boot rolled back.** The boot guard confirms a new deployment
only if the machine passes its health check, and the one on our Mac requires
`sshd` to be listening. The desktop images do not enable `sshd`, so our
first attempt was rolled back. We enabled it in the new deployment and the
next boot was confirmed.

**Repository priority was not enough.** Fedora's Mesa and U-Boot are
already in the base image, and dnf5 does not let a lower-numbered
repository replace an installed package. That is why `build.sh` pins them.

**The first CI push failed.** The first run of the new workflow built and
smoke-tested all seven variants, then `docker push` of each failed with
`insufficient_scope: authorization failed`. A small test image pushed from
the same runners and login without trouble, and we did not find the cause.
The workflow now pushes the OCI archive with `skopeo copy`, and the second
run published all seven.

**The `docker` group.** After the switch the system came up `degraded`:
`docker.socket` failed with `Failed to resolve group 'docker'`. The image's
`/etc/group` has the group, but a switched machine keeps its own, and
the image's line never arrives. We fixed our Mac by hand with `groupadd`.
The images now declare the group for `systemd-sysusers`, which creates it
at boot if it is missing. We tested that by running `systemd-sysusers` in
a container, not by booting an image with it.

## What we did not test

- Only the KDE variant was switched to, and only on one Mac, an M1 mini.
  The other desktops are built the same way, but nobody has booted them.
- Nothing about the hardware beyond the boot, the Wi-Fi, Plasma's login
  screen and Vulkan was checked: not audio, suspend, the camera,
  Thunderbolt or the Touch Bar.
- The agents were only started, with `--version`. We did not run a model on
  them, and the mini has 8 GB of memory.
- We switched from an image built on the DGX Spark, not from the
  published one, so the `bootc switch` command above has not been run
  against Docker Hub. The published images are a CI build of the same code,
  smoke-tested in a container, but not booted.
- The images are built on an aarch64 runner and tested in a container only:
  CI has no Apple hardware to boot one on.

Questions and problems go to the
[issue tracker](https://github.com/agenticlinux/agenticlinux/issues).
