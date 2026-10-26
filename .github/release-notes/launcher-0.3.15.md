# Xodus Nexus 0.3.15 for x86_64 and arm64 Linux

A build of Xodus Nexus for x86_64 and arm64 Linux devices, with offline play. The arm64 build is tested on my AYN Odin 3 running ArmadaOS. These changes are proposed upstream but not merged yet.

## Fixed

- **"Backend release check failed: Unexpected backend release asset URL."** The repository moved to [indiesaudi/xodus-nexus-x86-arm64-offline-support](https://github.com/indiesaudi/xodus-nexus-x86-arm64-offline-support), and the launcher only accepted downloads from the old name. Backend installs, runtime downloads and launcher updates now use the new name.

## Install or update

Launchers 0.3.14 and older can't update themselves after the move. Reinstall once with:

```sh
curl -fsSL https://raw.githubusercontent.com/indiesaudi/xodus-nexus-x86-arm64-offline-support/main/scripts/install.sh | bash
```

Your games, sign-in and settings stay. The Nexus backend stays at **0.2.15** and the Nexus runtime at **11.0-20261025-g33cf5423**. Setup and offline-play steps are in the [README](https://github.com/indiesaudi/xodus-nexus-x86-arm64-offline-support#install).

> [!CAUTION]
> This is an unofficial fork of Xodus Nexus, which is itself an independent, unofficial project built on Xodus.
