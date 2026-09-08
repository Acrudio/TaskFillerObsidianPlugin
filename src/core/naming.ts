/** Characters Obsidian and the common filesystems refuse in a note name. */
const ILLEGAL_IN_FILENAME = /[\\/:*?"<>|#^[\]]/g;

export interface TitleFields {
	title: string;
	day: number;
	total: number;
	date: string;
}

/** Expand `{{title}}`, `{{day}}`, `{{total}}` and `{{date}}` in a title template. */
export function formatTitle(template: string, fields: TitleFields): string {
	return template.replace(/\{\{\s*(title|day|total|date)\s*\}\}/g, (_, key: keyof TitleFields) =>
		String(fields[key])
	);
}

/**
 * Turn a task title into a note name, matching the lowercase-hyphenated
 * convention Project Manager already uses for its task files.
 */
export function slugify(title: string): string {
	return (
		title
			.toLowerCase()
			.replace(ILLEGAL_IN_FILENAME, "-")
			.replace(/\s+/g, "-")
			.replace(/-{2,}/g, "-")
			.replace(/^[-.]+|[-.]+$/g, "") || "untitled"
	);
}
