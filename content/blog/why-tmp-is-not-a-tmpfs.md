+++
title = "Why /tmp is not a tmpfs"
description = "On AgenticLinux, /tmp is /var/tmp bind-mounted over it. A tmpfs is limited by RAM, and a build that leaves gigabytes in /tmp should not be able to fill it."
date = 2026-11-04

[taxonomies]
tags = ["design", "systemd"]
+++

The Fedora and CentOS Stream images AgenticLinux is built from use a
tmpfs for `/tmp`, and AgenticLinux replaces it. `/tmp` is `/var/tmp`
mounted over `/tmp`, so the two are one directory on the root filesystem,
and RAM does not limit it.

The reason is what happens when a build leaves gigabytes behind. This post
covers the problem, the two small systemd pieces that fix it, and what
you give up.

<!-- more -->

## The problem with a tmpfs

A tmpfs is capped at half of RAM, and its pages are RAM, charged to
whatever wrote them. A build that leaves gigabytes in `/tmp` (a cargo
target directory, a Go build cache) fills it. Every write to `/tmp` after
that fails with `ENOSPC`, including a program's log file. For a
memory-mapped file the failure is `SIGBUS` instead, which is how a
linker's output fails.

The build is not the only casualty: every program that writes to `/tmp`
fails along with it.

## The mount

`/usr/lib/systemd/system/tmp.mount.d/10-bind-var-tmp.conf` is a drop-in
for systemd's `tmp.mount`:

```ini
[Mount]
What=/var/tmp
Type=none
Options=bind,nosuid,nodev
```

`/var/tmp` is on the root filesystem, so `/tmp` and `/var/tmp` become the
same directory. `nosuid` and `nodev` are what the tmpfs had. The root
filesystem for new installs is xfs, which holds `/var`, `/home` and
`/root` as well.

A symlink would give the same directory, but the root is read-only, so a
symlink could only be made in the image. systemd's `tmp.mount` also skips
itself when `/tmp` is a symlink, which would leave nothing to tell a
reader why `/tmp` is not a mount. A drop-in changes only what is mounted.
systemd still orders the mount before `local-fs.target` and after
whatever mounts `/var/tmp`, so units that declare `RequiresMountsFor=/tmp`
keep working. The bootguard boot unit does: `bootc status` writes a
temporary file in `/tmp`, and without the dependency the unit could run
before `tmp.mount`, while `/tmp` is still on the read-only root.

## Emptying it on shutdown

A tmpfs is empty after every boot. A directory on disk is not, so
`agenticlinux-clean-var-tmp.service` empties `/var/tmp`, and so `/tmp`, on
shutdown and reboot. The unit does nothing when it starts. Its work is
the `ExecStop` line:

```ini
ExecStop=-/usr/bin/systemd-tmpfiles --remove /usr/lib/agenticlinux/clean-var-tmp.conf
```

The file it names has one line, `D /var/tmp 1777 root root -`. A few
choices in it are worth explaining, because each has a comment in the
source:

- **`systemd-tmpfiles`, not `find` or `rm`.** It runs in SELinux's
  tmpfiles domain, which may remove every kind of file in `/tmp`, and it
  does not descend into mounts.
- **Not in `tmpfiles.d`.** That directory is read at boot too, where it
  could empty `/tmp` under a unit that is already using it. The file is
  outside it and is run only by this unit.
- **Ordering.** Units stop in reverse start order, so the unit starts
  before `sysinit.target`, ahead of every ordinary service, which makes it
  stop after them. It is also ordered before the bootguard arm step and
  the ostree and bootc finalizers, because bootc writes to `/tmp` there.
- **`Conflicts=shutdown.target`.** Without a `Conflicts=`, systemd never
  stops a unit like this one, and `ExecStop` would never run.
- **Best effort.** The leading `-` ignores failure, and the default stop
  timeout cuts the cleanup of a huge `/var/tmp` short.

## What you give up

- **Crashes and power loss.** Like a tmpfs, `/tmp` is emptied on shutdown
  and reboot, but a tmpfs is also empty after a crash. Here the cleanup
  does not run after a crash or power loss, so files survive it.
- **Aging.** While the system runs, `systemd-tmpfiles` removes files older
  than 10 days.
- **One directory.** `/var/tmp` is the same directory, so keep nothing
  there that must survive a reboot.
- **Disk space instead of RAM.** The space `/tmp` uses is the root
  filesystem's. A runaway build can still fill that, but it is no longer
  RAM that fills.

The pieces are small enough to read in full:
[the mount drop-in](https://github.com/agenticlinux/agenticlinux/blob/main/usr/lib/systemd/system/tmp.mount.d/10-bind-var-tmp.conf),
[the cleanup unit](https://github.com/agenticlinux/agenticlinux/blob/main/usr/lib/systemd/system/agenticlinux-clean-var-tmp.service)
and [the tmpfiles file](https://github.com/agenticlinux/agenticlinux/blob/main/usr/lib/agenticlinux/clean-var-tmp.conf).
