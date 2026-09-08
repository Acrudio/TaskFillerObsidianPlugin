import { Editor, MarkdownView, Plugin, moment } from "obsidian";
import {
	DEFAULT_SETTINGS,
	TaskFillerSettingTab,
	type TaskFillerSettings,
} from "./settings";

const TASK_LINE = /^(\s*[-*+]\s+)\[(.)\]\s?(.*)$/;

export default class TaskFillerPlugin extends Plugin {
	settings: TaskFillerSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addCommand({
			id: "insert-task",
			name: "Insert task",
			editorCallback: (editor: Editor) => this.insertTask(editor),
		});

		this.addCommand({
			id: "toggle-task",
			name: "Toggle task on current line",
			editorCallback: (editor: Editor) => this.toggleTask(editor),
		});

		this.addRibbonIcon("checkbox-glyph", "Insert task", () => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (view) this.insertTask(view.editor);
		});

		this.addSettingTab(new TaskFillerSettingTab(this.app, this));
	}

	/** Turn the current line into a task, or add a fresh task line below it. */
	insertTask(editor: Editor): void {
		const cursor = editor.getCursor();
		const line = editor.getLine(cursor.line);
		const marker = this.settings.taskMarker;
		const suffix = this.settings.includeDate
			? ` ${moment().format(this.settings.dateFormat)}`
			: "";

		if (TASK_LINE.test(line)) {
			const text = `- [${marker}]${suffix} `;
			editor.replaceRange("\n" + text, { line: cursor.line, ch: line.length });
			editor.setCursor({ line: cursor.line + 1, ch: text.length });
			return;
		}

		const body = line.trim();
		const text = `- [${marker}] ${body}${suffix}`;
		editor.setLine(cursor.line, text);
		editor.setCursor({ line: cursor.line, ch: text.length });
	}

	/** Flip the checkbox on the current line between done and not done. */
	toggleTask(editor: Editor): void {
		const cursor = editor.getCursor();
		const match = TASK_LINE.exec(editor.getLine(cursor.line));
		if (!match) return;

		const [, bullet, state, body] = match;
		const next = state === "x" ? this.settings.taskMarker : "x";
		editor.setLine(cursor.line, `${bullet}[${next}] ${body}`);
		editor.setCursor(cursor);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
