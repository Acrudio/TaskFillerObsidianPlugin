import { App, PluginSettingTab, Setting } from "obsidian";
import type TaskFillerPlugin from "./main";

export interface TaskFillerSettings {
	/** Marker written between the brackets for a new, unfinished task. */
	taskMarker: string;
	/** Append a date stamp after the task text. */
	includeDate: boolean;
	/** Moment.js format used for the date stamp. */
	dateFormat: string;
}

export const DEFAULT_SETTINGS: TaskFillerSettings = {
	taskMarker: " ",
	includeDate: false,
	dateFormat: "YYYY-MM-DD",
};

export class TaskFillerSettingTab extends PluginSettingTab {
	plugin: TaskFillerPlugin;

	constructor(app: App, plugin: TaskFillerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Task marker")
			.setDesc("Character placed inside the checkbox for a new task.")
			.addText((text) =>
				text
					.setPlaceholder(" ")
					.setValue(this.plugin.settings.taskMarker)
					.onChange(async (value) => {
						this.plugin.settings.taskMarker = value.slice(0, 1) || " ";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Append date")
			.setDesc("Add a date stamp to each inserted task.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.includeDate)
					.onChange(async (value) => {
						this.plugin.settings.includeDate = value;
						await this.plugin.saveSettings();
						this.display();
					})
			);

		if (this.plugin.settings.includeDate) {
			new Setting(containerEl)
				.setName("Date format")
				.setDesc("Moment.js format string, for example YYYY-MM-DD.")
				.addText((text) =>
					text
						.setPlaceholder("YYYY-MM-DD")
						.setValue(this.plugin.settings.dateFormat)
						.onChange(async (value) => {
							this.plugin.settings.dateFormat = value || DEFAULT_SETTINGS.dateFormat;
							await this.plugin.saveSettings();
						})
				);
		}
	}
}
