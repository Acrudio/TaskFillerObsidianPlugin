/** Values YAML would read as something other than a plain string. */
const YAML_KEYWORDS = /^(true|false|yes|no|on|off|null|~)$/i;
const NEEDS_QUOTES = /^[\s>|&*!%@`'"[\]{},#-]|:\s|:$|\s#|\s$|^$/;

/** Render a string as a YAML scalar, quoting only when it would otherwise change meaning. */
export function yamlScalar(value: string): string {
	if (
		NEEDS_QUOTES.test(value) ||
		YAML_KEYWORDS.test(value) ||
		value.includes("\n") ||
		value.includes('"') ||
		/^-?\d+(\.\d+)?$/.test(value)
	) {
		return JSON.stringify(value);
	}
	return value;
}

export interface SubtaskNote {
	id: string;
	parentId: string | null;
	projectId: string | null;
	title: string;
	status: string;
	priority: string;
	/** `YYYY-MM-DD`, or null to omit the start property. */
	start: string | null;
	due: string;
	tags: string[];
	timeEstimate: number | null;
	/** ISO timestamp, matching the one encoded in `id`. */
	createdAt: string;
	/** Local ISO timestamp with offset, for Tasknotes' `dateModified`. */
	dateModified: string;
	/** Body lines carried over from the parent, such as its `Project:` link. */
	body: string[];
}

/** Build the full contents of a subtask note, frontmatter included. */
export function renderSubtaskNote(note: SubtaskNote): string {
	const lines = ["---", "pm-task: true"];

	if (note.projectId) lines.push(`projectId: ${yamlScalar(note.projectId)}`);
	lines.push(`parentId: ${note.parentId ? yamlScalar(note.parentId) : ""}`);
	lines.push(`id: ${yamlScalar(note.id)}`);
	lines.push(`title: ${yamlScalar(note.title)}`);
	lines.push("type: task");
	lines.push(`status: ${yamlScalar(note.status)}`);
	lines.push(`priority: ${yamlScalar(note.priority)}`);
	if (note.start) lines.push(`start: ${note.start}`);
	lines.push(`due: ${note.due}`);
	lines.push("progress: 0");
	lines.push("assignees: []");

	if (note.tags.length === 0) {
		lines.push("tags: []");
	} else {
		lines.push("tags:");
		for (const tag of note.tags) lines.push(`  - ${yamlScalar(tag)}`);
	}

	lines.push("subtaskIds: []");
	lines.push("dependencies: []");
	lines.push(`createdAt: ${note.createdAt}`);
	lines.push(`updatedAt: ${note.createdAt}`);
	if (note.timeEstimate !== null) lines.push(`timeEstimate: ${note.timeEstimate}`);
	lines.push(`dateModified: ${note.dateModified}`);
	lines.push("---", "");

	if (note.body.length > 0) lines.push(...note.body, "");

	return lines.join("\n");
}

/** A checklist entry linking to a subtask note, as Project Manager writes them. */
export function subtaskListItem(slug: string, title: string): string {
	return `- [ ] [[${slug}|${title}]]`;
}

const HEADING = /^#{1,6}\s/;
const SUBTASKS_HEADING = /^#{1,6}\s+subtasks\s*$/i;

/**
 * Add checklist entries to the parent's `## Subtasks` section, creating the
 * section when it is missing. Frontmatter and every other section are left
 * untouched.
 */
export function appendSubtaskLinks(content: string, items: string[]): string {
	if (items.length === 0) return content;

	const lines = content.split("\n");
	const headingIndex = lines.findIndex((line) => SUBTASKS_HEADING.test(line));

	if (headingIndex === -1) {
		const trimmed = content.replace(/\s+$/, "");
		const prefix = trimmed === "" ? "" : `${trimmed}\n\n`;
		return `${prefix}## Subtasks\n${items.join("\n")}\n`;
	}

	// Find where the section ends, then back up over its trailing blank lines so
	// the new entries join the existing list rather than following a gap.
	let end = headingIndex + 1;
	while (end < lines.length && !HEADING.test(lines[end])) end++;
	while (end > headingIndex + 1 && lines[end - 1].trim() === "") end--;

	lines.splice(end, 0, ...items);
	return lines.join("\n");
}

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

/** The note's contents with any leading YAML frontmatter block removed. */
export function stripFrontmatter(content: string): string {
	return content.replace(FRONTMATTER, "");
}
