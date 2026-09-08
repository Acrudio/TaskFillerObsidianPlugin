import {
	enumerateDays,
	formatPlainDate,
	inclusiveDayCount,
	parsePlainDate,
	type PlainDate,
} from "./dates";
import { generateId } from "./ids";
import { formatTitle, slugify } from "./naming";

export interface PlanOptions {
	startProperty: string;
	dueProperty: string;
	timeEstimateProperty: string;
	titleTemplate: string;
	/** Used as the task title when the note has no title property. */
	fallbackTitle: string;
	maxSubtasks: number;
	now?: number;
	random?: () => number;
}

export interface SubtaskPlan {
	id: string;
	title: string;
	slug: string;
	date: PlainDate;
	dayNumber: number;
	totalDays: number;
	/** Minutes, or null when the parent has no estimate to divide. */
	timeEstimate: number | null;
	/** ISO timestamp matching the one encoded in `id`. */
	createdAt: string;
}

export type PlanResult =
	| { ok: true; parentTitle: string; totalDays: number; subtasks: SubtaskPlan[] }
	| { ok: false; error: string };

/**
 * Split `total` minutes across `parts` days so the parts sum back to exactly
 * `total`. An indivisible remainder lands on the earliest days.
 */
export function distributeMinutes(total: number, parts: number): number[] {
	if (parts <= 0) return [];
	const base = Math.floor(total / parts);
	const remainder = total - base * parts;
	return Array.from({ length: parts }, (_, i) => (i < remainder ? base + 1 : base));
}

function readNumber(value: unknown): number | null {
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

/** Work out the subtasks a parent task should be split into, without touching the vault. */
export function buildPlan(
	frontmatter: Record<string, unknown>,
	options: PlanOptions
): PlanResult {
	const start = parsePlainDate(frontmatter[options.startProperty]);
	const due = parsePlainDate(frontmatter[options.dueProperty]);

	if (!start && !due) {
		return {
			ok: false,
			error: `This note has no \`${options.startProperty}\` or \`${options.dueProperty}\` date.`,
		};
	}
	if (!start) {
		return { ok: false, error: `This note has no \`${options.startProperty}\` date.` };
	}
	if (!due) {
		return { ok: false, error: `This note has no \`${options.dueProperty}\` date.` };
	}

	const totalDays = inclusiveDayCount(start, due);
	if (totalDays < 1) {
		return {
			ok: false,
			error: `\`${options.dueProperty}\` (${formatPlainDate(due)}) is before \`${
				options.startProperty
			}\` (${formatPlainDate(start)}).`,
		};
	}
	if (totalDays > options.maxSubtasks) {
		return {
			ok: false,
			error: `That span is ${totalDays} days, over the limit of ${options.maxSubtasks}. Raise the limit in settings if that is intended.`,
		};
	}

	const rawTitle = frontmatter.title;
	const parentTitle =
		typeof rawTitle === "string" && rawTitle.trim() !== ""
			? rawTitle.trim()
			: options.fallbackTitle;

	const estimate = readNumber(frontmatter[options.timeEstimateProperty]);
	const shares =
		estimate !== null && estimate > 0 ? distributeMinutes(estimate, totalDays) : null;

	const now = options.now ?? Date.now();

	const subtasks = enumerateDays(start, due).map((date, index) => {
		const title = formatTitle(options.titleTemplate, {
			title: parentTitle,
			day: index + 1,
			total: totalDays,
			date: formatPlainDate(date),
		});
		// Offset each stamp by its index so a batch created in the same
		// millisecond still gets distinct, ordered identifiers.
		const stamp = now + index;
		return {
			id: generateId(stamp, options.random),
			title,
			slug: slugify(title),
			date,
			dayNumber: index + 1,
			totalDays,
			timeEstimate: shares ? shares[index] : null,
			createdAt: new Date(stamp).toISOString(),
		};
	});

	return { ok: true, parentTitle, totalDays, subtasks };
}
