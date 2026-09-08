import assert from "node:assert/strict";
import { test } from "node:test";
import {
	appendSubtaskLinks,
	renderSubtaskNote,
	stripFrontmatter,
	subtaskListItem,
	yamlScalar,
	type SubtaskNote,
} from "./note";

const NOTE: SubtaskNote = {
	id: "p6l19slkmtryplta",
	parentId: "2pjorumkmtq10aie",
	projectId: "g3y2kjulmtq0zupg",
	title: "🔨 Manufacturing HW 1 (Day 1/3)",
	status: "notStarted",
	priority: "medium",
	start: "2026-09-07",
	due: "2026-09-07",
	tags: [],
	timeEstimate: 60,
	createdAt: "2026-09-08T00:59:46.222Z",
	dateModified: "2026-09-08T15:35:15.249-04:00",
	body: ["Project: [[Homework|Homework]]"],
};

const PARENT = `---
pm-task: true
id: 2pjorumkmtq10aie
---

Project: [[Homework|Homework]]

## Subtasks
- [x] [[day-1|Day 1]]
`;

test("renders a subtask note in Project Manager's frontmatter shape", () => {
	assert.equal(
		renderSubtaskNote(NOTE),
		`---
pm-task: true
projectId: g3y2kjulmtq0zupg
parentId: 2pjorumkmtq10aie
id: p6l19slkmtryplta
title: 🔨 Manufacturing HW 1 (Day 1/3)
type: task
status: notStarted
priority: medium
start: 2026-09-07
due: 2026-09-07
progress: 0
assignees: []
tags: []
subtaskIds: []
dependencies: []
createdAt: 2026-09-08T00:59:46.222Z
updatedAt: 2026-09-08T00:59:46.222Z
timeEstimate: 60
dateModified: 2026-09-08T15:35:15.249-04:00
---

Project: [[Homework|Homework]]
`
	);
});

test("omits the optional properties that were not supplied", () => {
	const rendered = renderSubtaskNote({ ...NOTE, start: null, timeEstimate: null, body: [] });
	assert.doesNotMatch(rendered, /^start:/m);
	assert.doesNotMatch(rendered, /^timeEstimate:/m);
	assert.match(rendered, /^due: 2026-09-07$/m);
});

test("writes inherited tags as a YAML list", () => {
	assert.match(renderSubtaskNote({ ...NOTE, tags: ["school", "hw"] }), /tags:\n {2}- school\n {2}- hw/);
});

test("quotes only the scalars that YAML would misread", () => {
	assert.equal(yamlScalar("🔨 Manufacturing HW 1 (Day 1/3)"), "🔨 Manufacturing HW 1 (Day 1/3)");
	assert.equal(yamlScalar("notStarted"), "notStarted");
	assert.equal(yamlScalar("Review: part one"), '"Review: part one"');
	assert.equal(yamlScalar("- leading dash"), '"- leading dash"');
	assert.equal(yamlScalar("Blocked on:"), '"Blocked on:"');
	assert.equal(yamlScalar("draft #2"), '"draft #2"');
	assert.equal(yamlScalar("yes"), '"yes"');
	assert.equal(yamlScalar("42"), '"42"');
	assert.equal(yamlScalar(""), '""');
	assert.equal(yamlScalar('say "hi"'), '"say \\"hi\\""');
});

test("a title needing quotes still parses back out of the rendered note", () => {
	const rendered = renderSubtaskNote({ ...NOTE, title: "Review: part one" });
	assert.match(rendered, /^title: "Review: part one"$/m);
});

test("adds links to an existing Subtasks section", () => {
	const updated = appendSubtaskLinks(PARENT, [subtaskListItem("day-2", "Day 2")]);
	assert.equal(
		updated,
		`---
pm-task: true
id: 2pjorumkmtq10aie
---

Project: [[Homework|Homework]]

## Subtasks
- [x] [[day-1|Day 1]]
- [ ] [[day-2|Day 2]]
`
	);
});

test("keeps later sections below the Subtasks list", () => {
	const withNotes = PARENT + "\n## Notes\nSomething else\n";
	const updated = appendSubtaskLinks(withNotes, ["- [ ] [[day-2|Day 2]]"]);
	assert.match(updated, /- \[x\] \[\[day-1\|Day 1\]\]\n- \[ \] \[\[day-2\|Day 2\]\]\n\n## Notes/);
});

test("creates the Subtasks section when the note has none", () => {
	const updated = appendSubtaskLinks("---\nid: a\n---\n\nProject: [[Homework]]\n", [
		"- [ ] [[day-1|Day 1]]",
	]);
	assert.equal(updated, "---\nid: a\n---\n\nProject: [[Homework]]\n\n## Subtasks\n- [ ] [[day-1|Day 1]]\n");
});

test("leaves the note alone when there is nothing to add", () => {
	assert.equal(appendSubtaskLinks(PARENT, []), PARENT);
});

test("strips frontmatter without eating the body", () => {
	assert.equal(stripFrontmatter(PARENT), PARENT.split("---\n")[2]);
	assert.equal(stripFrontmatter("no frontmatter\n"), "no frontmatter\n");
});
