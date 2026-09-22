// The visual page builder app: Puck drag-and-drop + the AI co-editor.
// Staff pick or create a page, drag brand blocks around, edit text inline in
// the side panel, or type a request into the AI bar — the AI rewrites the same
// page document and the change appears in the editor for review. Publish saves.

import { useEffect, useRef, useState, useCallback } from "react";
import { Puck } from "@measured/puck";
import "@measured/puck/puck.css";
import { blocksConfig } from "./blocks";
import MenuEditor from "./MenuEditor";

type PageMeta = { slug: string; title: string; description: string; previewImage: string; status: "draft" | "live"; order: number; path: string; mounted: boolean };
type SitePageMeta = { path: string; title: string; previewImage: string; status: "draft" | "live" };
type PageFilter = "all" | "live" | "draft";
type NavItem = { label: string; href: string; blurb?: string };
type NavGroup = { label: string; href: string; items: NavItem[] };
type Nav = { groups: NavGroup[]; cta: { label: string; href: string } };

const EMPTY = (title: string) => ({
	status: "draft" as const,
	order: 0,
	root: { props: { title, kicker: "New Life" } },
	content: [],
	zones: {},
});

function slugify(s: string) {
	return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

const api = (path: string, opts?: RequestInit) =>
	fetch(path, { headers: { "content-type": "application/json" }, ...opts }).then((r) => r.json());

type Appearance = "auto" | "light" | "dark";

function systemAppearance(): "light" | "dark" {
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function StudioAppearance() {
	const [choice, setChoice] = useState<Appearance>(() => (localStorage.getItem("newlife-theme") as Appearance) || "auto");
	const [open, setOpen] = useState(false);

	const apply = (next: Appearance) => {
		localStorage.setItem("newlife-theme", next);
		document.documentElement.dataset.themeChoice = next;
		document.documentElement.dataset.theme = next === "auto" ? systemAppearance() : next;
		setChoice(next);
		setOpen(false);
	};

	useEffect(() => {
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => {
			if ((localStorage.getItem("newlife-theme") || "auto") === "auto") {
				document.documentElement.dataset.theme = systemAppearance();
			}
		};
		media.addEventListener("change", onChange);
		return () => media.removeEventListener("change", onChange);
	}, []);

	return (
		<div className="builder-appearance">
			<button className="builder-appearance__trigger" type="button" aria-expanded={open} aria-haspopup="true" aria-label="Choose appearance" onClick={() => setOpen((value) => !value)}>
				◐ <span>{choice[0].toUpperCase() + choice.slice(1)}</span>
			</button>
			{open && (
				<div className="builder-appearance__menu" role="menu">
					{(["auto", "light", "dark"] as Appearance[]).map((option) => (
						<button key={option} type="button" role="menuitemradio" aria-checked={choice === option} onClick={() => apply(option)}>
							{option[0].toUpperCase() + option.slice(1)}
							<span>{option === "auto" ? "Follows your device" : option === "light" ? "Warm and open" : "Evening atmosphere"}</span>
						</button>
					))}
				</div>
			)}
		</div>
	);
}

export default function BuilderApp() {
	const [pages, setPages] = useState<PageMeta[]>([]);
	const [sitePages, setSitePages] = useState<SitePageMeta[]>([]);
	const [sitePagesVersion, setSitePagesVersion] = useState("seed");
	const [nav, setNav] = useState<Nav | null>(null);
	const [menuMode, setMenuMode] = useState(false);
	const [query, setQuery] = useState("");
	const [filter, setFilter] = useState<PageFilter>("all");
	const [slug, setSlug] = useState<string | null>(null);
	const [data, setData] = useState<any>(null);
	const [versions, setVersions] = useState<Record<string, string>>({});
	const [rev, setRev] = useState(0); // bump to remount Puck after AI edits
	const [aiBusy, setAiBusy] = useState(false);
	const [aiNote, setAiNote] = useState<string>("");
	const [toast, setToast] = useState<string>("");
	const [dirty, setDirty] = useState(false); // true once the open page has edits not yet saved to its draft
	const [pendingPublish, setPendingPublish] = useState(false); // true once the draft has changes not yet published
	const live = useRef<any>(null); // latest editor data (from onChange)
	const visiblePages = pages.filter((page) => {
		const needle = query.trim().toLowerCase();
		const matchesQuery = !needle || `${page.title} ${page.path} ${page.description}`.toLowerCase().includes(needle);
		return matchesQuery && (filter === "all" || page.status === filter);
	});
	const visibleSitePages = sitePages.filter((page) => {
		const needle = query.trim().toLowerCase();
		const hasBuilder = pages.some((builderPage) => builderPage.path === page.path);
		return !hasBuilder && (filter === "all" || page.status === filter) && (!needle || `${page.title} ${page.path}`.toLowerCase().includes(needle));
	});
	const navGroups = nav?.groups || [];
	const headerPathOwners = new Map<string, number>();
	navGroups.forEach((group, groupIndex) => {
		[group.href, ...group.items.map((item) => item.href)].forEach((path) => {
			if (!headerPathOwners.has(path)) headerPathOwners.set(path, groupIndex);
		});
	});
	const groupedDirectory = navGroups.map((group, groupIndex) => {
		return {
			...group,
			pages: visiblePages.filter((page) => headerPathOwners.get(page.path) === groupIndex),
			sitePages: visibleSitePages.filter((page) => headerPathOwners.get(page.path) === groupIndex),
		};
	});
	const headerPaths = new Set(headerPathOwners.keys());
	const ungroupedPages = visiblePages.filter((page) => !headerPaths.has(page.path));
	const ungroupedSitePages = visibleSitePages.filter((page) => !headerPaths.has(page.path));
	const directoryGroups = groupedDirectory.filter((group) => (!query.trim() && filter === "all") || group.pages.length + group.sitePages.length > 0);

	const say = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2200); };
	const copyLink = async (path: string) => {
		try {
			await navigator.clipboard.writeText(new URL(path, window.location.origin).href);
			say("Link copied ✓");
		} catch {
			say("Couldn't copy the link");
		}
	};

	const refresh = useCallback(async () => {
		const [res, navRes] = await Promise.all([api("/api/studio/pages"), api("/api/studio/nav")]);
		setPages(res.pages || []);
		setVersions(Object.fromEntries((res.pages || []).map((page: any) => [page.slug, page.version])));
		setSitePages(res.sitePages || []);
		setSitePagesVersion(res.sitePagesVersion || "seed");
		setNav(navRes.nav || null);
	}, []);
	useEffect(() => { refresh(); }, [refresh]);

	async function openPage(s: string) {
		const res = await api(`/api/studio/pages?slug=${encodeURIComponent(s)}`).catch(() => null);
		if (res?.data) {
			setSlug(s); setData(res.data); setVersions((v) => ({ ...v, [s]: res.version })); live.current = res.data; setRev((r) => r + 1); setAiNote("");
			setDirty(false);
			// A page can arrive with a draft already ahead of what's published
			// (someone saved last session and never published) — reflect that
			// honestly instead of always starting the pill as if there's nothing
			// pending.
			setPendingPublish(Boolean(res.dirty));
			requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
		}
		else say(res?.error === "Unauthorized" ? "Your session expired — reload the page and sign in again." : (res?.error || "Couldn't load that page — reload and try again."));
	}

	function newPage() {
		const title = window.prompt("Name the new page (e.g. Fall Retreat):");
		if (!title) return;
		const s = slugify(title);
		if (!s) return;
		setSlug(s); setVersions((v) => ({ ...v, [s]: "seed" })); const d = EMPTY(title); setData(d); live.current = d; setRev((r) => r + 1); setAiNote("");
		setDirty(false);
		setPendingPublish(false);
		requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
	}

	// Saves to the page's DRAFT only — never what visitors see. Publish (below)
	// is the one action that pushes a draft live.
	async function save(d: any) {
		if (!slug) return;
		const res = await api("/api/studio/pages", { method: "POST", body: JSON.stringify({ slug, data: d, version: versions[slug], create: !pages.some((p) => p.slug === slug) }) });
		if (res.ok) {
			if (res.data) { setData(res.data); live.current = res.data; }
			setVersions((v) => ({ ...v, [slug]: res.version })); say("Saved ✓");
			setDirty(false);
			setPendingPublish(true);
			refresh();
		} else { say(res.error || "Couldn't save"); }
	}

	/** Push the current draft live. Used both for a page's first Publish and for pushing out edits to an already-live page. */
	async function publishPage(s: string) {
		const res = await api("/api/studio/pages", { method: "POST", body: JSON.stringify({ slug: s, publish: true }) });
		if (res.ok) {
			say(res.via === "git" ? "Publishing in a minute or two" : "Published ✓");
			if (slug === s && res.data) { setData(res.data); live.current = res.data; }
			if (slug === s) setPendingPublish(false);
			refresh();
		} else { say(res.error || "Couldn't publish"); }
	}

	/** Hide an already-live page. Content (draft and published) is untouched — this only flips visibility. */
	async function unpublishPage(s: string) {
		const res = await api("/api/studio/pages", { method: "POST", body: JSON.stringify({ slug: s, status: "draft" }) });
		if (res.ok) {
			say("Back to draft");
			if (slug === s && res.data) { setData(res.data); live.current = res.data; }
			refresh();
		} else { say(res.error || "Couldn't update"); }
	}

	/** The status pill's single action: publish when there's anything to publish, otherwise unpublish. */
	function togglePublish(s: string, status: "draft" | "live", hasPendingPublish = false) {
		return status === "live" && !hasPendingPublish ? unpublishPage(s) : publishPage(s);
	}

	async function setSiteStatus(path: string, status: "draft" | "live") {
		const res = await api("/api/studio/pages", { method: "POST", body: JSON.stringify({ sitePath: path, status, sitePagesVersion }) });
		if (res.ok) {
			setSitePagesVersion(res.version);
			setSitePages((current) => current.map((page) => page.path === path ? { ...page, status } : page));
			say(status === "live" ? "Published ✓" : "Saved as draft");
		} else {
			say(res.error || "Couldn't update");
			refresh();
		}
	}

	async function removePage(s: string, title: string) {
		if (!window.confirm(`Delete "${title}"? This removes the page completely.`)) return;
		const res = await api("/api/studio/pages", { method: "POST", body: JSON.stringify({ slug: s, delete: true, version: versions[s] }) });
		if (res.ok) { say("Deleted"); if (slug === s) { setSlug(null); setData(null); } refresh(); }
		else { say(res.error || "Couldn't delete"); }
	}

	async function askAI(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const input = (e.currentTarget.elements.namedItem("ai") as HTMLInputElement);
		const message = input.value.trim();
		if (!message || aiBusy) return;
		setAiBusy(true); setAiNote("Working on it — usually 15–30 seconds…");
		try {
			const res = await api("/api/studio/page-ai", {
				method: "POST",
				body: JSON.stringify({ message, data: live.current ?? data, title: slug }),
			});
			if (res.data) {
				setData(res.data); live.current = res.data; setRev((r) => r + 1); setDirty(true);
				setAiNote(res.reply || "Done — review the change, then Publish.");
				input.value = "";
			} else {
				setAiNote(res.reply || res.error || "That didn't work — try rewording.");
			}
		} catch {
			setAiNote("Couldn't reach the AI on this machine.");
		} finally { setAiBusy(false); }
	}

	// ---- menu editor screen ----
	if (menuMode) {
		return (
			<div className="builder-app" style={{ ...S.shell, alignItems: "stretch", justifyContent: "stretch", paddingTop: 0, display: "block" }}>
				<div style={{ position: "fixed", top: 12, right: 16, zIndex: 30 }}><StudioAppearance /></div>
				<MenuEditor
					paths={[...pages.map((p) => ({ path: p.path, title: p.title })), ...sitePages]}
					onBack={() => setMenuMode(false)}
					say={say}
					onSaved={refresh}
				/>
				{toast && <div style={S.toast}>{toast}</div>}
			</div>
		);
	}

	// ---- page picker screen ----
	if (!slug || !data) {
		return (
			<div className="builder-app builder-directory">
				<header className="builder-directory__header">
					<div><p className="builder-directory__eyebrow">✦ Studio</p><h1>Site pages</h1><p>Choose a page, then edit its sections in the builder.</p></div>
					<div className="builder-directory__header-actions">
						<button className="builder-button builder-button--primary" onClick={newPage}>+ New page</button>
						<StudioAppearance />
					</div>
				</header>

				<main className="builder-directory__main">
					<section className="builder-header-map" aria-labelledby="builder-header-map-title">
						<div><p className="builder-header-map__eyebrow">Top-level organization</p><h2 id="builder-header-map-title">Site header</h2><p>This is the structure visitors use to find everything.</p></div>
						<div className="builder-header-map__groups">
							{navGroups.map((group) => <span key={`${group.label}-${group.href}`}><strong>{group.label}</strong><small>{1 + group.items.length} {group.items.length === 0 ? "page" : "pages"}</small></span>)}
						</div>
						<button className="builder-button builder-button--secondary" type="button" onClick={() => setMenuMode(true)}>Organize header →</button>
					</section>
					<div className="builder-directory__tools">
						<label className="builder-search"><span className="sr-only">Search pages</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages…" /></label>
						<div className="builder-filters" aria-label="Filter pages">
							{(["all", "live", "draft"] as PageFilter[]).map((option) => <button key={option} type="button" aria-pressed={filter === option} onClick={() => setFilter(option)}>{option === "all" ? "All" : option === "live" ? "Published" : "Drafts"}</button>)}
						</div>
					</div>

					<div className="builder-directory__section-heading"><div><h2>Pages by header section</h2><p>The same organization visitors see on the site.</p></div><span>{visiblePages.length + visibleSitePages.length} {visiblePages.length + visibleSitePages.length === 1 ? "page" : "pages"}</span></div>
					<div className="builder-page-groups">
						{[...directoryGroups, ...(ungroupedPages.length || ungroupedSitePages.length ? [{ label: "Not in the header", href: "", items: [], pages: ungroupedPages, sitePages: ungroupedSitePages }] : [])].map((group) => (
							<section className="builder-page-group" key={`${group.label}-${group.href}`}>
								<header><h3>{group.label}</h3><span>{group.pages.length + group.sitePages.length}</span></header>
								<div className="builder-page-list">
								{group.pages.map((p) => <article key={p.slug} className="builder-page-row">
								<div className={`builder-page-row__preview${p.previewImage ? "" : " builder-page-row__preview--empty"}`}>
									{p.previewImage ? <img src={p.previewImage} alt="" loading="lazy" /> : <span aria-hidden="true">{p.title.slice(0, 1)}</span>}
									<button type="button" aria-label={`Edit ${p.title}`} onClick={() => openPage(p.slug)} />
								</div>
								<button className="builder-page-row__open" type="button" onClick={() => openPage(p.slug)}>
									<strong>{p.title}</strong><small>{p.path}</small><span>{p.description || "Open this page to see its sections."}</span>
								</button>
								<div className="builder-page-row__controls">
									<button className="builder-page-row__copy" type="button" onClick={() => copyLink(p.path)} aria-label={`Copy link for ${p.title}`}>Copy link</button>
									<button className={`builder-page-row__status builder-page-row__status--${p.status}`} type="button" onClick={() => togglePublish(p.slug, p.status)} aria-label={`${p.title} is ${p.status === "live" ? "published" : "draft"}. Click to ${p.status === "live" ? "unpublish" : "publish"}.`}>
										<span>{p.status === "live" ? "Published" : "Draft"}</span><small>{p.status === "live" ? "Click to unpublish" : "Click to publish"}</small>
									</button>
									<button className="builder-page-row__edit" type="button" onClick={() => openPage(p.slug)} aria-label={`Edit ${p.title}`}>Edit</button>
									{!p.mounted && <details className="builder-page-row__actions"><summary aria-label={`More actions for ${p.title}`}>•••</summary><div><button className="builder-danger" onClick={() => removePage(p.slug, p.title)}>Delete page</button></div></details>}
								</div>
							</article>)}
								{group.sitePages.map((p) => <article key={p.path} className="builder-page-row">
									<a className="builder-page-row__preview" href={p.path} target="_blank" rel="noreferrer" aria-label={`View ${p.title}`}><img src={p.previewImage} alt="" loading="lazy" /></a>
									<a className="builder-page-row__open" href={p.path} target="_blank" rel="noreferrer"><strong>{p.title}</strong><small>{p.path}</small><span>Open the page to edit its words and images.</span></a>
									<div className="builder-page-row__controls">
										<button className="builder-page-row__copy" type="button" onClick={() => copyLink(p.path)} aria-label={`Copy link for ${p.title}`}>Copy link</button>
										<button className={`builder-page-row__status builder-page-row__status--${p.status}`} type="button" onClick={() => setSiteStatus(p.path, p.status === "live" ? "draft" : "live")} aria-label={`${p.title} is ${p.status === "live" ? "published" : "draft"}. Click to ${p.status === "live" ? "unpublish" : "publish"}.`}>
											<span>{p.status === "live" ? "Published" : "Draft"}</span><small>{p.status === "live" ? "Click to unpublish" : "Click to publish"}</small>
										</button>
									</div>
								</article>)}
								{group.pages.length + group.sitePages.length === 0 && <p className="builder-page-group__empty">No pages under this header.</p>}
								</div>
							</section>
						))}
						{pages.length + sitePages.length === 0 && <div className="builder-empty"><strong>No pages yet</strong><p>Create the first page to begin.</p><button className="builder-button builder-button--primary" onClick={newPage}>+ New page</button></div>}
						{pages.length + sitePages.length > 0 && visiblePages.length + visibleSitePages.length === 0 && <div className="builder-empty"><strong>No matching pages</strong><p>Try another search or filter.</p></div>}
					</div>
					<a className="builder-directory__back" href="/">← Back to the site</a>
				</main>
			</div>
		);
	}

	// ---- editor screen ----
	return (
		<div className="builder-app" style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
			<div className="builder-editor-bar">
				<button className="builder-button builder-button--secondary" onClick={() => { setSlug(null); setData(null); refresh(); }}>‹ Site pages</button>
				<span className="builder-editor-bar__title"><small>Editing</small><strong>{data?.root?.props?.title || slug}</strong></span>
				<a className="builder-button builder-button--secondary" href={pages.find((x) => x.slug === slug)?.path || `/p/${slug}`} target="_blank" rel="noreferrer">View ↗</a>
				<StudioAppearance />
				<form onSubmit={askAI} style={{ display: "flex", gap: 8, flex: 1, minWidth: 260 }}>
					<input name="ai" placeholder='Ask AI — e.g. "build this out for a fall retreat with 3 cards and a signup button"' style={S.aiInput} disabled={aiBusy} />
					<button style={{ ...S.btn, opacity: aiBusy ? 0.5 : 1 }} disabled={aiBusy}>{aiBusy ? "…" : "✦ Ask AI"}</button>
				</form>
			</div>
			{aiNote && <div style={S.note}>{aiNote}</div>}
			<div style={{ flex: 1, minHeight: 0 }}>
				<Puck
					key={rev}
					config={blocksConfig}
					data={data}
					onChange={(d: any) => { live.current = d; setDirty(true); }}
					onPublish={save}
					overrides={{
						// Puck's own built-in button always says "Publish" — but it's
						// wired to `save`, which only writes the DRAFT and never
						// touches what visitors see. The real draft/live control lives
						// right next to it: DRAFT → publish it for the first time;
						// PUBLISHED with a saved-but-unpublished edit → push that edit
						// live (status stays live); PUBLISHED with nothing pending →
						// unpublish. Save itself only ever reflects the draft.
						headerActions: () => (
							<>
								<button
									type="button"
									className={`builder-pub-btn builder-status builder-status--${data?.status === "live" ? (pendingPublish ? "pending" : "live") : "draft"}`}
									title={data?.status !== "live" ? "Click to publish" : pendingPublish ? "Click to publish your changes" : "Click to unpublish"}
									onClick={() => togglePublish(slug, data?.status, pendingPublish)}
								>
									{data?.status !== "live"
										? "Draft · Click to publish"
										: pendingPublish
											? "Published · Click to publish"
											: "Published · Click to unpublish"}
								</button>
								<button type="button" className="builder-pub-btn builder-save-btn" onClick={() => save(live.current)} disabled={!dirty}>
									<span aria-hidden="true">✓</span> {dirty ? "Save" : "Saved"}
								</button>
							</>
						),
					}}
				/>
			</div>
			{toast && <div style={S.toast}>{toast}</div>}
		</div>
	);
}

const S: Record<string, React.CSSProperties> = {
	shell: { minHeight: "100vh", background: "var(--studio-bg)", color: "var(--studio-text)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "12vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
	btn: { font: "inherit", fontWeight: 600, border: 0, borderRadius: 10, padding: "10px 16px", background: "linear-gradient(135deg,#ffe7bf,var(--studio-accent))", color: "var(--studio-accent-ink)", cursor: "pointer" },
	aiInput: { flex: 1, font: "inherit", fontSize: 14, padding: "9px 12px", borderRadius: 10, border: "1px solid var(--studio-line)", background: "var(--studio-panel-raised)", color: "var(--studio-text)" },
	note: { padding: "8px 14px", fontSize: 13, background: "color-mix(in srgb, var(--studio-accent) 10%, transparent)", color: "var(--studio-accent)", borderBottom: "1px solid var(--studio-line)", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
	toast: { position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", background: "linear-gradient(135deg,#ffe7bf,var(--studio-accent))", color: "var(--studio-accent-ink)", fontWeight: 600, padding: "10px 16px", borderRadius: 999, zIndex: 1000 },
};
