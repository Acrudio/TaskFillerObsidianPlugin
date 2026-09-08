import { App, Modal, Setting } from "obsidian";

/**
 * Ask before deleting notes. Resolves true only when the user confirms; closing
 * the modal any other way counts as a cancel.
 */
export function confirm(app: App, options: {
	title: string;
	message: string;
	details?: string[];
	cta: string;
}): Promise<boolean> {
	return new Promise((resolve) => {
		new ConfirmModal(app, options, resolve).open();
	});
}

class ConfirmModal extends Modal {
	private settled = false;

	constructor(
		app: App,
		private readonly options: {
			title: string;
			message: string;
			details?: string[];
			cta: string;
		},
		private readonly resolve: (confirmed: boolean) => void
	) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText(this.options.title);
		this.contentEl.createEl("p", { text: this.options.message });

		if (this.options.details?.length) {
			const list = this.contentEl.createEl("ul");
			for (const detail of this.options.details) {
				list.createEl("li", { text: detail });
			}
		}

		new Setting(this.contentEl)
			.addButton((button) =>
				button.setButtonText("Cancel").onClick(() => this.settle(false))
			)
			.addButton((button) =>
				button
					.setButtonText(this.options.cta)
					.setWarning()
					.onClick(() => this.settle(true))
			);
	}

	onClose(): void {
		this.contentEl.empty();
		this.settle(false);
	}

	private settle(confirmed: boolean): void {
		if (this.settled) return;
		this.settled = true;
		this.resolve(confirmed);
		this.close();
	}
}
