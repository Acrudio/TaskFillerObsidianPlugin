/** A calendar date with no time or timezone attached, as written in frontmatter. */
export interface PlainDate {
	year: number;
	month: number; // 1-12
	day: number; // 1-31
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

function isValid(date: PlainDate): boolean {
	const d = new Date(Date.UTC(date.year, date.month - 1, date.day));
	return (
		d.getUTCFullYear() === date.year &&
		d.getUTCMonth() === date.month - 1 &&
		d.getUTCDate() === date.day
	);
}

/**
 * Read a calendar date out of a frontmatter value. YAML parsers hand back
 * strings, `Date`s or epoch numbers depending on how the value was written, so
 * accept all three. Anything with a time component is read in UTC, which is how
 * a bare `2026-09-07` is parsed — that keeps the day from sliding by one.
 */
export function parsePlainDate(value: unknown): PlainDate | null {
	if (value == null) return null;

	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) return null;
		return {
			year: value.getUTCFullYear(),
			month: value.getUTCMonth() + 1,
			day: value.getUTCDate(),
		};
	}

	if (typeof value === "number") {
		return Number.isFinite(value) ? parsePlainDate(new Date(value)) : null;
	}

	if (typeof value !== "string") return null;

	const match = ISO_DATE.exec(value.trim());
	if (!match) return null;

	const date = {
		year: Number(match[1]),
		month: Number(match[2]),
		day: Number(match[3]),
	};
	return isValid(date) ? date : null;
}

export function formatPlainDate(date: PlainDate): string {
	const month = String(date.month).padStart(2, "0");
	const day = String(date.day).padStart(2, "0");
	return `${date.year}-${month}-${day}`;
}

function toUtcMillis(date: PlainDate): number {
	return Date.UTC(date.year, date.month - 1, date.day);
}

export function addDays(date: PlainDate, days: number): PlainDate {
	const shifted = new Date(toUtcMillis(date) + days * 86_400_000);
	return {
		year: shifted.getUTCFullYear(),
		month: shifted.getUTCMonth() + 1,
		day: shifted.getUTCDate(),
	};
}

/** Number of calendar days from `start` to `end`, counting both ends. */
export function inclusiveDayCount(start: PlainDate, end: PlainDate): number {
	const span = toUtcMillis(end) - toUtcMillis(start);
	return Math.round(span / 86_400_000) + 1;
}

/** Every date from `start` through `end`, inclusive. */
export function enumerateDays(start: PlainDate, end: PlainDate): PlainDate[] {
	const count = inclusiveDayCount(start, end);
	if (count < 1) return [];
	return Array.from({ length: count }, (_, i) => addDays(start, i));
}

/** ISO 8601 timestamp keeping the local UTC offset, e.g. 2026-09-08T15:35:15.249-04:00. */
export function formatLocalTimestamp(date: Date): string {
	const pad = (n: number, width = 2) => String(Math.abs(n)).padStart(width, "0");
	const offsetMinutes = -date.getTimezoneOffset();
	const sign = offsetMinutes < 0 ? "-" : "+";
	const offset = `${sign}${pad(Math.floor(Math.abs(offsetMinutes) / 60))}:${pad(
		Math.abs(offsetMinutes) % 60
	)}`;
	return (
		`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
		`T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
		`.${pad(date.getMilliseconds(), 3)}${offset}`
	);
}
