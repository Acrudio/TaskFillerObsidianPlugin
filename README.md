# Task Filler

An [Obsidian](https://obsidian.md) plugin that splits a multi-day task into one dated subtask per day, dividing its time estimate between them. Built around the frontmatter the Project Manager and Tasknotes plugins use, and works on both desktop and mobile.

## Installation with BRAT

This plugin is distributed as a beta plugin through [BRAT](https://github.com/TfTHacker/obsidian42-brat).

1. Install **BRAT** from Obsidian's Community Plugins browser and enable it.
2. Open **Settings → BRAT → Add beta plugin**.
3. Enter this repository: `Acrudio/TaskFillerObsidianPlugin`
4. Choose **Add plugin**, then enable **Task Filler** under **Settings → Community plugins**.

BRAT will keep the plugin up to date as new releases are published. These steps work identically on Obsidian mobile (iOS and Android).

> BRAT installs from GitHub **releases**, so the plugin only becomes installable once a release exists. See [Cutting a release](#cutting-a-release) below.

## What it does

Run **Split task into daily subtasks** while a task note is open. The plugin reads the task's `start` and `due` dates, works out how many days the task spans, and creates one subtask note per day.

Given a parent task with `start: 2026-09-07`, `due: 2026-09-09` and `timeEstimate: 180`, it creates:

| Note | `start` / `due` | `timeEstimate` |
| --- | --- | --- |
| 🔨 Manufacturing HW 1 (Day 1/3) | 2026-09-07 | 60 |
| 🔨 Manufacturing HW 1 (Day 2/3) | 2026-09-08 | 60 |
| 🔨 Manufacturing HW 1 (Day 3/3) | 2026-09-09 | 60 |

Each subtask is a full Project Manager task note — `pm-task: true`, an id in Project Manager's own format, the parent's `projectId` and `parentId`, and the parent's `Project:` link — so it shows up in Project Manager and Tasknotes like any other task. The parent's `subtaskIds` and its `## Subtasks` checklist are updated to point at the new notes.

The time estimate is divided evenly across the days. When it does not divide exactly, the remainder goes to the earliest days so the parts still add up to the parent's total: 100 minutes over three days becomes 34 / 33 / 33.

Notes are named with Project Manager's lowercase-hyphenated convention, in the same folder as the parent unless you configure another. Because `/` cannot appear in a file name, `(Day 1/3)` becomes `(day-1-3)` in the file name while the title keeps the slash.

Running the command twice is safe: days whose note already exists are skipped rather than duplicated, so extending a task's `due` date and re-running only fills in the new days.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| Title template | `{{title}} (Day {{day}}/{{total}})` | Title of each subtask. Also supports `{{date}}`. |
| Folder | *(empty)* | Where subtasks are created. Empty means beside the parent note. |
| Status | `notStarted` | Status written to each new subtask. |
| Set a start date | on | Give each subtask a `start` equal to its `due`, so it spans one day. |
| Inherit tags | on | Copy the parent's tags onto each subtask. |
| Maximum subtasks | 60 | Refuse to split a longer span, as a guard against a mistyped date. |
| Start date / Due date / Time estimate | `start` / `due` / `timeEstimate` | Which frontmatter properties to read. Change these if you use Tasknotes' `scheduled`, or any other naming. |

## Development

Requires Node.js 18 or newer.

```bash
npm install
npm run dev     # rebuild on change, with inline sourcemaps
npm test        # unit tests for the date, splitting and note-writing logic
npm run build   # typecheck + minified production bundle
```

The date arithmetic, time-estimate splitting, title and file naming, and note rendering live in `src/core/` as pure functions with no Obsidian imports, so they can be tested with `node --test`. `src/main.ts` holds the vault glue.

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
