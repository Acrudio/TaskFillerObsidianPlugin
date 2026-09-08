const BASE36 = "0123456789abcdefghijklmnopqrstuvwxyz";

/**
 * Build an identifier in the shape Project Manager uses: eight random base36
 * characters followed by the creation time as base36. Sharing `now` with the
 * note's `createdAt` keeps the two consistent, the way existing task files are.
 */
export function generateId(now: number = Date.now(), random: () => number = Math.random): string {
	let prefix = "";
	for (let i = 0; i < 8; i++) {
		prefix += BASE36[Math.floor(random() * 36) % 36];
	}
	return prefix + now.toString(36);
}
