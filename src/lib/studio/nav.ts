// The site's navigation as CONTENT (content/nav.json), so staff can edit the
// menus in the builder. The header renders from this; changes persist like
// pages do (fs locally, GitHub commit + rebuild in production). sanitizeNav()
// is the fence: labels and links only, capped counts and lengths — nothing
// executable can enter the header.

import seed from "../../../content/nav.json";
import { publish, readPublished, type RuntimeLocals } from "./runtime-content";

const KEY = "studio/nav/published.json";

export type NavItem = { label: string; href: string; blurb?: string };
export type NavGroup = { label: string; href: string; items: NavItem[] };
export type Nav = { groups: NavGroup[]; cta: { label: string; href: string } };

function cleanHref(href: unknown): string {
	const s = String(href || "").trim();
	return /^(\/|https?:\/\/|#)/.test(s) ? s.slice(0, 300) : "/";
}
function cleanLabel(s: unknown, max = 40): string {
	return String(s || "").trim().slice(0, max);
}

export function sanitizeNav(input: any): Nav {
	const groups = (Array.isArray(input?.groups) ? input.groups : [])
		.slice(0, 8)
		.map((g: any) => ({
			label: cleanLabel(g?.label) || "Menu",
			href: cleanHref(g?.href),
			items: (Array.isArray(g?.items) ? g.items : [])
				.slice(0, 12)
				.map((it: any) => ({
					label: cleanLabel(it?.label) || "Link",
					href: cleanHref(it?.href),
					blurb: cleanLabel(it?.blurb, 140),
				})),
		}));
	return {
		groups,
		cta: {
			label: cleanLabel(input?.cta?.label) || "Plan a Visit",
			href: cleanHref(input?.cta?.href || "/visit"),
		},
	};
}

export async function readNav(locals?: RuntimeLocals): Promise<Nav> {
	return (await readNavState(locals)).nav;
}

export async function readNavState(locals?: RuntimeLocals): Promise<{ nav: Nav; version: string }> {
	const stored = await readPublished(KEY, seed, locals);
	return { nav: sanitizeNav(stored.value), version: stored.version };
}

export async function writeNav(input: any, expectedVersion?: string, locals?: RuntimeLocals): Promise<{ nav: Nav; via: "runtime"; version: string }> {
	const nav = sanitizeNav(input);
	const current = await readPublished(KEY, seed, locals);
	const saved = await publish(KEY, nav, seed, expectedVersion ?? current.version, locals);
	return { nav, via: "runtime", version: saved.version };
}
