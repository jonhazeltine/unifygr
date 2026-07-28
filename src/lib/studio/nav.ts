// The site's navigation as CONTENT (content/nav.json), so staff can edit the
// menus in the builder. The header renders from this; changes persist like
// pages do (fs locally, GitHub commit + rebuild in production). sanitizeNav()
// is the fence: labels and links only, capped counts and lengths — nothing
// executable can enter the header.

import { promises as fs } from "node:fs";
import path from "node:path";
import { commitToMain } from "./github";

const ROOT = process.cwd();
const NAV_PATH = path.join(ROOT, "content", "nav.json");

// Build-time snapshot — the read fallback where there's no filesystem.
const BUNDLED: any = import.meta.glob("../../../content/nav.json", { eager: true });

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

export async function readNav(): Promise<Nav> {
	try {
		return sanitizeNav(JSON.parse(await fs.readFile(NAV_PATH, "utf8")));
	} catch {
		const mod: any = Object.values(BUNDLED)[0];
		return sanitizeNav(mod?.default ?? mod ?? {});
	}
}

export async function writeNav(input: any): Promise<{ nav: Nav; via: "fs" | "git" }> {
	const nav = sanitizeNav(input);
	const json = JSON.stringify(nav, null, "\t") + "\n";
	try {
		await fs.writeFile(NAV_PATH, json, "utf8");
		return { nav, via: "fs" };
	} catch {
		await commitToMain([{ path: "content/nav.json", content: json }], "content: studio edit navigation");
		return { nav, via: "git" };
	}
}
