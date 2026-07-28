// The visual page builder app: Puck drag-and-drop + the AI co-editor.
// Staff pick or create a page, drag brand blocks around, edit text inline in
// the side panel, or type a request into the AI bar — the AI rewrites the same
// page document and the change appears in the editor for review. Publish saves.

import { useEffect, useRef, useState, useCallback } from "react";
import { Puck } from "@measured/puck";
import "@measured/puck/puck.css";
import { blocksConfig } from "./blocks";
import MenuEditor from "./MenuEditor";

type PageMeta = { slug: string; title: string; status: "draft" | "live"; order: number; path: string; mounted: boolean };

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

export default function BuilderApp() {
	const [pages, setPages] = useState<PageMeta[]>([]);
	const [sitePages, setSitePages] = useState<Array<{ path: string; title: string }>>([]);
	const [menuMode, setMenuMode] = useState(false);
	const [slug, setSlug] = useState<string | null>(null);
	const [data, setData] = useState<any>(null);
	const [rev, setRev] = useState(0); // bump to remount Puck after AI edits
	const [aiBusy, setAiBusy] = useState(false);
	const [aiNote, setAiNote] = useState<string>("");
	const [toast, setToast] = useState<string>("");
	const live = useRef<any>(null); // latest editor data (from onChange)

	const say = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2200); };

	const refresh = useCallback(async () => {
		const res = await api("/api/studio/pages");
		setPages(res.pages || []);
		setSitePages(res.sitePages || []);
	}, []);
	useEffect(() => { refresh(); }, [refresh]);

	async function openPage(s: string) {
		const res = await api(`/api/studio/pages?slug=${encodeURIComponent(s)}`);
		if (res.data) { setSlug(s); setData(res.data); live.current = res.data; setRev((r) => r + 1); setAiNote(""); }
	}

	function newPage() {
		const title = window.prompt("Name the new page (e.g. Fall Retreat):");
		if (!title) return;
		const s = slugify(title);
		if (!s) return;
		setSlug(s); const d = EMPTY(title); setData(d); live.current = d; setRev((r) => r + 1); setAiNote("");
	}

	async function save(d: any) {
		if (!slug) return;
		const res = await api("/api/studio/pages", { method: "POST", body: JSON.stringify({ slug, data: d }) });
		if (res.ok) {
			if (res.data) { setData(res.data); live.current = res.data; }
			say(res.via === "git" ? "Saved — going live in a minute or two" : "Saved ✓");
			refresh();
		} else { say(res.error || "Couldn't save"); }
	}

	async function setStatus(s: string, status: "draft" | "live") {
		const res = await api("/api/studio/pages", { method: "POST", body: JSON.stringify({ slug: s, status }) });
		if (res.ok) {
			say(status === "live"
				? (res.via === "git" ? "Going live in a minute or two" : "Live ✓")
				: "Back to draft");
			if (slug === s && res.data) { setData(res.data); live.current = res.data; }
			refresh();
		} else { say(res.error || "Couldn't update"); }
	}

	async function removePage(s: string, title: string) {
		if (!window.confirm(`Delete "${title}"? This removes the page completely.`)) return;
		const res = await api("/api/studio/pages", { method: "POST", body: JSON.stringify({ slug: s, delete: true }) });
		if (res.ok) { say("Deleted"); if (slug === s) { setSlug(null); setData(null); } refresh(); }
		else { say(res.error || "Couldn't delete"); }
	}

	// Drag-to-reorder the page list (native HTML5 drag on the rows).
	const dragFrom = useRef<number | null>(null);
	async function reorder(from: number, to: number) {
		if (from === to) return;
		const next = [...pages];
		const [moved] = next.splice(from, 1);
		next.splice(to, 0, moved);
		setPages(next);
		await Promise.all(next.map((p, i) =>
			api("/api/studio/pages", { method: "POST", body: JSON.stringify({ slug: p.slug, order: i }) }),
		));
		refresh();
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
				setData(res.data); live.current = res.data; setRev((r) => r + 1);
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
			<div style={{ ...S.shell, alignItems: "stretch", justifyContent: "stretch", paddingTop: 0, display: "block" }}>
				<MenuEditor
					paths={[...pages.map((p) => ({ path: p.path, title: p.title })), ...sitePages]}
					onBack={() => setMenuMode(false)}
					say={say}
				/>
				{toast && <div style={S.toast}>{toast}</div>}
			</div>
		);
	}

	// ---- page picker screen ----
	if (!slug || !data) {
		return (
			<div style={S.shell}>
				<div style={S.picker}>
					<h1 style={{ margin: 0, fontSize: 22 }}>✦ Page Builder</h1>
					<p style={{ color: "#9aa3b2", fontSize: 14, margin: "6px 0 20px" }}>
						Build pages by dragging blocks and talking to the AI. Pages publish at <code>/p/…</code> on the site.
					</p>
					<div style={{ display: "flex", gap: 8 }}>
						<button style={S.btn} onClick={newPage}>+ New page</button>
						<button style={{ ...S.btn, background: "transparent", color: "#f2d2a2", border: "1px solid rgba(242,210,162,.4)" }} onClick={() => setMenuMode(true)}>☰ Edit site menu</button>
					</div>
					<p style={{ color: "#9aa3b2", fontSize: 12, margin: "14px 0 6px" }}>Drag to reorder · new pages start as drafts only staff can see.</p>
					<div style={{ display: "grid", gap: 8 }}>
						{pages.map((p, i) => (
							<div
								key={p.slug}
								draggable
								onDragStart={() => { dragFrom.current = i; }}
								onDragOver={(e) => e.preventDefault()}
								onDrop={() => { if (dragFrom.current != null) reorder(dragFrom.current, i); dragFrom.current = null; }}
								style={{ ...S.row, cursor: "grab", alignItems: "center" }}
							>
								<span style={{ color: "#4a5262", fontSize: 15, userSelect: "none" }}>⠿</span>
								<button onClick={() => openPage(p.slug)} style={{ font: "inherit", flex: 1, textAlign: "left", background: "none", border: 0, color: "#eef1f6", cursor: "pointer", padding: 0, display: "grid", gap: 2 }}>
									<strong>{p.title}</strong>
									<span style={{ color: "#9aa3b2", fontSize: 12 }}>{p.path}</span>
								</button>
								<span style={p.status === "live" ? S.badgeLive : S.badgeDraft}>{p.status === "live" ? "LIVE" : "DRAFT"}</span>
								<button style={S.small} onClick={() => setStatus(p.slug, p.status === "live" ? "draft" : "live")}>
									{p.status === "live" ? "Unpublish" : "Go live"}
								</button>
								{!p.mounted && (
									<button style={{ ...S.small, color: "#eec7b7" }} title="Delete page" onClick={() => removePage(p.slug, p.title)}>✕</button>
								)}
							</div>
						))}
						{pages.length === 0 && <p style={{ color: "#9aa3b2", fontSize: 13 }}>No pages yet — make the first one.</p>}
					</div>

					<h2 style={{ fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", color: "#9aa3b2", margin: "26px 0 6px" }}>The rest of the site</h2>
					<p style={{ color: "#9aa3b2", fontSize: 12, margin: "0 0 10px" }}>
						Hand-built pages. To change their words, open one and use the ✦ chat in the corner.
					</p>
					<div style={{ display: "grid", gap: 6 }}>
						{sitePages.map((p) => (
							<a key={p.path} href={p.path} target="_blank" rel="noreferrer" style={{ ...S.row, textDecoration: "none", padding: "9px 14px", alignItems: "center" }}>
								<span style={{ flex: 1, display: "grid", gap: 1 }}>
									<strong style={{ fontSize: 14 }}>{p.title}</strong>
									<span style={{ color: "#9aa3b2", fontSize: 12 }}>{p.path}</span>
								</span>
								<span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", padding: "4px 8px", borderRadius: 999, background: "#2a3040", color: "#c9b48f" }}>HAND-BUILT</span>
								<span style={{ color: "#9aa3b2" }}>↗</span>
							</a>
						))}
					</div>
					<p style={{ marginTop: 24 }}><a href="/" style={{ color: "#9aa3b2" }}>← Back to the site</a></p>
				</div>
			</div>
		);
	}

	// ---- editor screen ----
	return (
		<div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
			<div style={S.bar}>
				<button style={S.small} onClick={() => { setSlug(null); setData(null); refresh(); }}>‹ Pages</button>
				<strong style={{ fontSize: 14 }}>{data?.root?.props?.title || slug}</strong>
				<button
					style={data?.status === "live" ? { ...S.small, ...S.badgeLive, border: 0 } : { ...S.small, ...S.badgeDraft, border: 0 }}
					title="Click to flip between draft and live"
					onClick={() => setStatus(slug, data?.status === "live" ? "draft" : "live")}
				>
					{data?.status === "live" ? "LIVE" : "DRAFT"}
				</button>
				<a style={{ ...S.small, textDecoration: "none" }} href={pages.find((x) => x.slug === slug)?.path || `/p/${slug}`} target="_blank" rel="noreferrer">View ↗</a>
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
					onChange={(d: any) => { live.current = d; }}
					onPublish={save}
				/>
			</div>
			{toast && <div style={S.toast}>{toast}</div>}
		</div>
	);
}

const S: Record<string, React.CSSProperties> = {
	shell: { minHeight: "100vh", background: "#0d0f14", color: "#eef1f6", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "12vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
	picker: { width: "min(460px, 92vw)", background: "#151922", border: "1px solid #2a3040", borderRadius: 16, padding: 24 },
	btn: { font: "inherit", fontWeight: 600, border: 0, borderRadius: 10, padding: "10px 16px", background: "linear-gradient(135deg,#ffe7bf,#f2d2a2)", color: "#12100c", cursor: "pointer" },
	row: { font: "inherit", textAlign: "left" as const, display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 14px", borderRadius: 10, border: "1px solid #2a3040", background: "#1c2130", color: "#eef1f6", cursor: "pointer" },
	bar: { display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#0d0f14", color: "#eef1f6", borderBottom: "1px solid #2a3040", flexWrap: "wrap" as const, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
	small: { font: "inherit", fontSize: 13, background: "transparent", color: "#9aa3b2", border: "1px solid #2a3040", borderRadius: 8, padding: "6px 10px", cursor: "pointer" },
	aiInput: { flex: 1, font: "inherit", fontSize: 14, padding: "9px 12px", borderRadius: 10, border: "1px solid #2a3040", background: "#1c2130", color: "#eef1f6" },
	note: { padding: "8px 14px", fontSize: 13, background: "rgba(242,210,162,.08)", color: "#f2d2a2", borderBottom: "1px solid #2a3040", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
	toast: { position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", background: "linear-gradient(135deg,#ffe7bf,#f2d2a2)", color: "#12100c", fontWeight: 600, padding: "10px 16px", borderRadius: 999, zIndex: 1000 },
	badgeLive: { fontSize: 10, fontWeight: 700, letterSpacing: ".08em", padding: "4px 8px", borderRadius: 999, background: "#5cd6a8", color: "#08130d", cursor: "pointer" },
	badgeDraft: { fontSize: 10, fontWeight: 700, letterSpacing: ".08em", padding: "4px 8px", borderRadius: 999, background: "#2a3040", color: "#9aa3b2", cursor: "pointer" },
};
