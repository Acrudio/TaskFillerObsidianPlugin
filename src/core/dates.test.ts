import assert from "node:assert/strict";
import { test } from "node:test";
import {
	addDays,
	enumerateDays,
	formatLocalTimestamp,
	formatPlainDate,
	inclusiveDayCount,
	parsePlainDate,
} from "./dates";

test("parses the frontmatter shapes YAML can produce", () => {
	const expected = { year: 2026, month: 9, day: 7 };
	assert.deepEqual(parsePlainDate("2026-09-07"), expected);
	assert.deepEqual(parsePlainDate("2026-09-07T13:45:00Z"), expected);
	assert.deepEqual(parsePlainDate(new Date("2026-09-07T00:00:00Z")), expected);
	assert.deepEqual(parsePlainDate(Date.UTC(2026, 8, 7)), expected);
});

test("rejects values that are not dates", () => {
	for (const value of [null, undefined, "", "someday", "2026-13-01", "2026-02-30", {}, NaN]) {
		assert.equal(parsePlainDate(value), null, `expected null for ${String(value)}`);
	}
});

test("counts both ends of the span", () => {
	const start = { year: 2026, month: 9, day: 7 };
	assert.equal(inclusiveDayCount(start, { year: 2026, month: 9, day: 9 }), 3);
	assert.equal(inclusiveDayCount(start, start), 1);
	assert.equal(inclusiveDayCount(start, { year: 2026, month: 9, day: 6 }), 0);
});

test("enumerates the days of a span", () => {
	const days = enumerateDays({ year: 2026, month: 9, day: 7 }, { year: 2026, month: 9, day: 9 });
	assert.deepEqual(days.map(formatPlainDate), ["2026-09-07", "2026-09-08", "2026-09-09"]);
});

test("crosses month, year and leap-day boundaries", () => {
	assert.equal(formatPlainDate(addDays({ year: 2026, month: 9, day: 30 }, 1)), "2026-10-01");
	assert.equal(formatPlainDate(addDays({ year: 2026, month: 12, day: 31 }, 1)), "2027-01-01");
	assert.equal(formatPlainDate(addDays({ year: 2028, month: 2, day: 28 }, 1)), "2028-02-29");
});

test("a span across a daylight-saving change keeps one entry per day", () => {
	// US DST ends 2026-11-01; naive local-time arithmetic drops or repeats a day.
	const days = enumerateDays({ year: 2026, month: 10, day: 31 }, { year: 2026, month: 11, day: 2 });
	assert.deepEqual(days.map(formatPlainDate), ["2026-10-31", "2026-11-01", "2026-11-02"]);
});

test("formats a local timestamp with its offset", () => {
	const stamp = formatLocalTimestamp(new Date(2026, 8, 8, 15, 35, 15, 249));
	assert.match(stamp, /^2026-09-08T15:35:15\.249[+-]\d{2}:\d{2}$/);
});
