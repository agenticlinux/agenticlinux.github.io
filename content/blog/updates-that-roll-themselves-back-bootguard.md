+++
title = "Updates that roll themselves back: bootguard"
description = "How AgenticLinux returns to the previous image when a bootc update does not come up healthy: a boot counter armed before the first boot, preflight checks, health checks and a watchdog."
date = 2026-11-04

[taxonomies]
tags = ["bootc", "bootguard", "updates"]
+++

`bootc rollback` gets you back to the previous image, but only if you can
still run it. An update that never reaches userspace, or reaches it and
hangs, leaves you at a firmware prompt or an emergency shell instead.

bootguard is the part of AgenticLinux that handles this. A newly applied
deployment gets a limited number of boot attempts. If it does not come up
healthy within them, the machine returns to the previous deployment by
itself and remembers not to try that image again.

<!-- more -->

It lives in the repository as `bootguard/`, is written in Rust, and
covers `bootc upgrade --apply`. It replaces
[greenboot](https://github.com/fedora-iot/greenboot-rs), and the two
should not be installed together.

## The failures it is meant for

- Failures that never reach userspace: a bad kernel or initramfs, a
  kernel panic, a root filesystem that cannot be mounted.
- Failures after it: a failed or hung health check, a hung boot, or
  emergency mode.

The first group is the reason the design does not wait for userspace to
report a problem. A boot that never gets that far has to be counted too.

## How it works

1. **Arm.** At shutdown, before the update is finalized, bootguard runs
   preflight checks on the staged image. If the image is bad, it is
   discarded and never booted. Otherwise a trial starts with 3 boot
   attempts.
2. **Count.** The bootloader decrements the counter on every boot attempt
   and, at zero, boots the previous deployment. Because the counter is
   armed before the first boot of the new image, a boot that never
   reaches userspace is still counted.
3. **Assess.** Early in boot, on the trial deployment, bootguard starts a
   watchdog. On the previous deployment after a fallback, it makes the
   rollback permanent and rejects the image.
4. **Check.** After `multi-user.target`, health checks run. If they pass,
   the trial is confirmed. If they fail, the machine reboots for another
   counted attempt, or rolls back right away on the last one.
5. **Watchdog.** A trial boot that is not confirmed within
   `TRIAL_TIMEOUT` (600 seconds by default) is rebooted.

It is one binary, `/usr/bin/agenticlinux-bootguard`, run by four systemd
units:

| Unit | When | Command |
|---|---|---|
| `agenticlinux-bootguard-arm.service` | Shutdown, before the staged deployment is finalized | `arm` |
| `agenticlinux-bootguard-boot.service` | `sysinit.target` | `boot` |
| `agenticlinux-bootguard-check.service` | After `multi-user.target`, trial only | `check` |
| `agenticlinux-bootguard-watch.service` | Started by `boot`, trial only | `watch` |

## Preflight

Before rebooting into an update, `arm` refuses the staged image if any of
these fail:

- **Kernel:** a valid PE32+, EFI zboot or bzImage structure, not
  truncated. A raw arm64 `Image` only needs its header.
- **Initramfs:** a known compression format, and the matching integrity
  test (`zstd`, `gzip`, `xz`, `lz4` or `bzip2`; skipped with a note if
  the tool is not installed). A plain cpio needs an executable `init` or
  a symlink.
- **`root=`:** the kernel argument in `usr/lib/bootc/kargs.d/*.toml` must
  name an existing device.
- **fstab:** local-device entries must exist unless marked `nofail`,
  `noauto` or `bind`.
- **The tool itself:** the image must contain an executable
  `agenticlinux-bootguard`.

A refused image is unstaged, recorded in
`/var/lib/agenticlinux-bootguard/rejected` and announced in
`/etc/motd.d/agenticlinux-bootguard`. If the registry still serves it,
the next `bootc upgrade` stages it again and bootguard discards it again.
A new digest is tried normally.

Preflight does not verify kernel signatures, and it tests that a
compressed initramfs is intact, not what is inside it.

## Health checks

After boot, a trial passes only if:

1. The units in `REQUIRED_UNITS` are active. With
   `FAIL_ON_FAILED_UNITS=true`, no unit may have failed either.
2. The scripts in `check/required.d/` run in order, and the first failure
   fails the boot.
3. The scripts in `check/wanted.d/` run, and their failures are only
   logged.

Then `green.d/` scripts run on success and `red.d/` scripts on failure.
Scripts live in `/usr/lib/agenticlinux-bootguard/` and
`/etc/agenticlinux-bootguard/`, where `/etc` overrides by filename. Each
one is killed with its process group after `CHECK_TIMEOUT` (120 seconds
by default), so a check that hangs is a check that failed.

A passing check proves only what it checks. The image ships with
`REQUIRED_UNITS` empty, so add checks for your own services.

## Kernel arguments

bootguard adds `panic=5 rd.shell=0 rd.emergency=reboot rd.retry=30`
through `/usr/lib/bootc/kargs.d/30-bootguard.toml`. A panic or an
initramfs failure then reboots, and is counted, instead of hanging.

These are always on, not just during an upgrade. A genuine fault outside
an upgrade also reboots instead of giving you an emergency shell. Delete
that file to opt out, and early failures will hang again.

## Fail closed

When bootguard cannot be sure, it does not apply the update. For
example:

- A trial whose counter is missing or unreadable is treated as used up.
- If the boot counter cannot be written, `grub.cfg` does not source
  `custom.cfg`, or `bootc status` fails, the update is not applied.
- Commands whose output bootguard reads time out after 30 seconds, and
  ones it only checks for success after 60, so a hung `bootc` cannot
  stall the boot service that starts the watchdog.
- If a trial boot cannot be assessed (say the new image's `bootc` is
  broken), it is still guarded. The bootloader's own counter shows a trial
  is armed, so the watchdog starts and each attempt is counted until the
  bootloader falls back.
- The watchdog stops only on confirmation. It escalates from `reboot` to
  `--force`, `--force --force`, then a direct `reboot(2)`.

## Two boot stacks

bootguard supports ostree with GRUB, and bootc's composefs backend with
systemd-boot. The flow is the same on both and only the counter differs.
On GRUB it is `bg_counter` in `grubenv`, decremented by a snippet in
`custom.cfg`. On systemd-boot it is the boot entry's name: `x+3.conf`
becomes `x+2-1.conf` on each attempt.

Nothing in the AgenticLinux image build sets up the composefs backend or
systemd-boot, so the images use the ostree and GRUB path. `grubenv` is
rewritten in place and `/boot` is then frozen and thawed, because GRUB
reads the file by block list and cannot replay an XFS or ext4 journal.

## Compared with greenboot

The repository documents a test of both tools with the same qemu setup
and the same failing images: Fedora 44, greenboot 0.16.4, bootc 1.16.13,
an XFS root and GRUB. Four of the failures:

| Failure | greenboot as shipped | bootguard |
|---|---|---|
| Garbage kernel | Stuck at the GRUB menu | Rejected before reboot, or rolled back |
| Kernel panic | Not run | Rolled back |
| Initramfs cannot mount root | Not run | Rolled back |
| Health check fails | Reboot loop, never rolls back | Rolled back |

"Not run" means that case was not tried against stock greenboot. Its
rollback trigger never runs there, so even the health-check case it is
designed for fails. The repository's README has the full table, including
greenboot with its trigger fixed. The reasons it gives are that greenboot's counter starts only after a health check fails
in userspace, and that it has no timeouts and no pre-reboot validation.

## Configuration and commands

Defaults are in `/usr/lib/agenticlinux-bootguard/bootguard.conf`.
Override them in `/etc/agenticlinux-bootguard/bootguard.conf`.

| Key | Default | Meaning |
|---|---|---|
| `ENABLED` | `true` | Master switch for `arm` |
| `PREFLIGHT` | `true` | Check a staged update before rebooting into it |
| `MAX_ATTEMPTS` | `3` | Boot attempts for the new deployment (1 to 20) |
| `TRIAL_TIMEOUT` | `600` | Seconds before the watchdog reboots (minimum 10) |
| `CHECK_TIMEOUT` | `120` | Seconds each check script may run |
| `REQUIRED_UNITS` | empty | Units that must be active |
| `FAIL_ON_FAILED_UNITS` | `false` | Any failed unit fails the boot |

```sh
agenticlinux-bootguard status      # deployments, trial variables, rejected digests
agenticlinux-bootguard preflight   # check the staged update; exit 1 on failure
agenticlinux-bootguard clear       # clear trial state and stop the watchdog
```

Logs are in `journalctl -t agenticlinux-bootguard`.

## Limitations

The bootguard README is direct about these:

- Recovery was tested under qemu on aarch64, on the `base` variant. The
  README says x86_64 and BIOS are untested.
- bootc's composefs backend is experimental, and Secure Boot is
  unsupported with systemd-boot, because Fedora ships only an unsigned
  systemd-boot.
- Arming happens in the deployment that is running when the update is
  applied, so the first update that introduces bootguard is not protected.
- A malformed kernel that passes preflight can hang the firmware, and a
  kernel that hangs without panicking is never caught. Both need a
  hardware watchdog.
- When a failed health check rolls a trial back, the notice is written to
  the failed deployment's `/etc`, so it is not shown after the reboot. It
  is still recorded in `/var/lib/agenticlinux-bootguard/last-event.txt`.

To turn bootguard off, set `ENABLED=false`, run
`agenticlinux-bootguard clear`, and remove the marked block from
`custom.cfg`.

The source and tests are in
[bootguard/](https://github.com/agenticlinux/agenticlinux/tree/main/bootguard).
