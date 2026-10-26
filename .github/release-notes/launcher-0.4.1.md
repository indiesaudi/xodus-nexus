# Xodus Nexus 0.4.1 (x86_64 and arm64, offline support)

This release brings the fork up to upstream Xodus Nexus 0.4.0, which adds interface translations, Xbox friends and chat, Game Pass "Recently added", installation size estimates, a shader cache limit and DLC support. On top of that come this fork's features, rebuilt in the form proposed upstream.

## New in this fork

- **Offline play that follows Microsoft's rules.** Each game's offline license is stored with the lease Microsoft issued and checked against it at every offline start: an offline lease for this device and account, within its expiry and at most 30 days old, with a clock that has not been set back. Stored licenses and offline sign-ins are removed when offline play is turned off, another device becomes the offline device, another account signs in, or Microsoft refuses a license. Earlier versions could store nothing on devices whose license had no device id; that is fixed.
- **Background service** (**Settings → Advanced → Background service**): Steam's **Exit game** closes the game gracefully and lets cloud saves finish uploading. The service starts and unlocks the wallet by itself after a reboot.
- **Any Proton per game in Steam**, plus an **Xodus Nexus** entry in Steam's compatibility menu that runs the Nexus runtime. Launch wrappers such as ArmadaOS's `armada-game-launch` apply to the game.
- **Native arm64** launcher and backend next to x86_64. The runtime release is unchanged (`runtime-11.0-20261025-g33cf5423`, x86_64 and aarch64).

## Upgrade

- **From 0.3.15:** in **Settings**, choose **Check for updates**, then **Update launcher**, and restart Nexus. Then choose **Update backend**; this release needs backend 0.2.17. The runtime does not change.
- **From 0.3.14 or older:** these versions cannot update themselves after the repository rename. Run the installer again; games, sign-in and settings are kept:

  ```sh
  curl -fsSL https://raw.githubusercontent.com/indiesaudi/xodus-nexus-x86-arm64-offline-support/main/scripts/install.sh | bash
  ```

- **Then:**
  1. Choose **Add to Steam** again for each game you start from Steam. This updates the shortcut's launch options in place and keeps its artwork and settings.
  2. Start each game you want to play offline once while online. Offline licenses from earlier versions are not used anymore.
  3. Optional: turn on **Settings → Advanced → Background service**.

## Set the Steam launch options by hand

**Add to Steam** sets these for you. For a shortcut you create or repair yourself:

| Field | Value |
| --- | --- |
| Target | `/bin/sh` |
| Launch options | `"<home>/.config/xodus-nexus/shortcuts/launch-game" "<game id>" %command%` |
| Launch options on ArmadaOS | `"<home>/.config/xodus-nexus/shortcuts/launch-game" "<game id>" /usr/libexec/armada/armada-game-launch %command%` |

Replace `<home>` with your home folder (for example `/home/deck`) and keep the quotes. `%command%` must come last; wrappers such as `gamemoderun` go right before it. To list your games and their ids:

```sh
python3 -c 'import json, os; [print(g["id"], g["title"]) for g in json.load(open(os.path.expanduser("~/.config/xodus-nexus/launcher-state.json")))["games"]]'
```

To run a game under another Proton, pick it in the shortcut's **Properties → Compatibility**. **Xodus Nexus**, or no compatibility tool, uses the Nexus runtime. Choosing another Proton needs the background service.

## Downloads

- `Xodus-Nexus-0.4.1-x86_64.AppImage`: x86_64 PCs and handhelds.
- `Xodus-Nexus-0.4.1-arm64.AppImage`: arm64 devices (for example AYN Odin 3 with ArmadaOS).
- Each file has a matching `.sha512sum` checksum. The launcher downloads the matching backend (`backend-v0.2.17`) and runtime for your CPU.

> [!CAUTION]
> Xodus Nexus is an independent, unofficial project built on Xodus, not affiliated with Microsoft or Xbox. Please report issues with this fork in [its issue tracker](https://github.com/indiesaudi/xodus-nexus-x86-arm64-offline-support/issues).
