// The Menu editor — staff edit the site's top navigation: add/remove links,
// drag to reorder, dropdown items under each, and the "Plan a Visit" button.
// Saves through the same pipeline as pages (instant locally, ~1–2 min live).

import { useEffect, useRef, useState } from "react";

type NavItem = { label: string; href: string; blurb?: string };
type NavGroup = { label: string; href: string; items: NavItem[]; _open?: boolean };
type Nav = { groups: NavGroup[]; cta: { label: string; href: string } };

const api = (path: string, opts?: RequestInit) =>
	fetch(path, { headers: { "content-type": "application/json" }, ...opts }).then((r) => r.json());

export default function MenuEditor({ paths, onBack, say }: {
	paths: Array<{ path: string; title: string }>;
	onBack: () => void;
	say: (m: string) => void;
}) {
	const [nav, setNav] = useState<Nav | null>(null);
	const [saving, setSaving] = useState(false);
	const dragFrom = useRef<number | null>(null);

	useEffect(() => {
		api("/api/studio/nav").then((r) => setNav(r.nav || null));
	}, []);

	if (!nav) return <div style={{ padding: 24, color: "#9aa3b2" }}>Loading the menu…</div>;

	const up = (fn: (n: Nav) => void) => setNav((prev) => { const n = structuredClone(prev!); fn(n); return n; });

	async function save() {
		setSaving(true);
		try {
			const res = await api("/api/studio/nav", { method: "POST", body: JSON.stringify({ nav }) });
			if (res.ok) { setNav(res.nav); say(res.via === "git" ? "Menu saved — live in a minute or two" : "Menu saved ✓"); }
			else say(res.error || "Couldn't save the menu");
		} finally { setSaving(false); }
	}

	return (
		<div style={{ maxWidth: 660, margin: "0 auto", padding: "20px 16px 60px" }}>
			<datalist id="me-paths">
				{paths.map((p) => <option value={p.path} key={p.path}>{p.title}</option>)}
			</datalist>

			<div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
				<button style={S.small} onClick={onBack}>‹ Pages</button>
				<h1 style={{ margin: 0, fontSize: 20 }}>☰ Site menu</h1>
				<div style={{ flex: 1 }} />
				<button style={{ ...S.btn, opacity: saving ? 0.5 : 1 }} disabled={saving} onClick={save}>
					{saving ? "Saving…" : "Save menu"}
				</button>
			</div>
			<p style={{ color: "#9aa3b2", fontSize: 13, margin: "0 0 18px" }}>
				Drag to reorder. A menu entry with dropdown links shows them on hover; one without is a plain link.
			</p>

			{nav.groups.map((g, i) => (
				<div
					key={i}
					draggable
					onDragStart={() => { dragFrom.current = i; }}
					onDragOver={(e) => e.preventDefault()}
					onDrop={() => {
						const from = dragFrom.current; dragFrom.current = null;
						if (from == null || from === i) return;
						up((n) => { const [m] = n.groups.splice(from, 1); n.groups.splice(i, 0, m); });
					}}
					style={S.group}
				>
					<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
						<span style={{ color: "#4a5262", cursor: "grab", userSelect: "none" }}>⠿</span>
						<input style={{ ...S.input, flex: 1 }} value={g.label} placeholder="Menu label"
							onChange={(e) => up((n) => { n.groups[i].label = e.target.value; })} />
						<input style={{ ...S.input, flex: 1.4 }} value={g.href} list="me-paths" placeholder="/link"
							onChange={(e) => up((n) => { n.groups[i].href = e.target.value; })} />
						<button style={S.small} onClick={() => up((n) => { (n.groups[i] as any)._open = !(n.groups[i] as any)._open; })}>
							{g.items.length} dropdown {g.items.length === 1 ? "link" : "links"} {(g as any)._open ? "▴" : "▾"}
						</button>
						<button style={{ ...S.small, color: "#eec7b7" }} title="Remove this menu entry"
							onClick={() => { if (window.confirm(`Remove "${g.label}" from the menu?`)) up((n) => { n.groups.splice(i, 1); }); }}>✕</button>
					</div>

					{(g as any)._open && (
						<div style={{ marginTop: 10, display: "grid", gap: 8, paddingLeft: 22 }}>
							{g.items.map((it, j) => (
								<div key={j} style={{ display: "grid", gap: 6, gridTemplateColumns: "1fr 1fr auto", alignItems: "start" }}>
									<input style={S.input} value={it.label} placeholder="Link label"
										onChange={(e) => up((n) => { n.groups[i].items[j].label = e.target.value; })} />
									<input style={S.input} value={it.href} list="me-paths" placeholder="/link"
										onChange={(e) => up((n) => { n.groups[i].items[j].href = e.target.value; })} />
									<button style={{ ...S.small, color: "#eec7b7" }} title="Remove link"
										onClick={() => up((n) => { n.groups[i].items.splice(j, 1); })}>✕</button>
									<input style={{ ...S.input, gridColumn: "1 / 3", fontSize: 12 }} value={it.blurb || ""} placeholder="One-line description shown under the link (optional)"
										onChange={(e) => up((n) => { n.groups[i].items[j].blurb = e.target.value; })} />
								</div>
							))}
							<button style={{ ...S.small, justifySelf: "start" }}
								onClick={() => up((n) => { n.groups[i].items.push({ label: "New link", href: "/", blurb: "" }); (n.groups[i] as any)._open = true; })}>
								+ Add dropdown link
							</button>
						</div>
					)}
				</div>
			))}

			<button style={{ ...S.small, marginTop: 4 }}
				onClick={() => up((n) => { n.groups.push({ label: "New entry", href: "/", items: [] }); })}>
				+ Add menu entry
			</button>

			<h2 style={{ fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", color: "#9aa3b2", margin: "26px 0 8px" }}>Highlighted button</h2>
			<div style={{ display: "flex", gap: 8 }}>
				<input style={{ ...S.input, flex: 1 }} value={nav.cta.label}
					onChange={(e) => up((n) => { n.cta.label = e.target.value; })} />
				<input style={{ ...S.input, flex: 1.4 }} value={nav.cta.href} list="me-paths"
					onChange={(e) => up((n) => { n.cta.href = e.target.value; })} />
			</div>
		</div>
	);
}

const S: Record<string, React.CSSProperties> = {
	group: { border: "1px solid #2a3040", background: "#151922", borderRadius: 12, padding: "10px 12px", marginBottom: 8 },
	input: { font: "inherit", fontSize: 14, padding: "8px 10px", borderRadius: 8, border: "1px solid #2a3040", background: "#1c2130", color: "#eef1f6" },
	small: { font: "inherit", fontSize: 13, background: "transparent", color: "#9aa3b2", border: "1px solid #2a3040", borderRadius: 8, padding: "6px 10px", cursor: "pointer" },
	btn: { font: "inherit", fontWeight: 600, border: 0, borderRadius: 10, padding: "9px 16px", background: "linear-gradient(135deg,#ffe7bf,#f2d2a2)", color: "#12100c", cursor: "pointer" },
};
