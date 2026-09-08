/** The status values a task moves between as its subtasks are completed. */
export interface StatusVocabulary {
	notStarted: string;
	inProgress: string;
	completed: string;
}

export interface ParentProgress {
	/** Percentage of subtasks completed, 0-100. */
	progress: number;
	status: string;
}

/**
 * The progress and status a parent task should carry given how many of its
 * subtasks are done. Null when there are no subtasks, leaving a task the user
 * manages by hand exactly as they set it.
 *
 * The percentage is nudged away from the endpoints when rounding would reach
 * them early, so 0 and 100 mean what they say: no subtask done, and every
 * subtask done.
 */
export function summariseSubtasks(
	completed: number,
	total: number,
	statuses: StatusVocabulary
): ParentProgress | null {
	if (total <= 0) return null;

	const done = Math.min(Math.max(completed, 0), total);
	let progress = Math.round((done / total) * 100);
	if (progress === 100 && done < total) progress = 99;
	if (progress === 0 && done > 0) progress = 1;

	return {
		progress,
		status:
			done === 0
				? statuses.notStarted
				: done === total
					? statuses.completed
					: statuses.inProgress,
	};
}
