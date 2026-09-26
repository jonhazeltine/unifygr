// Turns two Page Builder documents (before/after an AI proposal) into a
// plain-English before/after list — reusing the same {path, from, to} shape
// the Studio dock already renders for fenced-field edits, so the dock needs
// no new UI to show a page-level change.

import type { PageData } from "./pages";
import type { Edit } from "./store";

const TEXT_KEYS = ["heading", "title", "text", "label", "kicker", "brand", "lede", "eyebrow", "name", "q"];

function truncate(text: string, max = 60): string {
	const trimmed = text.trim();
	return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function firstText(props: Record<string, unknown>): string {
	for (const key of TEXT_KEYS) {
		const value = (props as any)[key];
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	for (const value of Object.values(props)) {
		if (Array.isArray(value) && value.length) {
			const labels = value
				.map((item) => (item && typeof item === "object" ? item.title || item.label || item.name || item.q : undefined))
				.filter((label): label is string => typeof label === "string" && label.trim().length > 0);
			if (labels.length) return labels.slice(0, 3).join(", ");
		}
	}
	return "";
}

/** A short, human-readable summary of one block — used on both sides of a diff row. */
export function summarizeBlock(block: { type: string; props: Record<string, unknown> }): string {
	const text = firstText(block.props || {});
	return text ? `${block.type} — "${truncate(text)}"` : block.type;
}

function blockId(block: { props: Record<string, unknown> }, fallbackIndex: number): string {
	const id = (block.props as any)?.id;
	return typeof id === "string" && id ? id : `#${fallbackIndex}`;
}

/**
 * Compare two page documents block-by-block (matched by their stable `id`
 * prop) and describe what changed: added, removed, reordered, or edited
 * blocks, plus a page title/kicker change. Order in the returned list follows
 * the AFTER document's block order, so it reads top-to-bottom like the page.
 */
export function diffPageBlocks(before: PageData, after: PageData): Edit[] {
	const edits: Edit[] = [];

	if ((before.root?.props?.title || "") !== (after.root?.props?.title || "")) {
		edits.push({ path: "Page title", from: before.root?.props?.title || "", to: after.root?.props?.title || "" });
	}
	if ((before.root?.props?.kicker || "") !== (after.root?.props?.kicker || "")) {
		edits.push({ path: "Page kicker", from: before.root?.props?.kicker || "", to: after.root?.props?.kicker || "" });
	}

	const beforeContent = Array.isArray(before.content) ? before.content : [];
	const afterContent = Array.isArray(after.content) ? after.content : [];
	const beforeById = new Map(beforeContent.map((block, index) => [blockId(block, index), { block, index }]));
	const afterIds = new Set(afterContent.map((block, index) => blockId(block, index)));

	afterContent.forEach((block, index) => {
		const id = blockId(block, index);
		const prior = beforeById.get(id);
		if (!prior) {
			edits.push({ path: `Added block ${index + 1}`, from: "", to: summarizeBlock(block) });
			return;
		}
		const propsChanged = JSON.stringify(prior.block.props) !== JSON.stringify(block.props);
		if (propsChanged) {
			edits.push({ path: `${block.type} (block ${index + 1})`, from: summarizeBlock(prior.block), to: summarizeBlock(block) });
			return;
		}
		if (prior.index !== index) {
			edits.push({ path: `${block.type} moved`, from: `position ${prior.index + 1}`, to: `position ${index + 1}` });
		}
	});

	beforeContent.forEach((block, index) => {
		const id = blockId(block, index);
		if (!afterIds.has(id)) {
			edits.push({ path: `Removed block ${index + 1}`, from: summarizeBlock(block), to: "" });
		}
	});

	return edits;
}
