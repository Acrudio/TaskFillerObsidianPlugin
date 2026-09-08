import { App, PluginSettingTab, Setting } from "obsidian";
import type TaskFillerPlugin from "./main";

export interface TaskFillerSettings {
	/** Frontmatter property holding the first day of work. */
	startProperty: string;
	/** Frontmatter property holding the last day of work. */
	dueProperty: string;
	/** Frontmatter property holding the estimate, in minutes. */
	timeEstimateProperty: string;
	/** Template for each subtask title. Supports {{title}}, {{day}}, {{total}} and {{date}}. */
	titleTemplate: string;
	/** Vault folder for new subtasks. Empty means alongside the parent note. */
	subtaskFolder: string;
	/** Give each subtask a start date as well as a due date. */
	setStartOnSubtasks: boolean;
	/** Copy the parent's tags onto each subtask. */
	inheritTags: boolean;
	/** Status for a task with no subtask completed yet, and for new subtasks. */
	notStartedStatus: string;
	/** Status for a task with some, but not all, subtasks completed. */
	inProgressStatus: string;
	/** Status for a task whose subtasks are all completed. */
	completedStatus: string;
	/** Keep a parent's progress and status in step with its subtasks automatically. */
	syncParentProgress: boolean;
	/** Ask before moving a previous run's subtasks to trash. */
	confirmBeforeReplacing: boolean;
	/** Refuse to split spans longer than this, as a guard against typos in dates. */
	maxSubtasks: number;
}

export const DEFAULT_SETTINGS: TaskFillerSettings = {
	startProperty: "start",
	dueProperty: "due",
	timeEstimateProperty: "timeEstimate",
	titleTemplate: "{{title}} (Day {{day}}/{{total}})",
	subtaskFolder: "",
	setStartOnSubtasks: true,
	inheritTags: true,
	notStartedStatus: "notStarted",
	inProgressStatus: "inProgress",
	completedStatus: "completed",
	syncParentProgress: true,
	confirmBeforeReplacing: true,
	maxSubtasks: 60,
};

export class TaskFillerSettingTab extends PluginSettingTab {
	plugin: TaskFillerPlugin;

	constructor(app: App, plugin: TaskFillerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private text(
		name: string,
		desc: string,
		key:
			| "startProperty"
			| "dueProperty"
			| "timeEstimateProperty"
			| "titleTemplate"
			| "subtaskFolder"
			| "notStartedStatus"
			| "inProgressStatus"
			| "completedStatus",
		placeholder: string
	): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(desc)
			.addText((text) =>
				text
					.setPlaceholder(placeholder)
					.setValue(this.plugin.settings[key])
					.onChange(async (value) => {
						const trimmed = value.trim();
						this.plugin.settings[key] = trimmed || DEFAULT_SETTINGS[key];
						await this.plugin.saveSettings();
					})
			);
	}

	display(): void {
		this.containerEl.empty();

		new Setting(this.containerEl).setName("Subtasks").setHeading();

		this.text(
			"Title template",
			"Title given to each subtask. Available placeholders: {{title}}, {{day}}, {{total}} and {{date}}.",
			"titleTemplate",
			DEFAULT_SETTINGS.titleTemplate
		);

		this.text(
			"Folder",
			"Where new subtask notes are created. Leave empty to place them beside the parent note.",
			"subtaskFolder",
			"Same folder as the parent"
		);

		new Setting(this.containerEl)
			.setName("Confirm before replacing")
			.setDesc(
				"Ask before moving a previous run's subtasks to trash. Subtasks that have subtasks of their own are never touched."
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.confirmBeforeReplacing).onChange(async (value) => {
					this.plugin.settings.confirmBeforeReplacing = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(this.containerEl)
			.setName("Set a start date")
			.setDesc("Give each subtask a start date equal to its due date, so it spans a single day.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.setStartOnSubtasks).onChange(async (value) => {
					this.plugin.settings.setStartOnSubtasks = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(this.containerEl)
			.setName("Inherit tags")
			.setDesc("Copy the parent task's tags onto each subtask.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.inheritTags).onChange(async (value) => {
					this.plugin.settings.inheritTags = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(this.containerEl)
			.setName("Maximum subtasks")
			.setDesc("Refuse to split a span longer than this many days, as a guard against mistyped dates.")
			.addText((text) =>
				text
					.setPlaceholder(String(DEFAULT_SETTINGS.maxSubtasks))
					.setValue(String(this.plugin.settings.maxSubtasks))
					.onChange(async (value) => {
						const parsed = Number(value);
						this.plugin.settings.maxSubtasks =
							Number.isFinite(parsed) && parsed >= 1
								? Math.floor(parsed)
								: DEFAULT_SETTINGS.maxSubtasks;
						await this.plugin.saveSettings();
					})
			);

		new Setting(this.containerEl).setName("Progress").setHeading();

		new Setting(this.containerEl)
			.setName("Track subtask completion")
			.setDesc(
				"Keep a task's progress and status in step with its subtasks: the percentage completed, and the status values below."
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.syncParentProgress).onChange(async (value) => {
					this.plugin.settings.syncParentProgress = value;
					await this.plugin.saveSettings();
				})
			);

		this.text(
			"Not started",
			"Status for a task with no subtask completed yet. Also the status given to new subtasks.",
			"notStartedStatus",
			DEFAULT_SETTINGS.notStartedStatus
		);
		this.text(
			"In progress",
			"Status for a task with some, but not all, of its subtasks completed.",
			"inProgressStatus",
			DEFAULT_SETTINGS.inProgressStatus
		);
		this.text(
			"Completed",
			"Status for a task whose subtasks are all completed. A subtask counts as completed when its own status property holds this value.",
			"completedStatus",
			DEFAULT_SETTINGS.completedStatus
		);

		new Setting(this.containerEl).setName("Frontmatter properties").setHeading();

		this.text("Start date", "Property holding the first day of work.", "startProperty", "start");
		this.text("Due date", "Property holding the last day of work.", "dueProperty", "due");
		this.text(
			"Time estimate",
			"Property holding the estimate in minutes, divided evenly across the days.",
			"timeEstimateProperty",
			"timeEstimate"
		);
	}
}
