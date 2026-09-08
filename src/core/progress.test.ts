import assert from "node:assert/strict";
import { test } from "node:test";
import { summariseSubtasks, type StatusVocabulary } from "./progress";

const STATUSES: StatusVocabulary = {
	notStarted: "notStarted",
	inProgress: "inProgress",
	completed: "completed",
};

test("reports the percentage of subtasks completed", () => {
	assert.deepEqual(summariseSubtasks(0, 3, STATUSES), { progress: 0, status: "notStarted" });
	assert.deepEqual(summariseSubtasks(1, 3, STATUSES), { progress: 33, status: "inProgress" });
	assert.deepEqual(summariseSubtasks(2, 3, STATUSES), { progress: 67, status: "inProgress" });
	assert.deepEqual(summariseSubtasks(3, 3, STATUSES), { progress: 100, status: "completed" });
});

test("moves to in progress as soon as one subtask is done", () => {
	assert.equal(summariseSubtasks(1, 100, STATUSES)?.status, "inProgress");
});

test("only a finished task reads as 100, and only an untouched one as 0", () => {
	// Rounding alone would report 100 with one subtask left, and 0 with one done.
	assert.deepEqual(summariseSubtasks(199, 200, STATUSES), { progress: 99, status: "inProgress" });
	assert.deepEqual(summariseSubtasks(1, 300, STATUSES), { progress: 1, status: "inProgress" });
});

test("a single subtask is all or nothing", () => {
	assert.deepEqual(summariseSubtasks(0, 1, STATUSES), { progress: 0, status: "notStarted" });
	assert.deepEqual(summariseSubtasks(1, 1, STATUSES), { progress: 100, status: "completed" });
});

test("a task with no subtasks is left alone", () => {
	assert.equal(summariseSubtasks(0, 0, STATUSES), null);
});

test("uses the configured status names", () => {
	const custom = { notStarted: "todo", inProgress: "doing", completed: "done" };
	assert.equal(summariseSubtasks(0, 2, custom)?.status, "todo");
	assert.equal(summariseSubtasks(1, 2, custom)?.status, "doing");
	assert.equal(summariseSubtasks(2, 2, custom)?.status, "done");
});

test("a miscounted total cannot push progress out of range", () => {
	assert.deepEqual(summariseSubtasks(5, 3, STATUSES), { progress: 100, status: "completed" });
	assert.deepEqual(summariseSubtasks(-1, 3, STATUSES), { progress: 0, status: "notStarted" });
});
