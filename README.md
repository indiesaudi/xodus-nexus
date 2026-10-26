<div align="center">

<img src="assets/icon.png" width="96" alt="Xodus Nexus" />

# Xodus Nexus for x86_64 and arm64 Linux with offline support

Your Microsoft Store PC games on any x86_64 or arm64 Linux device, online and offline.

[![CI](https://github.com/indiesaudi/xodus-nexus-x86-arm64-offline-support/actions/workflows/ci.yml/badge.svg)](https://github.com/indiesaudi/xodus-nexus-x86-arm64-offline-support/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

> [!IMPORTANT]
> **This is a fork of [Xodus Nexus](https://github.com/domsvoboda/xodus-nexus) with these additions:**
>
> - **Offline play** on the device your Microsoft account designates for offline play, like the Xbox app. Each stored license is checked against Microsoft's offline lease at every offline start and is removed when offline play ends.
> - **Native x86_64 and arm64**: launcher, backend and runtime for both. Tested on an AYN Odin 3 with ArmadaOS.
> - **Background service**: Steam's **Exit game** closes the game gracefully and lets cloud saves finish uploading.
> - **Any Proton per game**: choose a Proton for each game in Steam, or the **Xodus Nexus** compatibility tool.
>
> These changes are proposed upstream ([#373](https://github.com/domsvoboda/xodus-nexus/pull/373), [#360](https://github.com/domsvoboda/xodus-nexus/pull/360), [#374](https://github.com/domsvoboda/xodus-nexus/pull/374)) but are not merged yet. This fork publishes its own releases, and an installation from here also updates from here. For the official builds, use [domsvoboda/xodus-nexus](https://github.com/domsvoboda/xodus-nexus).

> [!CAUTION]
> **Xodus Nexus is an independent, unofficial project built on Xodus. It is not an official project or release from the upstream Xodus developers.**
>
> Please report issues with this fork in [its own issue tracker](https://github.com/indiesaudi/xodus-nexus-x86-arm64-offline-support/issues), not in the Xodus Nexus or upstream Xodus trackers.
>
> Nexus includes its own changes, so a problem in Nexus does not necessarily indicate a problem in upstream Xodus.

An Xbox-inspired launcher built on [Xodus](https://github.com/xodus-gaming/xodus),
using our patched Nexus backend and Nexus runtime.
Browse the Store, install games you own or can access through a subscription,
and play with one shared runtime. Xbox sign-in and cloud saves are available
for supported games.

![Xodus Nexus demo](docs/screenshots/demo.gif?v=bb1bc859)

*Preview with sample account data.*

## Community translations

Translations are shared with upstream Xodus Nexus. To help translate, open its
[public Tolgee project](https://app.tolgee.io/projects/36162), sign in and suggest
translations for the launcher interface. No coding or GitHub access is needed.
Maintainers review suggestions before including them in a release. Missing a
language? Request it in a [GitHub issue](https://github.com/domsvoboda/xodus-nexus/issues).

[Start translating →](https://app.tolgee.io/projects/36162/translations) ·
[Translation guide](docs/TRANSLATING.md)

## Install

Works on x86_64 and arm64 Linux PCs and handhelds. On a handheld, do the first setup in **Desktop Mode**.

1. Open a terminal (Konsole) and run:

   ```sh
   curl -fsSL https://raw.githubusercontent.com/indiesaudi/xodus-nexus-x86-arm64-offline-support/main/scripts/install.sh | bash
   ```

   The installer picks the build for your CPU. On read-only systems such as SteamOS or ArmadaOS, the system-package step only prints a warning; the AppImage brings what it needs.
2. Start **Xodus Nexus** from the application menu. The launcher installs the **Nexus backend** for your CPU in the background.
3. In **Settings**, choose **Install Nexus runtime**.
4. Sign in with your Microsoft account. If the wallet asks to be set up, see [Wallet setup and unlocking](#wallet-setup-and-unlocking). A valid purchase or subscription is required.
5. Install games from **Store** or **My Library**. To play from Game Mode, choose **Add to Steam** in a game's menu, or **Add Nexus to Steam** in Settings.

To install manually, download the AppImage for your CPU (`x86_64` or `arm64`) from [Releases](https://github.com/indiesaudi/xodus-nexus-x86-arm64-offline-support/releases), make it executable and open it.

If passkey sign-in gets stuck, choose **Continue in browser** in the sign-in
window. This option requires Google Chrome, either a native installation or the
Flatpak version available through Discover. Other browsers are not supported.

[Setup guide and SteamOS requirements](https://github.com/domsvoboda/xodus-nexus/wiki/Getting-started)

## Upgrade

- **From launcher 0.3.15:** open **Settings**, choose **Check for updates**, then **Update launcher** and restart Nexus. Then update the **backend** in Settings; the runtime stays the same. Update the launcher first: with the new backend, launcher 0.3.15 cannot start games.
- **From launcher 0.3.14 or older:** these versions cannot update themselves, because this fork's repository was renamed. Run the install command from [Install](#install) again. Your games, sign-in and settings are kept.
- **After upgrading:**
  - Choose **Add to Steam** again for each game you start from Steam. This updates the shortcut so Steam's compatibility-tool choice and launch wrappers reach Nexus. It keeps the shortcut's artwork and settings.
  - Start each game you want to play offline once while online. Offline licenses stored by earlier versions are not used anymore, and each game stores a new one on its first online start.
  - Optional: turn on **Settings → Advanced → Background service** for a graceful **Exit game** from Steam.

## Offline play

Microsoft allows offline play on one device per account, the **designated offline device**, and lets you change it three times a year. This follows [Microsoft's offline-play rules](https://support.xbox.com/en-GB/help/games-apps/game-setup-and-play/play-games-offline-on-windows-10-using-offline-mode).

1. While online, open **Settings → Offline permissions** and turn on **Use this device to play games offline**. This turns offline play off on your other devices. The card shows how many changes remain this year.
2. Start each game once while online. Microsoft then issues this device an offline lease of up to 30 days for that game, renewed at every online start.
3. Without a connection, the header shows **Offline**, and those games start with their stored license. Online features are unavailable, and saves stay on the device until the next online session.

Nexus checks each stored license against Microsoft's lease at every offline start. It removes stored licenses and offline sign-ins when:

- you turn offline play off, or another device becomes the offline device and this device notices once it is back online;
- another account signs in, or you sign out;
- Microsoft refuses a game's license (that game), or reports the Store device limit (all games).

A device that stays offline cannot learn about these changes. Its offline access still ends when the lease Microsoft issued expires.

## Play from Steam

- **Add to Steam** creates a Non-Steam shortcut with artwork. Steam can keep running, including in Game Mode. Native Linux Steam is required; Flatpak Steam is not supported yet.
- **Background service** (**Settings → Advanced**): Steam shortcuts start through a small client and a systemd user service (no root). **Exit game** in Steam then closes the game gracefully and lets cloud saves finish uploading. To check it, run `journalctl --user -u 'xodus-nexus-*'`.
- **Choose the Proton per game** (needs the background service): Nexus adds **Xodus Nexus** to Steam's **Properties → Compatibility** menu. Steam lists it after a restart. **Xodus Nexus** and **Default** run the game on the Nexus runtime. Any other Proton runs it there, and Nexus adds only what Xbox PC games need: the GDK runtime, Xbox service networking, the PlayFab save adapter, the Gaming Services version and the game language. Graphics (DXVK, vkd3d) stay that Proton's own.
- Launch wrappers in front of Steam's command apply to the game, such as ArmadaOS's per-game settings (`armada-game-launch`), `gamemoderun` or `VAR=value`.

### Set the Steam launch options by hand

**Add to Steam** sets these for you. To create or repair a shortcut yourself, add a Non-Steam game with these settings:

| Field | Value |
| --- | --- |
| Target | `/bin/sh` |
| Start in | the game's installation folder (any folder works) |
| Launch options | `"<home>/.config/xodus-nexus/shortcuts/launch-game" "<game id>" %command%` |
| Launch options on ArmadaOS | `"<home>/.config/xodus-nexus/shortcuts/launch-game" "<game id>" /usr/libexec/armada/armada-game-launch %command%` |

Replace `<home>` with your home folder, for example `/home/deck`, and keep the quotes. `%command%` must come last; wrappers such as `gamemoderun` go right before it. To list your games and their ids:

```sh
python3 -c 'import json, os; [print(g["id"], g["title"]) for g in json.load(open(os.path.expanduser("~/.config/xodus-nexus/launcher-state.json")))["games"]]'
```

For example: `"/home/deck/.config/xodus-nexus/shortcuts/launch-game" "74c7642782377a56" %command%`. To use another Proton, pick it under the shortcut's **Properties → Compatibility**. To use the Nexus runtime, choose **Xodus Nexus** or leave the setting off.

## Use

- **My Library** combines owned, Game Pass and installed games, with Access, Play state and title filters.
- In **My Library → In Game Pass**, choose **Recently added to Game Pass** to show games in Microsoft's recent PC collection first.
- Open a game for its description, categories, screenshot gallery and available Xbox achievements, time played and last activity. Xbox data depends on the account and game.
- **Store** lets you browse and install supported PC games.
- New game installations show the estimated download size and free space on the destination drive. The downloader checks exact space requirements.
- **Manage content** installs licensed add-ons and campaign packages.
- **Install Queue** downloads games one at a time and lets you add more while downloading or playing another game. Pause and resume are supported, including manual resume after restarting the launcher.
- Cancelling a new installation can keep or delete its partial files. Existing games, updates and DLC keep their files.
- Right-click an installed game for settings, VC++ prerequisites, shortcuts or removal.
- Removing a game can keep its files or permanently delete its installation folder without using Trash. Saves inside that folder are deleted too; saves elsewhere are not affected.
- Game settings offer an optional **DualSense compatibility mode** if a standard DualSense is not detected. It applies only to that game and may disable advanced haptics and adaptive triggers.
- Choose **Add to Steam** in the game menu, or **Add Nexus to Steam** in Settings, to create a Non-Steam shortcut with available artwork. Steam can stay running, including in Game Mode. Requires native Linux Steam; Flatpak Steam is not yet supported.
- **Settings → Advanced → Background service** runs the Nexus game daemon as a systemd user service (`~/.config/systemd/user`, socket-activated, no root). Steam shortcuts then start through a small client: launches skip the Electron start-up, and Exit game in Steam ends only that client while the daemon closes the game and lets cloud-save sync finish. Check it with `journalctl --user -u xodus-nexus-<profile>.service`.
- **Settings → Offline permissions** shows whether this device is your account's offline device and how many changes remain this year, and changes it after a confirmation. See [Offline play](#offline-play).
- Update the launcher, backend and runtime in **Settings**.
- **Settings → Interface language** selects a bundled translation independently of game language and Store region. Missing translations fall back to English.
- **Settings → Downloads** sets a combined game download speed limit in MiB/s (0 means unlimited). A supporting Nexus backend is required; saving the limit also applies it to active downloads.
- **Settings → Shader cache** sets the per-game Mesa/NVIDIA driver cache limit, 4 GiB by default. Changes apply on the next game launch; explicit environment overrides take precedence.
- For account, library or installation errors, use **Settings → Xodus backend → Open backend diagnostic log**. The local log contains safe error codes and operation results, not credentials. Review it before sharing.

## Wallet setup and unlocking

- If the service is stopped, use **Start service**. Supported KDE wallets should also start automatically when Nexus opens in Game Mode.
- If your wallet has a password, its native unlock window may appear. Enter your **wallet password**, which is not necessarily your Microsoft account password. Nexus does not receive this password.
- A wallet without a password should unlock without requiring password entry.
- If no wallet exists, use **Create wallet** and complete the system dialog. On KDE, choose **Classic, blowfish encrypted file** for a normal password-based wallet if you do not have a GPG encryption key. An empty password does not protect stored credentials.
- If setup or the password dialog does not work in Game Mode, try it in Desktop Mode first. If the problem persists, include the backend diagnostic log in your issue report.

## Microsoft Store device limit

Microsoft Store supports up to 10 linked devices. If downloading or launching a
game fails with **Microsoft Store device limit reached** (licensing code 501),
open [Microsoft Store device management](https://account.microsoft.com/devices/content)
and sign in with the same Microsoft account. Unlink only an old device you no
longer use, then retry in Nexus. You do not need to sign out or reset the wallet.
Other license errors can have different causes.

[Documentation](https://github.com/domsvoboda/xodus-nexus/wiki) ·
[Report an issue](https://github.com/indiesaudi/xodus-nexus-x86-arm64-offline-support/issues)

## How it works

| Component | Role |
| --- | --- |
| Xodus Nexus launcher | The desktop interface for the Store, library, downloads, settings and launching games. |
| Nexus backend | Our patched build of [Xodus](https://github.com/xodus-gaming/xodus), handling Microsoft account sign-in, genuine license checks, package downloads and launch preparation. |
| [Nexus Runtime](https://github.com/domsvoboda/nexus-runtime) | Our fork of Valve's Proton Experimental, assembling Wine, XGameRuntime, graphics translation and supporting libraries into one complete runtime. |
| [Nexus Wine](https://github.com/domsvoboda/nexus-wine) | The matching Wine fork, providing Windows API compatibility and Nexus game fixes. |
| [Nexus XGameRuntime](https://github.com/domsvoboda/nexus-xgameruntime) | Our fork of the upstream C++ XGameRuntime, providing game-facing account, cloud-save, package and Store/DLC interfaces. API coverage varies by game. |

The launcher asks the backend to prepare a licensed game, then starts it with
the shared Nexus Runtime. Wine provides Windows compatibility; XGameRuntime
connects supported Xbox and Microsoft Store game APIs to the Nexus backend.
DXVK and VKD3D-Proton translate supported Direct3D graphics to Vulkan.

> [!NOTE]
> This fork still publishes the earlier Nexus runtime (`runtime-11.0-20261025-g33cf5423`, x86_64 and aarch64), built on [Xodus Proton](https://github.com/xodus-gaming/Proton) and the previous C XGameRuntime. Upstream's C++ runtime is not yet available for arm64; the fork will move to it once it is. Offline sign-in in the C++ runtime is proposed in [nexus-xgameruntime#11](https://github.com/domsvoboda/nexus-xgameruntime/pull/11).

Install or update the complete runtime through **Settings**. Its Wine and
XGameRuntime components are built together at matching revisions, so there is
no need to install the individual forks separately. All games use the same
shared runtime; compatibility and online services still depend on the game.

## Compatible games

These results come from manual testing and user reports. Other games may work,
but have not been verified and may encounter compatibility issues.

| Game | Playable | Status |
| --- | --- | --- |
| Gears of War: E-Day | Yes | Playable online; Xbox playing status works. |
| Deep Rock Galactic | Yes | Playable online. |
| Minecraft Dungeons | Yes | Playable online with launcher 0.3.5; [ownership failures](https://github.com/domsvoboda/xodus-nexus/issues/80) also reported on other setups. |
| Minecraft Dungeons II | Yes | Playable online. |
| Minecraft for Windows | Yes | Playable online. For licensing code 501, check the [Store device limit](#microsoft-store-device-limit). |
| Minecraft Launcher | Yes | Sign-in and Java download/startup work with launcher 0.3.5; Java online unverified. [Login failure](https://github.com/domsvoboda/xodus-nexus/issues/107) also reported on another setup. |
| No Man's Sky | Yes | Playable online. |
| Valor Mortis | Yes | Fully playable. |
| Forza Horizon 6 | Yes | Playable online; some setups need [VC++ prerequisites](https://github.com/domsvoboda/xodus-nexus/issues/96). [Loading failures](https://github.com/domsvoboda/xodus-nexus/issues/13) also reported. |
| Palworld | Yes | Playable online. |
| DOOM Eternal | Yes | Playable. |
| Microsoft Flight Simulator 2024 | Partial | Unreleased runtime: gameplay works, but sign-in can stall. Multiplayer unverified. |
| Ori and the Will of the Wisps | Partial | Unreleased Experimental runtime: sign-in and main menu work; gameplay unverified. |
| Like a Dragon: Infinite Wealth | Partial | Unreleased Experimental runtime: main menu works; gameplay unverified. |
| DOOM: The Dark Ages | Yes | Playable (user report). |
| Fallout 76 | Yes | Playable online; [one reported setup](https://github.com/domsvoboda/xodus-nexus/issues/9#issuecomment-6227548598) requires gamescope to display correctly. |
| The Outer Worlds 2 | Yes | Playable. |
| Wolfenstein: The Old Blood | Yes | Playable. |
| Wasteland Remastered | Yes | Playable. |
| Danganronpa 2 | Yes | Playable. |
| Neon Abyss 2 | Yes | Playable. |
| Hollow Knight: Voidheart Edition | Yes | Playable. |
| Avowed | Yes | Playable. |
| Mortal Shell: Enhanced Edition | Yes | Playable (user report). |
| Sea of Thieves | Yes | Playable online. |
| Tony Hawk's Pro Skater 3 + 4 | Partial | Solo playable; Private Match loads a map. Joining other players and public matchmaking remain unconfirmed. ([#88](https://github.com/domsvoboda/xodus-nexus/issues/88)) |
| ARC Raiders | No | Launches but cannot connect to online services. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/100)) |
| Hogwarts Legacy | Yes | Playable. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/110)) |
| Halo Infinite | Partial | Unreleased Experimental runtime: main menu and campaign start; multiplayer unavailable (offline). |
| Halo: Campaign Evolved | Yes | Playable; may remain running after quitting. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/97)) |
| Resonance: A Plague Tale Legacy | Yes | Playable; black screen reported when ending a game on Steam Deck. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| Resident Evil 2 | Yes | Playable; may remain running after quitting. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/110)) |
| Wreckfest | Yes | Playable. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| TUNIC | Yes | Playable. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| Hades | Yes | Playable. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| Hell Let Loose: Vietnam | No | Crashes after Easy Anti-Cheat initialization on Arch Linux with an Arc A770. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| Human: Fall Flat | Partial | Public online game search fails. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| Wolfenstein II: The New Colossus | Yes | Playable. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| The Dungeon of Naheulbeuk: The Amulet of Chaos | Yes | Playable. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| Soul Hackers 2 | Yes | Playable with launcher 0.3.8 (user report, [#166](https://github.com/domsvoboda/xodus-nexus/issues/166#issuecomment-6285236638)). |
| Monster Boy and the Cursed Kingdom | Yes | Playable. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| Hollow Knight: Silksong | Yes | Playable. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| Teenage Mutant Ninja Turtles: Shredder's Revenge | Yes | Playable. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| DRAGON QUEST XI S: Echoes of an Elusive Age - Definitive Edition | No | Crashes after the first loading screen. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| ACA NEOGEO METAL SLUG | No | Crashes at launch. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| SIGNALIS | Yes | Playable. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| DREDGE | Yes | Playable. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/106)) |
| Warhammer 40,000: Space Marine 2 | Yes | Playable; online unverified. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/106)) |
| Indiana Jones and the Great Circle | Yes | First mission playable. ([#78](https://github.com/domsvoboda/xodus-nexus/issues/78)) |
| Microsoft Jewel | No | Crashes at launch. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/107)) |
| Microsoft Bubble | No | Crashes at launch. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/107)) |
| AI: THE SOMNIUM FILES - nirvanA Initiative | Yes | Playable; Store ID detection issue reported. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/107)) |
| Minecraft Legends | Yes | Playable; an online session starts, but play with friends is unverified. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/107)) |
| The Elder Scrolls: Arena | No | Crashes at launch. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/107)) |
| The Elder Scrolls II: Daggerfall | No | Crashes at launch. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/107)) |
| Wolfenstein: Enemy Territory | Partial | Playable, but cannot join PunkBuster-enabled servers. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/107)) |
| Hell Let Loose | No | Crashes at startup. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/105)) |
| Kingdom Come: Deliverance II | Yes | Playable. ([#112](https://github.com/domsvoboda/xodus-nexus/issues/112)) |
| PAC-MAN MUSEUM+ | No | Stops after the opening logos. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/61)) |
| Farming Simulator 25 | No | Startup failure reported; updated runtime retest pending. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/62)) |
| PowerWash Simulator 2 | Yes | Playable. ([#69](https://github.com/domsvoboda/xodus-nexus/issues/69)) |
| Young Souls | Unverified | Launches in Steam Deck Desktop Mode; gameplay unverified. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/8#issuecomment-6225913594)) |
| Remnant II | Unverified | Starts and exits cleanly; gameplay and online were not detailed. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/34#issuecomment-6190973665)) |
| The Witcher 3 | No | Currently crashes on launch. |
| LIMBO | Yes | Playable. |
| World War Z | Partial | Connects to online services and starts Quick Match search; joining a match is unverified. |
| Balatro | Yes | Playable. |

[Full compatibility list](https://github.com/domsvoboda/xodus-nexus/wiki/Compatibility)

User reports describe individual setups, not universal compatibility. The wiki
links to report sources and the community spreadsheet. Launch-only reports do
not confirm gameplay or online support.

## Screenshots

[Library](docs/screenshots/demo-library.png) ·
[Store](docs/screenshots/demo-store.png) ·
[Install queue](docs/screenshots/demo-downloads.png) ·
[Settings](docs/screenshots/demo-settings.png)

Independent project, not affiliated with Microsoft or Xbox. A valid game license
is required. Launcher: [MIT license](LICENSE). The separate Xodus backend retains
its upstream GPLv3 license and ships with corresponding source.
The Nexus runtime includes [FFmpeg](https://ffmpeg.org/) shared libraries under
LGPL 2.1 or later; its corresponding pinned source and build recipe accompany
each runtime release.
[Contributing](CONTRIBUTING.md)
