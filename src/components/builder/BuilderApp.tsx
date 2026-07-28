// The visual page builder app: Puck drag-and-drop + the AI co-editor.
// Staff pick or create a page, drag brand blocks around, edit text inline in
// the side panel, or type a request into the AI bar — the AI rewrites the same
// page document and the change appears in the editor for review. Publish saves.

import { useEffect, useRef, useState, useCallback } from "react";
import { Puck } from "@measured/puck";
import "@measured/puck/puck.css";
import { blocksConfig } from "./blocks";

type PageMeta = { slug: string; title: string };

const EMPTY = (title: string) => ({
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
		if (res.ok) { say("Published ✓"); refresh(); } else { say(res.error || "Couldn't save"); }
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

	// ---- page picker screen ----
	if (!slug || !data) {
		return (
			<div style={S.shell}>
				<div style={S.picker}>
					<h1 style={{ margin: 0, fontSize: 22 }}>✦ Page Builder</h1>
					<p style={{ color: "#9aa3b2", fontSize: 14, margin: "6px 0 20px" }}>
						Build pages by dragging blocks and talking to the AI. Pages publish at <code>/p/…</code> on the site.
					</p>
					<button style={S.btn} onClick={newPage}>+ New page</button>
					<div style={{ marginTop: 18, display: "grid", gap: 8 }}>
						{pages.map((p) => (
							<button key={p.slug} style={S.row} onClick={() => openPage(p.slug)}>
								<strong>{p.title}</strong>
								<span style={{ color: "#9aa3b2" }}>/p/{p.slug}</span>
							</button>
						))}
						{pages.length === 0 && <p style={{ color: "#9aa3b2", fontSize: 13 }}>No pages yet — make the first one.</p>}
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
				<button style={S.small} onClick={() => { setSlug(null); setData(null); }}>‹ Pages</button>
				<strong style={{ fontSize: 14 }}>{data?.root?.props?.title || slug}</strong>
				<a style={{ ...S.small, textDecoration: "none" }} href={`/p/${slug}`} target="_blank" rel="noreferrer">View ↗</a>
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
};
