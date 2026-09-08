# Task Filler

An [Obsidian](https://obsidian.md) plugin for quickly inserting and filling in task items in your notes. Works on both desktop and mobile.

## Installation with BRAT

This plugin is distributed as a beta plugin through [BRAT](https://github.com/TfTHacker/obsidian42-brat).

1. Install **BRAT** from Obsidian's Community Plugins browser and enable it.
2. Open **Settings → BRAT → Add beta plugin**.
3. Enter this repository: `Acrudio/TaskFillerObsidianPlugin`
4. Choose **Add plugin**, then enable **Task Filler** under **Settings → Community plugins**.

BRAT will keep the plugin up to date as new releases are published. These steps work identically on Obsidian mobile (iOS and Android).

> BRAT installs from GitHub **releases**, so the plugin only becomes installable once a release exists. See [Cutting a release](#cutting-a-release) below.

## Usage

| Command | What it does |
| --- | --- |
| **Insert task** | Converts the current line into a task, or starts a new task line below an existing one. |
| **Toggle task on current line** | Flips the checkbox between done and not done. |

There is also a ribbon icon for **Insert task**. Both commands are available from the command palette, and can be bound to hotkeys or added to the mobile toolbar.

Settings (**Settings → Task Filler**) let you change the character used inside the checkbox and optionally append a date stamp using a [Moment.js](https://momentjs.com/docs/#/displaying/format/) format string.

## Development

Requires Node.js 18 or newer.

```bash
npm install
npm run dev     # rebuild on change, with inline sourcemaps
npm run build   # typecheck + minified production bundle
```

The build bundles `src/main.ts` into `main.js` at the repository root. `main.js` is not committed — it is generated and attached to each release.

### Testing in a vault

Create the plugin folder in a vault and point the build output at it, or symlink this repository:

```bash
ln -s "$(pwd)" /path/to/vault/.obsidian/plugins/task-filler
```

Obsidian loads `main.js`, `manifest.json` and `styles.css` from that folder. Enable **Settings → Community plugins → Task Filler**, and use the [Hot Reload plugin](https://github.com/pjeby/hot-reload) to pick up rebuilds automatically.

To test on mobile without publishing a release, copy `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/task-filler/` on the device (via a synced vault, for example).

### Mobile compatibility

`manifest.json` sets `"isDesktopOnly": false`, so the plugin loads on mobile. Keep it that way by staying inside the Obsidian API — no Node.js built-ins (`fs`, `path`, `child_process`) and no Electron APIs, since neither exists on mobile. Use `this.app.vault` adapters for file access and `normalizePath` for paths.

### Cutting a release

Version numbers live in `manifest.json`, `versions.json` and `package.json`, and must all match the git tag.

```bash
npm version patch   # or minor / major — also updates manifest.json + versions.json
git push origin claude/epic-dijkstra-hhjroj --follow-tags
```

Pushing the tag triggers `.github/workflows/release.yml`, which builds the plugin and creates a GitHub release with `main.js`, `manifest.json` and `styles.css` attached — exactly the assets BRAT downloads. Tags carry no `v` prefix, matching the version string in `manifest.json`.

## License

[MIT](LICENSE)
