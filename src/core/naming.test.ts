import assert from "node:assert/strict";
import { test } from "node:test";
import { formatTitle, slugify } from "./naming";
import { generateId } from "./ids";

test("fills in the title template", () => {
	const title = formatTitle("{{title}} (Day {{day}}/{{total}})", {
		title: "🔨 Manufacturing HW 1",
		day: 2,
		total: 3,
		date: "2026-09-08",
	});
	assert.equal(title, "🔨 Manufacturing HW 1 (Day 2/3)");
});

test("supports the date placeholder and repeated placeholders", () => {
	assert.equal(
		formatTitle("{{title}} — {{date}} ({{day}} of {{total}})", {
			title: "Write",
			day: 1,
			total: 2,
			date: "2026-09-07",
		}),
		"Write — 2026-09-07 (1 of 2)"
	);
});

test("slugs match Project Manager's lowercase-hyphenated note names", () => {
	assert.equal(
		slugify("🔨 Work on Manufacturing HW (Day 1)"),
		"🔨-work-on-manufacturing-hw-(day-1)"
	);
});

test("slugs drop characters a filename cannot hold", () => {
	assert.equal(slugify("🔨 Manufacturing HW 1 (Day 1/3)"), "🔨-manufacturing-hw-1-(day-1-3)");
	assert.equal(slugify('a:b*c?d"e<f>g|h#i^j[k]'), "a-b-c-d-e-f-g-h-i-j-k");
	assert.equal(slugify("  ...  "), "untitled");
});

test("ids carry their creation time, as Project Manager's do", () => {
	const now = Date.parse("2026-09-06T16:28:31.670Z");
	const id = generateId(now, () => 0.5);
	assert.equal(id.length, 16);
	assert.equal(parseInt(id.slice(8), 36), now);
});
