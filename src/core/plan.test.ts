import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPlan, distributeMinutes, type PlanOptions, type PlanResult } from "./plan";
import { formatPlainDate } from "./dates";

const OPTIONS: PlanOptions = {
	startProperty: "start",
	dueProperty: "due",
	timeEstimateProperty: "timeEstimate",
	titleTemplate: "{{title}} (Day {{day}}/{{total}})",
	fallbackTitle: "Untitled task",
	maxSubtasks: 60,
	now: Date.parse("2026-09-08T19:31:01.731Z"),
	random: () => 0.5,
};

const PARENT = {
	"pm-task": true,
	projectId: "g3y2kjulmtq0zupg",
	id: "2pjorumkmtq10aie",
	title: "🔨 Manufacturing HW 1",
	start: "2026-09-07",
	due: "2026-09-09",
	timeEstimate: 180,
};

/** Assert the plan succeeded, narrowing it to the success branch for the caller. */
function ok(result: PlanResult): Extract<PlanResult, { ok: true }> {
	if (!result.ok) assert.fail(result.error);
	return result;
}

test("splits the worked example into one subtask per day", () => {
	const plan = ok(buildPlan(PARENT, OPTIONS));

	assert.equal(plan.totalDays, 3);
	assert.deepEqual(
		plan.subtasks.map((s) => s.title),
		[
			"🔨 Manufacturing HW 1 (Day 1/3)",
			"🔨 Manufacturing HW 1 (Day 2/3)",
			"🔨 Manufacturing HW 1 (Day 3/3)",
		]
	);
	assert.deepEqual(
		plan.subtasks.map((s) => formatPlainDate(s.date)),
		["2026-09-07", "2026-09-08", "2026-09-09"]
	);
	assert.deepEqual(
		plan.subtasks.map((s) => s.timeEstimate),
		[60, 60, 60]
	);
});

test("every subtask gets a distinct id matching its createdAt", () => {
	const plan = ok(buildPlan(PARENT, OPTIONS));
	const ids = plan.subtasks.map((s) => s.id);

	assert.equal(new Set(ids).size, ids.length);
	for (const subtask of plan.subtasks) {
		assert.equal(parseInt(subtask.id.slice(8), 36), Date.parse(subtask.createdAt));
	}
});

test("an indivisible estimate still sums to the parent's total", () => {
	const plan = ok(buildPlan({ ...PARENT, timeEstimate: 100 }, OPTIONS));
	const shares = plan.subtasks.map((s) => s.timeEstimate as number);

	assert.deepEqual(shares, [34, 33, 33]);
	assert.equal(
		shares.reduce((a, b) => a + b, 0),
		100
	);
});

test("no estimate on the parent means no estimate on the subtasks", () => {
	for (const timeEstimate of [undefined, 0]) {
		const plan = ok(buildPlan({ ...PARENT, timeEstimate }, OPTIONS));
		assert.deepEqual(
			plan.subtasks.map((s) => s.timeEstimate),
			[null, null, null]
		);
	}
});

test("a single-day task yields one subtask", () => {
	const plan = ok(buildPlan({ ...PARENT, due: "2026-09-07", timeEstimate: 45 }, OPTIONS));
	assert.deepEqual(
		plan.subtasks.map((s) => [s.title, s.timeEstimate]),
		[["🔨 Manufacturing HW 1 (Day 1/1)", 45]]
	);
});

test("falls back to the file name when the note has no title", () => {
	const { title, ...untitled } = PARENT;
	const plan = ok(buildPlan(untitled, OPTIONS));
	assert.equal(plan.subtasks[0].title, "Untitled task (Day 1/3)");
});

test("reads dates that YAML parsed into Date objects", () => {
	const plan = ok(
		buildPlan({ ...PARENT, start: new Date("2026-09-07"), due: new Date("2026-09-08") }, OPTIONS)
	);
	assert.deepEqual(
		plan.subtasks.map((s) => formatPlainDate(s.date)),
		["2026-09-07", "2026-09-08"]
	);
});

test("reports the missing property rather than guessing", () => {
	const cases: [Record<string, unknown>, RegExp][] = [
		[{ ...PARENT, start: undefined }, /`start`/],
		[{ ...PARENT, due: undefined }, /`due`/],
		[{}, /`start`.*`due`/],
	];
	for (const [frontmatter, expected] of cases) {
		const result = buildPlan(frontmatter, OPTIONS);
		assert.equal(result.ok, false);
		if (!result.ok) assert.match(result.error, expected);
	}
});

test("refuses a due date before the start date", () => {
	const result = buildPlan({ ...PARENT, due: "2026-09-05" }, OPTIONS);
	assert.equal(result.ok, false);
	if (!result.ok) assert.match(result.error, /before/);
});

test("refuses a span past the configured limit", () => {
	const result = buildPlan({ ...PARENT, due: "2026-12-31" }, { ...OPTIONS, maxSubtasks: 30 });
	assert.equal(result.ok, false);
	if (!result.ok) assert.match(result.error, /over the limit of 30/);
});

test("honours renamed frontmatter properties", () => {
	const plan = ok(
		buildPlan(
			{ title: "Read", scheduled: "2026-09-07", due: "2026-09-08", estimate: "60" },
			{ ...OPTIONS, startProperty: "scheduled", timeEstimateProperty: "estimate" }
		)
	);
	assert.deepEqual(
		plan.subtasks.map((s) => s.timeEstimate),
		[30, 30]
	);
});

test("distributes minutes without losing or inventing any", () => {
	for (const [total, parts] of [
		[180, 3],
		[100, 3],
		[7, 5],
		[0, 4],
		[1, 4],
	]) {
		const shares = distributeMinutes(total, parts);
		assert.equal(shares.length, parts);
		assert.equal(
			shares.reduce((a, b) => a + b, 0),
			total
		);
		assert.ok(Math.max(...shares) - Math.min(...shares) <= 1);
	}
});
