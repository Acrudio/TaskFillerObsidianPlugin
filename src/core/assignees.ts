/** Validate before writing so malformed parent data cannot clear assignments. */
export function readAssignees(value: unknown): string[] {
	if (value === undefined || value === null) return [];
	if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
		throw new Error("The task's assignees property must be a list of strings.");
	}
	return [...value];
}

/** Replace each child's assignments, continuing if an individual write fails. */
export async function copyAssignees<T>(
	subtasks: T[],
	assignees: string[],
	write: (subtask: T, assignees: string[]) => Promise<void>,
	onError: (subtask: T, error: unknown) => void
): Promise<{ updated: number; failed: number }> {
	let updated = 0;
	let failed = 0;
	for (const subtask of subtasks) {
		try {
			await write(subtask, [...assignees]);
			updated++;
		} catch (error) {
			failed++;
			onError(subtask, error);
		}
	}
	return { updated, failed };
}
