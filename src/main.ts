import {
	Notice,
	Plugin,
	TFile,
	TFolder,
	normalizePath,
	type CachedMetadata,
} from "obsidian";
import { formatLocalTimestamp, formatPlainDate } from "./core/dates";
import { buildPlan, type SubtaskPlan } from "./core/plan";
import {
	appendSubtaskLinks,
	renderSubtaskNote,
	stripFrontmatter,
	subtaskListItem,
} from "./core/note";
import {
	DEFAULT_SETTINGS,
	TaskFillerSettingTab,
	type TaskFillerSettings,
} from "./settings";

const PROJECT_LINE = /^Project:\s/;

export default class TaskFillerPlugin extends Plugin {
	settings: TaskFillerSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addCommand({
			id: "split-into-daily-subtasks",
			name: "Split task into daily subtasks",
			checkCallback: (checking: boolean) => {
				const file = this.app.workspace.getActiveFile();
				if (!file || file.extension !== "md") return false;
				if (!checking) void this.splitTask(file);
				return true;
			},
		});

		this.addRibbonIcon("calendar-range", "Split task into daily subtasks", () => {
			const file = this.app.workspace.getActiveFile();
			if (!file || file.extension !== "md") {
				new Notice("Task Filler: open a task note first.");
				return;
			}
			void this.splitTask(file);
		});

		this.addSettingTab(new TaskFillerSettingTab(this.app, this));
	}

	/**
	 * Create one subtask note per day the task spans, dividing the parent's time
	 * estimate between them, then link them back into the parent.
	 */
	async splitTask(file: TFile): Promise<void> {
		const cache: CachedMetadata | null = this.app.metadataCache.getFileCache(file);
		const frontmatter = cache?.frontmatter ?? {};

		const plan = buildPlan(frontmatter, {
			startProperty: this.settings.startProperty,
			dueProperty: this.settings.dueProperty,
			timeEstimateProperty: this.settings.timeEstimateProperty,
			titleTemplate: this.settings.titleTemplate,
			fallbackTitle: file.basename,
			maxSubtasks: this.settings.maxSubtasks,
		});

		if (!plan.ok) {
			new Notice(`Task Filler: ${plan.error}`);
			return;
		}

		const folder = await this.resolveFolder(file);
		if (folder === null) return;

		const parentContent = await this.app.vault.read(file);
		const body = stripFrontmatter(parentContent)
			.split("\n")
			.filter((line) => PROJECT_LINE.test(line));

		const created: SubtaskPlan[] = [];
		let skipped = 0;

		for (const subtask of plan.subtasks) {
			const path = normalizePath(`${folder}/${subtask.slug}.md`);
			if (this.app.vault.getAbstractFileByPath(path)) {
				skipped++;
				continue;
			}

			try {
				await this.app.vault.create(
					path,
					renderSubtaskNote({
						id: subtask.id,
						parentId: readString(frontmatter.id),
						projectId: readString(frontmatter.projectId),
						title: subtask.title,
						status: this.settings.subtaskStatus,
						priority: readString(frontmatter.priority) ?? "medium",
						start: this.settings.setStartOnSubtasks
							? formatPlainDate(subtask.date)
							: null,
						due: formatPlainDate(subtask.date),
						tags: this.settings.inheritTags ? readStringList(frontmatter.tags) : [],
						timeEstimate: subtask.timeEstimate,
						createdAt: subtask.createdAt,
						dateModified: formatLocalTimestamp(new Date()),
						body,
					})
				);
				created.push(subtask);
			} catch (error) {
				console.error(`Task Filler: could not create ${path}`, error);
				new Notice(`Task Filler: could not create "${subtask.title}".`);
			}
		}

		if (created.length > 0) await this.linkSubtasks(file, created);

		new Notice(summarize(created.length, skipped, plan.totalDays));
	}

	/** Record the new subtasks in the parent's frontmatter and its Subtasks section. */
	private async linkSubtasks(file: TFile, created: SubtaskPlan[]): Promise<void> {
		const timestamp = new Date();

		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const existing = Array.isArray(frontmatter.subtaskIds) ? frontmatter.subtaskIds : [];
			frontmatter.subtaskIds = [...existing, ...created.map((subtask) => subtask.id)];
			frontmatter.updatedAt = timestamp.toISOString();
			frontmatter.dateModified = formatLocalTimestamp(timestamp);
		});

		const items = created.map((subtask) => subtaskListItem(subtask.slug, subtask.title));
		await this.app.vault.process(file, (content) => appendSubtaskLinks(content, items));
	}

	/** The folder new subtasks belong in, creating it if needed. Null means give up. */
	private async resolveFolder(file: TFile): Promise<string | null> {
		const configured = this.settings.subtaskFolder.trim();
		if (!configured) return file.parent?.path ?? "";

		const path = normalizePath(configured);
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFolder) return path;
		if (existing) {
			new Notice(`Task Filler: "${path}" is a file, not a folder.`);
			return null;
		}

		try {
			await this.app.vault.createFolder(path);
			return path;
		} catch (error) {
			console.error(`Task Filler: could not create folder ${path}`, error);
			new Notice(`Task Filler: could not create the folder "${path}".`);
			return null;
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}

function readString(value: unknown): string | null {
	return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function readStringList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === "string");
}

function summarize(created: number, skipped: number, totalDays: number): string {
	if (created === 0 && skipped > 0) {
		return `Task Filler: all ${skipped} daily subtasks already exist.`;
	}
	if (created === 0) return "Task Filler: no subtasks were created.";

	const plural = created === 1 ? "subtask" : "subtasks";
	const tail = skipped > 0 ? ` (${skipped} of ${totalDays} already existed)` : "";
	return `Task Filler: created ${created} daily ${plural}${tail}.`;
}
