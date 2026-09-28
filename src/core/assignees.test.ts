import assert from "node:assert/strict";
import { test } from "node:test";
import { copyAssignees, readAssignees } from "./assignees";

test("copies assignments verbatim and replaces existing assignments", async () => {
	const parent = ["[[Alice]]", "Bob"];
	const children = [{ assignees: ["Old"], title: "First" }, { assignees: [], title: "Second" }];
	const result = await copyAssignees(children, readAssignees(parent), async (child, values) => {
		child.assignees = values;
	}, () => assert.fail("unexpected write failure"));
	assert.deepEqual(result, { updated: 2, failed: 0 });
	assert.deepEqual(children[0], { assignees: parent, title: "First" });
	assert.deepEqual(children[1], { assignees: parent, title: "Second" });
	children[0].assignees.push("Other");
	assert.deepEqual(children[1].assignees, parent);
	assert.deepEqual(parent, ["[[Alice]]", "Bob"]);
});

test("empty or missing parent assignments clear child assignments", async () => {
	for (const value of [[], undefined, null]) {
		const child = { assignees: ["Old"] };
		await copyAssignees([child], readAssignees(value), async (target, values) => {
			target.assignees = values;
		}, () => assert.fail("unexpected write failure"));
		assert.deepEqual(child.assignees, []);
	}
});

test("rejects malformed assignments before any writes", () => {
	for (const value of ["Alice", ["Alice", 42], {}]) {
		assert.throws(() => readAssignees(value), /list of strings/);
	}
});

test("reports failures and continues updating remaining subtasks", async () => {
	const written: string[] = [];
	const failed: string[] = [];
	const result = await copyAssignees(["a", "b", "c"], ["Alice"], async (child) => {
		if (child === "b") throw new Error("write failed");
		written.push(child);
	}, (child) => failed.push(child));
	assert.deepEqual(written, ["a", "c"]);
	assert.deepEqual(failed, ["b"]);
	assert.deepEqual(result, { updated: 2, failed: 1 });
});
