import {
	Notice,
	Plugin,
	TFile,
	TFolder,
	normalizePath,
} from "obsidian";
import { formatLocalTimestamp, formatPlainDate } from "./core/dates";
import { buildPlan, type SubtaskPlan } from "./core/plan";
import {
	appendSubtaskLinks,
	listSubtaskLinkTargets,
	removeSubtaskLinks,
	renderSubtaskNote,
	stripFrontmatter,
	subtaskListItem,
} from "./core/note";
import { confirm } from "./confirm";
import {
	DEFAULT_SETTINGS,
	TaskFillerSettingTab,
	type TaskFillerSettings,
} from "./settings";

const PROJECT_LINE = /^Project:\s/;

/** A note already listed as a subtask of the task being split. */
interface ExistingSubtask {
	file: TFile;
	id: string | null;
	/** How the parent's checklist links to it, so those lines can be removed. */
	linkTargets: string[];
	/** Subtasks of its own, which make it off-limits for replacement. */
	hasChildren: boolean;
}

/** Everything a single run needs to know about the rest of the vault. */
interface TaskIndex {
	byId: Map<string, TFile>;
	childCounts: Map<string, number>;
}

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
	 * Rebuild the task's daily subtasks: replace the ones from a previous run,
	 * then create one note per day the task now spans, dividing the parent's
	 * time estimate between them.
	 */
	async splitTask(file: TFile): Promise<void> {
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};

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

		const content = await this.app.vault.read(file);
		const existing = this.collectSubtasks(file, frontmatter, content);
		const replaceable = existing.filter((subtask) => !subtask.hasChildren);
		const protectedCount = existing.length - replaceable.length;

		if (replaceable.length > 0 && this.settings.confirmBeforeReplacing) {
			const confirmed = await confirm(this.app, {
				title: "Replace daily subtasks?",
				message: `${describe(replaceable.length, "subtask")} will be moved to trash and replaced with ${describe(
					plan.totalDays,
					"subtask"
				)}, one per day from ${formatPlainDate(plan.subtasks[0].date)} to ${formatPlainDate(
					plan.subtasks[plan.subtasks.length - 1].date
				)}.`,
				details: replaceable.map((subtask) => subtask.file.basename),
				cta: "Replace",
			});
			if (!confirmed) {
				new Notice("Task Filler: nothing changed.");
				return;
			}
		}

		// Delete first, so rebuilt days can reclaim their note names.
		const removedIds = new Set<string>();
		const removedLinks = new Set<string>();
		let failed = 0;

		for (const subtask of replaceable) {
			try {
				await this.app.fileManager.trashFile(subtask.file);
				if (subtask.id) removedIds.add(subtask.id);
				for (const target of subtask.linkTargets) removedLinks.add(target);
			} catch (error) {
				console.error(`Task Filler: could not remove ${subtask.file.path}`, error);
				failed++;
			}
		}

		const created: SubtaskPlan[] = [];
		let blocked = 0;

		for (const subtask of plan.subtasks) {
			const path = normalizePath(`${folder}/${subtask.slug}.md`);
			if (this.app.vault.getAbstractFileByPath(path)) {
				// A protected subtask already holds this name; leave it alone.
				blocked++;
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
						body: stripFrontmatter(content)
							.split("\n")
							.filter((line) => PROJECT_LINE.test(line)),
					})
				);
				created.push(subtask);
			} catch (error) {
				console.error(`Task Filler: could not create ${path}`, error);
				failed++;
			}
		}

		await this.relinkSubtasks(file, created, removedIds, removedLinks);

		new Notice(
			summarize({
				created: created.length,
				replaced: removedIds.size + removedLinks.size > 0 ? replaceable.length - failed : 0,
				kept: protectedCount + blocked,
				failed,
			})
		);
	}

	/** Point the parent's frontmatter and checklist at the subtasks that now exist. */
	private async relinkSubtasks(
		file: TFile,
		created: SubtaskPlan[],
		removedIds: Set<string>,
		removedLinks: Set<string>
	): Promise<void> {
		if (created.length === 0 && removedIds.size === 0 && removedLinks.size === 0) return;

		const timestamp = new Date();

		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const previous = readStringList(frontmatter.subtaskIds);
			frontmatter.subtaskIds = [
				...previous.filter((id) => !removedIds.has(id)),
				...created.map((subtask) => subtask.id),
			];
			frontmatter.updatedAt = timestamp.toISOString();
			frontmatter.dateModified = formatLocalTimestamp(timestamp);
		});

		const items = created.map((subtask) => subtaskListItem(subtask.slug, subtask.title));
		await this.app.vault.process(file, (content) =>
			appendSubtaskLinks(removeSubtaskLinks(content, removedLinks), items)
		);
	}

	/**
	 * The notes the parent already treats as subtasks, found through both
	 * `subtaskIds` and its checklist, since the two can drift apart.
	 */
	private collectSubtasks(
		parent: TFile,
		frontmatter: Record<string, unknown>,
		content: string
	): ExistingSubtask[] {
		const index = this.indexTasks();
		const found = new Map<string, ExistingSubtask>();

		const add = (file: TFile | null, linkTarget?: string) => {
			if (!file || file.path === parent.path) return;

			const seen = found.get(file.path);
			if (seen) {
				if (linkTarget) seen.linkTargets.push(linkTarget);
				return;
			}

			const subtaskFrontmatter =
				this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
			const id = readString(subtaskFrontmatter.id);
			const ownSubtasks = readStringList(subtaskFrontmatter.subtaskIds);

			found.set(file.path, {
				file,
				id,
				linkTargets: linkTarget ? [linkTarget] : [],
				hasChildren:
					ownSubtasks.length > 0 || (id !== null && (index.childCounts.get(id) ?? 0) > 0),
			});
		};

		for (const id of readStringList(frontmatter.subtaskIds)) {
			add(index.byId.get(id) ?? null);
		}
		for (const target of listSubtaskLinkTargets(content)) {
			add(this.app.metadataCache.getFirstLinkpathDest(target, parent.path), target);
		}

		return [...found.values()];
	}

	/** One pass over the vault: which note holds each id, and who has children. */
	private indexTasks(): TaskIndex {
		const byId = new Map<string, TFile>();
		const childCounts = new Map<string, number>();

		for (const file of this.app.vault.getMarkdownFiles()) {
			const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
			if (!frontmatter) continue;

			const id = readString(frontmatter.id);
			if (id && !byId.has(id)) byId.set(id, file);

			const parentId = readString(frontmatter.parentId);
			if (parentId) childCounts.set(parentId, (childCounts.get(parentId) ?? 0) + 1);
		}

		return { byId, childCounts };
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

function describe(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function summarize(counts: {
	created: number;
	replaced: number;
	kept: number;
	failed: number;
}): string {
	if (counts.created === 0 && counts.replaced === 0) {
		return counts.failed > 0
			? "Task Filler: nothing could be changed — see the console."
			: "Task Filler: no subtasks were created.";
	}

	const parts = [`created ${describe(counts.created, "subtask")}`];
	if (counts.replaced > 0) parts.push(`replaced ${counts.replaced}`);
	if (counts.kept > 0) parts.push(`kept ${counts.kept} with subtasks of their own`);
	if (counts.failed > 0) parts.push(`${counts.failed} failed`);

	return `Task Filler: ${parts.join(", ")}.`;
}
