// The block kit for the visual builder — every block renders with the site's
// own CSS classes (global.css), so anything staff assemble looks native to
// the site. This config drives BOTH the drag-and-drop editor (Puck) and the
// server-side render of published pages (/p/<slug>).
//
// Adding a block: add a component here AND add its name to ALLOWED_BLOCKS in
// src/lib/studio/pages.ts (the fence), then it's available everywhere.

import type { Config } from "@measured/puck";
import { usePuck } from "@measured/puck";
import { useEffect, useRef, useState } from "react";

// Split a textarea into paragraphs on blank lines.
function paras(text: string) {
	return String(text || "")
		.split(/\n\s*\n/)
		.map((p) => p.trim())
		.filter(Boolean);
}

function escapeHtml(text: string): string {
	return String(text || "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

/**
 * The small **bold** / *italic* markup the toolbar below writes, turned into
 * real <strong>/<em> tags. Everything is HTML-escaped FIRST — the only tags
 * that can ever come out the other end are the two these two patterns
 * produce, so this can't be used to inject arbitrary HTML through a text
 * field. **bold** is matched before *italic* so a bold run's own asterisks
 * are consumed first and never misread as a stray italic marker.
 */
export function inlineFormatting(text: string): string {
	return escapeHtml(text)
		.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
		.replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

/**
 * One or more formatted paragraphs, split the same way `paras` splits plain
 * text. `white-space: pre-wrap` makes a single Enter or an extra space
 * inside a paragraph show up exactly as typed instead of collapsing to
 * nothing — plain HTML otherwise renders any run of whitespace as one space
 * and ignores a lone newline entirely, which read as the editor silently
 * dropping what someone just typed.
 */
function RichParagraphs({ text, className }: { text: string; className?: string }) {
	return (
		<>
			{paras(text).map((p, i) => (
				<p className={className} key={i} style={{ whiteSpace: "pre-wrap" }} dangerouslySetInnerHTML={{ __html: inlineFormatting(p) }} />
			))}
		</>
	);
}

/**
 * A textarea with Bold/Italic buttons — select text, click, done (no markup
 * to remember or type). Wraps the current selection in ** or * and puts the
 * cursor back where a person would expect it; with nothing selected it just
 * drops in an empty pair with the cursor in the middle, ready to type into.
 * Used as a Puck `type: "custom"` field wherever body copy should support
 * bold/italic — see inlineFormatting/RichParagraphs above for the other half
 * (turning what's typed here into real tags when the page renders).
 */
function RichTextField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
	const ref = useRef<HTMLTextAreaElement>(null);

	function wrap(marker: string) {
		const el = ref.current;
		if (!el) return;
		const start = el.selectionStart ?? 0;
		const end = el.selectionEnd ?? 0;
		const text = value || "";
		const selected = text.slice(start, end);
		onChange(text.slice(0, start) + marker + selected + marker + text.slice(end));
		requestAnimationFrame(() => {
			if (!ref.current) return;
			const newStart = start + marker.length;
			ref.current.focus();
			ref.current.setSelectionRange(newStart, newStart + selected.length);
		});
	}

	return (
		<div style={{ display: "grid", gap: 4 }}>
			<div style={{ display: "flex", gap: 4 }}>
				<button type="button" onClick={() => wrap("**")} title="Bold" aria-label="Bold" style={{ width: 28, height: 28, fontWeight: 700, cursor: "pointer" }}>B</button>
				<button type="button" onClick={() => wrap("*")} title="Italic" aria-label="Italic" style={{ width: 28, height: 28, fontStyle: "italic", cursor: "pointer" }}>i</button>
			</div>
			<textarea
				ref={ref}
				value={value || ""}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				rows={6}
				style={{ width: "100%", boxSizing: "border-box", font: "inherit", padding: "8px", resize: "vertical" }}
			/>
		</div>
	);
}

/**
 * A drag handle for the gap between sections (the "Space" block).
 *
 * Every `.section` already carries its own built-in padding (4rem top and
 * bottom in global.css, trimmed to 3.25rem where one section follows
 * another) — roughly 116px between two ordinary sections with nothing
 * between them at all. A Spacer set to 0 only means "add nothing more"; it
 * was never able to remove that baseline, so once the built-in padding was
 * already more than someone wanted, there was no dial to turn. Letting the
 * slider go negative fixes that: it's a real margin, so a negative value
 * pulls the next section up and directly eats into that baseline gap
 * instead of only ever adding to it. Capped at -120px so two sections can
 * be pulled essentially edge to edge without one's content overlapping the
 * other's; 200px covers the biggest gap anyone's used on this site.
 */
function SpacerDrag({ value, onChange }: { value: string; onChange: (v: string) => void }) {
	const px = Math.max(-120, Math.min(200, parseInt(value, 10) || 0));
	return (
		<div style={{ display: "grid", gap: 6 }}>
			<div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7 }}>
				<span>Drag left to pull sections together, right for more room</span>
				<span>{px}px</span>
			</div>
			<input
				type="range"
				min={-120}
				max={200}
				step={4}
				value={px}
				onChange={(e) => onChange(`${e.target.value}px`)}
				style={{ width: "100%" }}
			/>
		</div>
	);
}

const richTextField = (label: string) => ({
	type: "custom" as const,
	label,
	render: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => <RichTextField value={value} onChange={onChange} />,
});

// A section's heading — eyebrow + title, sometimes a lede too — can be
// pulled left (default), centered, or pushed right. Only the heading itself
// moves; body copy stays put, since a paragraph of centered or right-aligned
// body text is usually harder to read, not better.
const alignField = (label = "Heading alignment") => ({
	type: "radio" as const,
	label,
	options: [
		{ label: "Left", value: "left" },
		{ label: "Center", value: "center" },
		{ label: "Right", value: "right" },
	],
});

/** A friendly name for a block, for the "jump to a section" list below. */
function sectionLabel(item: any): string {
	const p = item?.props || {};
	const text = p.title || p.heading || p.eyebrow || "";
	const typeLabel = (blocksConfig.components as any)[item?.type]?.label || item?.type || "Section";
	return text ? `${typeLabel} — "${text}"` : typeLabel;
}

/**
 * The id a block actually renders under — the ONE place this is computed,
 * so the "jump to a section" list (LinkField, below) can never drift from
 * what each block's own `render` puts on its `<section id=…>`. Most blocks
 * just use their own Puck-assigned id; GivingEmbed and PackSignupForm carry
 * an explicit `anchorId` field instead (so existing links into them keep
 * working even if the block itself is later duplicated), falling back to
 * the same fixed default their render functions use.
 */
export function blockAnchorId(item: any): string | undefined {
	const p = item?.props || {};
	if (item?.type === "GivingEmbed") return p.anchorId || "give-meals";
	if (item?.type === "PackSignupForm") return p.anchorId || "volunteer-to-pack";
	return typeof p.id === "string" ? p.id : undefined;
}

/**
 * Every button/link field on the site used to be a bare text box — to send
 * someone to a section on the SAME page you had to already know it had an
 * id and type "#that-id" by hand. This lists every section on the page
 * that's actually there to jump to (using usePuck() to read the live
 * document, not a stale copy) alongside the plain URL option, so "link this
 * button to that section" is a pick from a list instead of a guess.
 */
function LinkField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
	const { appState } = usePuck();
	const content: any[] = appState?.data?.content || [];
	const sections = content
		.map((item) => ({ id: blockAnchorId(item), label: sectionLabel(item) }))
		.filter((s): s is { id: string; label: string } => typeof s.id === "string" && s.id.length > 0);

	const isAnchor = typeof value === "string" && value.startsWith("#");
	const matchesKnownSection = isAnchor && sections.some((s) => `#${s.id}` === value);
	const selectValue = matchesKnownSection ? value : "__url__";

	return (
		<div style={{ display: "grid", gap: 6 }}>
			<select
				value={selectValue}
				onChange={(e) => {
					if (e.target.value !== "__url__") onChange(e.target.value);
					else if (isAnchor) onChange(""); // switching off a section jump — start the URL fresh
				}}
				style={{ width: "100%", boxSizing: "border-box", font: "inherit", padding: "8px" }}
			>
				<option value="__url__">A page or web address (typed below)</option>
				{sections.map((s) => (
					<option key={s.id} value={`#${s.id}`}>Jump to: {s.label}</option>
				))}
			</select>
			{selectValue === "__url__" ? (
				<input
					type="text"
					value={value || ""}
					onChange={(e) => onChange(e.target.value)}
					placeholder="/giving or https://…"
					style={{ width: "100%", boxSizing: "border-box", font: "inherit", padding: "8px" }}
				/>
			) : null}
		</div>
	);
}

const linkField = (label = "Link") => ({
	type: "custom" as const,
	label,
	render: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => <LinkField value={value} onChange={onChange} />,
});

// Pull a Vimeo id out of a pasted link (or accept a bare id). Meals of Hope's
// two films live on Vimeo, not YouTube.
function vimeoId(input: string): string | null {
	const s = String(input || "").trim();
	if (/^\d{6,}$/.test(s)) return s;
	const m = s.match(/vimeo\.com\/(?:video\/)?(\d{6,})/);
	return m ? m[1] : null;
}

// A link that leaves the site opens in a new tab, so a tap page stays put
// behind whatever someone taps into. Anything relative ("/connect") is ours.
function isExternal(href: string): boolean {
	return /^https?:\/\//i.test(href) && !/^https?:\/\/(www\.)?unifygr\.com/i.test(href);
}

// Pull a YouTube video id out of any pasted link (or accept a bare id).
function youtubeId(input: string): string | null {
	const s = String(input || "").trim();
	if (/^[\w-]{11}$/.test(s)) return s;
	const m = s.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/);
	return m ? m[1] : null;
}

// Custom Puck field: pick from the site's media library or upload a photo.
// Only mounts inside the editor (client), never on published pages.
function ImagePickerField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
	const [images, setImages] = useState<string[]>([]);
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		fetch("/api/studio/media").then((r) => r.json()).then((d) => setImages(d.images || [])).catch(() => {});
	}, []);

	async function upload(file: File) {
		setBusy(true);
		try {
			const dataBase64 = await new Promise<string>((res, rej) => {
				const fr = new FileReader();
				fr.onload = () => res(String(fr.result));
				fr.onerror = rej;
				fr.readAsDataURL(file);
			});
			const r = await fetch("/api/studio/media", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: file.name, dataBase64 }),
			}).then((x) => x.json());
			if (r.stageId) {
				if (!window.confirm("The upload is private until you promote it. Put this image on the public site now?")) return;
				const promoted = await fetch("/api/studio/media", {
					method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ promote: r.stageId }),
				}).then((x) => x.json());
				if (promoted.src) { onChange(promoted.src); setImages((im) => [promoted.src, ...im]); }
				else alert(promoted.error || "Promotion failed");
			} else alert(r.error || "Upload failed");
		} finally { setBusy(false); }
	}

	return (
		<div style={{ display: "grid", gap: 8 }}>
			{value ? <img src={value} alt="" style={{ width: "100%", borderRadius: 8, border: "1px solid #ddd" }} /> : null}
			<div style={{ display: "flex", gap: 6 }}>
				<button type="button" onClick={() => setOpen((o) => !o)} style={{ flex: 1, padding: "6px 8px", cursor: "pointer" }}>
					{open ? "Close library" : "Choose from site"}
				</button>
				<button type="button" onClick={() => fileRef.current?.click()} disabled={busy} style={{ flex: 1, padding: "6px 8px", cursor: "pointer" }}>
					{busy ? "Uploading…" : "Upload photo"}
				</button>
			</div>
			<input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
			{open && (
				<div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, maxHeight: 220, overflowY: "auto" }}>
					{images.map((src) => (
						<img key={src} src={src} alt="" title={src}
							onClick={() => { onChange(src); setOpen(false); }}
							style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 6, cursor: "pointer", outline: src === value ? "2px solid #4a7bd0" : "none" }} />
					))}
				</div>
			)}
		</div>
	);
}

export const blocksConfig: Config = {
	root: {
		fields: {
			title: { type: "text", label: "Page title" },
			kicker: { type: "text", label: "Kicker (small line used by the site)" },
			description: { type: "textarea", label: "Search-engine description" },
		},
		render: ({ children }: any) => <>{children}</>,
	},
	components: {
		Hero: {
			label: "Page heading",
			fields: {
				kicker: { type: "text", label: "Small line above (kicker)" },
				heading: { type: "text", label: "Big heading" },
				lede: { type: "textarea", label: "Intro sentence" },
				align: alignField(),
			},
			defaultProps: {
				kicker: "New Life",
				heading: "A new page",
				lede: "",
				align: "left",
			},
			render: ({ id, kicker, heading, lede, align }) => (
				<section className="section interior-hero" id={id}>
					<div className="container" style={{ textAlign: align || "left" }}>
						{kicker ? <p className="eyebrow reveal is-visible">{kicker}</p> : null}
						<h1 className="interior-hero__title reveal is-visible">{heading}</h1>
						{lede ? <p className="interior-hero__lede reveal is-visible" style={{ whiteSpace: "pre-wrap" }}>{lede}</p> : null}
					</div>
				</section>
			),
		},

		Prose: {
			label: "Text section",
			fields: {
				eyebrow: { type: "text", label: "Small label above" },
				title: { type: "text", label: "Section title" },
				body: richTextField("Body (blank line = new paragraph)"),
				tinted: {
					type: "radio",
					label: "Background",
					options: [
						{ label: "Plain", value: false },
						{ label: "Tinted", value: true },
					],
				},
				align: alignField(),
			},
			defaultProps: { eyebrow: "", title: "Section title", body: "Write something here.", tinted: false, align: "left" },
			render: ({ id, eyebrow, title, body, tinted, align }) => (
				<section className={`section prose-block${tinted ? " prose-block--tinted" : ""}${!eyebrow && !title ? " prose-block--body-only" : ""}`} id={id}>
					<div className="container">
						{(eyebrow || title) ? (
							<div style={{ textAlign: align || "left" }}>
								{eyebrow ? <p className="eyebrow reveal is-visible">{eyebrow}</p> : null}
								{title ? <h2 className="prose-block__title reveal is-visible">{title}</h2> : null}
							</div>
						) : null}
						<div className="prose-block__body">
							<RichParagraphs text={body} className="reveal is-visible" />
						</div>
					</div>
				</section>
			),
		},

		Cards: {
			label: "Card row",
			fields: {
				eyebrow: { type: "text", label: "Small label above" },
				title: { type: "text", label: "Row title" },
				style: {
					type: "radio",
					label: "Card style",
					options: [
						{ label: "Numbered", value: "numbered" },
						{ label: "Simple", value: "simple" },
					],
				},
				cards: {
					type: "array",
					label: "Cards",
					arrayFields: {
						title: { type: "text", label: "Card title" },
						text: richTextField("Card text"),
					},
					defaultItemProps: { title: "Card", text: "" },
					getItemSummary: (item: any) => item?.title || "Card",
				},
				align: alignField(),
			},
			defaultProps: {
				eyebrow: "",
				title: "",
				style: "numbered",
				align: "left",
				cards: [
					{ title: "First", text: "Something true." },
					{ title: "Second", text: "Something good." },
				],
			},
			render: ({ id, eyebrow, title, style, cards, align }) => (
				<section className="section prose-block" id={id}>
					<div className="container">
						{(eyebrow || title) ? (
							<div className="section-heading reveal is-visible" style={{ textAlign: align || "left" }}>
								{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
								{title ? <h2>{title}</h2> : null}
							</div>
						) : null}
						{style === "simple" ? (
							<div className="value-grid">
								{(cards || []).map((c: any, i: number) => (
									<article className="value-card reveal is-visible" key={i}>
										<h3>{c.title}</h3>
										<RichParagraphs text={c.text} />
									</article>
								))}
							</div>
						) : (
							<div style={{ display: "grid", gap: "18px", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginTop: "18px" }}>
								{(cards || []).map((c: any, i: number) => (
									<div className="command-card reveal is-visible" key={i}>
										<span className="command-card__n">{String(i + 1).padStart(2, "0")}</span>
										<h3>{c.title}</h3>
										<RichParagraphs text={c.text} />
									</div>
								))}
							</div>
						)}
					</div>
				</section>
			),
		},

		FAQ: {
			label: "Questions & answers",
			fields: {
				eyebrow: { type: "text", label: "Small label above" },
				title: { type: "text", label: "Section title" },
				items: {
					type: "array",
					label: "Questions",
					arrayFields: {
						q: { type: "text", label: "Question" },
						a: richTextField("Answer"),
					},
					defaultItemProps: { q: "A question?", a: "" },
					getItemSummary: (item: any) => item?.q || "Question",
				},
				align: alignField(),
			},
			defaultProps: { eyebrow: "Good to Know", title: "Frequently asked.", items: [], align: "left" },
			render: ({ id, eyebrow, title, items, align }) => (
				<section className="section section--rhythm" id={id}>
					<div className="rhythm__veil"></div>
					<div className="container">
						{(eyebrow || title) ? (
							<div className="section-heading reveal is-visible" style={{ textAlign: align || "left" }}>
								{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
								{title ? <h2>{title}</h2> : null}
							</div>
						) : null}
						<div className="faq-list">
							{(items || []).map((it: any, i: number) => (
								<details className="faq-item reveal is-visible" key={i}>
									<summary>{it.q}</summary>
									<RichParagraphs text={it.a} />
								</details>
							))}
						</div>
					</div>
				</section>
			),
		},

		Callout: {
			label: "Callout panel",
			fields: {
				eyebrow: { type: "text", label: "Small label above" },
				title: { type: "text", label: "Panel title" },
				body: richTextField("Body"),
				buttons: {
					type: "array",
					label: "Buttons",
					arrayFields: {
						label: { type: "text", label: "Label" },
						href: linkField(),
						style: {
							type: "radio",
							label: "Style",
							options: [
								{ label: "Solid", value: "primary" },
								{ label: "Outline", value: "secondary" },
							],
						},
					},
					defaultItemProps: { label: "Learn more", href: "/", style: "primary" },
					getItemSummary: (item: any) => item?.label || "Button",
				},
				align: alignField(),
			},
			defaultProps: { eyebrow: "", title: "A word from us", body: "", buttons: [], align: "left" },
			render: ({ id, eyebrow, title, body, buttons, align }) => (
				<section className="section" style={{ paddingTop: "24px", paddingBottom: "24px" }} id={id}>
					<div className="container">
						<div className="formation-cta reveal is-visible">
							{(eyebrow || title) ? (
								<div style={{ textAlign: align || "left" }}>
									{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
									{title ? <h3>{title}</h3> : null}
								</div>
							) : null}
							<RichParagraphs text={body} />
							{(buttons || []).length ? (
								<div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "6px" }}>
									{(buttons || []).map((b: any, i: number) => (
										<a className={`button button--${b.style === "secondary" ? "secondary" : "primary"}`} href={b.href} key={i}>{b.label}</a>
									))}
								</div>
							) : null}
						</div>
					</div>
				</section>
			),
		},

		Profiles: {
			label: "People (photo cards)",
			fields: {
				items: {
					type: "array",
					label: "People",
					arrayFields: {
						photo: {
							type: "custom",
							label: "Photo",
							render: ({ value, onChange }: any) => <ImagePickerField value={value} onChange={onChange} />,
						},
						name: { type: "text", label: "Name" },
						role: { type: "text", label: "Role" },
						bio: richTextField("Bio"),
						name2: { type: "text", label: "Second person's name (optional)" },
						role2: { type: "text", label: "Second person's role" },
						bio2: richTextField("Second person's bio"),
					},
					defaultItemProps: { photo: "", name: "Name", role: "Role", bio: "", name2: "", role2: "", bio2: "" },
					getItemSummary: (item: any) => item?.name || "Person",
				},
			},
			defaultProps: { items: [] },
			render: ({ id, items }) => (
				<section className="section profiles-block" id={id}>
					<div className="container">
						<div className="staff-grid">
							{(items || []).map((p: any, i: number) => (
								<article className="staff-card reveal is-visible" key={i}>
									{p.photo ? (
										<div className="staff-card__photo">
											<img src={p.photo} alt={[p.name, p.name2].filter(Boolean).join(" & ")} loading="lazy" />
										</div>
									) : null}
									<div className="staff-card__person">
										<h3>{p.name}</h3>
										{p.role ? <p className="staff-card__role">{p.role}</p> : null}
										{p.bio ? <RichParagraphs text={p.bio} /> : null}
									</div>
									{p.name2 ? (
										<div className="staff-card__person">
											<h3>{p.name2}</h3>
											{p.role2 ? <p className="staff-card__role">{p.role2}</p> : null}
											{p.bio2 ? <RichParagraphs text={p.bio2} /> : null}
										</div>
									) : null}
								</article>
							))}
						</div>
					</div>
				</section>
			),
		},

		ListCards: {
			label: "Cards with lists",
			fields: {
				cards: {
					type: "array",
					label: "Cards",
					arrayFields: {
						title: { type: "text", label: "Card title" },
						blurb: richTextField("Blurb"),
						items: { type: "textarea", label: "List (one item per line)" },
					},
					defaultItemProps: { title: "Team", blurb: "", items: "" },
					getItemSummary: (item: any) => item?.title || "Card",
				},
			},
			defaultProps: { cards: [] },
			render: ({ id, cards }) => (
				<section className="section section--rhythm" id={id}>
					<div className="rhythm__veil"></div>
					<div className="container team-grid">
						{(cards || []).map((c: any, i: number) => (
							<article className="team-card reveal is-visible" key={i}>
								<h3>{c.title}</h3>
								{c.blurb ? <RichParagraphs text={c.blurb} /> : null}
								<ul className="team-card__members">
									{String(c.items || "").split("\n").map((s: string) => s.trim()).filter(Boolean).map((m: string, j: number) => (
										<li key={j}>{m}</li>
									))}
								</ul>
							</article>
						))}
					</div>
				</section>
			),
		},

		Feature: {
			label: "Feature (media + facts)",
			fields: {
				eyebrow: { type: "text", label: "Small label above" },
				heading: { type: "text", label: "Heading" },
				subline: { type: "text", label: "Highlighted line (e.g. dates)" },
				body: richTextField("Body"),
				image: {
					type: "custom",
					label: "Photo (also used as the video's poster)",
					render: ({ value, onChange }: any) => <ImagePickerField value={value} onChange={onChange} />,
				},
				video: { type: "text", label: "Video file path (optional, e.g. /art/generated/….mp4)" },
				buttons: {
					type: "array",
					label: "Buttons",
					arrayFields: {
						label: { type: "text", label: "Label" },
						href: linkField(),
						style: {
							type: "radio",
							label: "Style",
							options: [
								{ label: "Solid", value: "primary" },
								{ label: "Outline", value: "secondary" },
							],
						},
					},
					defaultItemProps: { label: "Learn more", href: "/", style: "primary" },
					getItemSummary: (item: any) => item?.label || "Button",
				},
				facts: {
					type: "array",
					label: "Quick facts",
					arrayFields: {
						label: { type: "text", label: "Label" },
						value: { type: "textarea", label: "Value" },
					},
					defaultItemProps: { label: "Fact", value: "" },
					getItemSummary: (item: any) => item?.label || "Fact",
				},
				align: alignField(),
			},
			defaultProps: { eyebrow: "", heading: "A big thing", subline: "", body: "", image: "", video: "", buttons: [], facts: [], align: "left" },
			render: ({ id, eyebrow, heading, subline, body, image, video, buttons, facts, align }) => (
				<section className="section" id={id}>
					<div className="container trip-hero">
						{(video || image) ? (
							<div className="trip-hero__media reveal is-visible">
								{video ? (
									<video autoPlay muted loop playsInline poster={image || undefined}>
										<source src={video} type="video/mp4" />
									</video>
								) : (
									<img src={image} alt="" style={{ width: "100%", display: "block" }} />
								)}
							</div>
						) : null}
						<div className="trip-hero__body reveal is-visible">
							{(eyebrow || heading || subline) ? (
								<div style={{ textAlign: align || "left" }}>
									{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
									{heading ? <h2>{heading}</h2> : null}
									{subline ? <p className="trip-hero__dates">{subline}</p> : null}
								</div>
							) : null}
							<RichParagraphs text={body} />
							{(buttons || []).length ? (
								<div className="trip-hero__actions">
									{(buttons || []).map((b: any, i: number) => (
										<a className={`button button--${b.style === "secondary" ? "secondary" : "primary"}`} href={b.href} key={i}>{b.label}</a>
									))}
								</div>
							) : null}
							{(facts || []).length ? (
								<dl className="trip-facts">
									{(facts || []).map((f: any, i: number) => (
										<div key={i}><dt>{f.label}</dt><dd>{f.value}</dd></div>
									))}
								</dl>
							) : null}
						</div>
					</div>
				</section>
			),
		},

		CtaCards: {
			label: "Action cards",
			fields: {
				cards: {
					type: "array",
					label: "Cards",
					arrayFields: {
						label: { type: "text", label: "Small label" },
						title: { type: "text", label: "Card title" },
						body: richTextField("Card text"),
						buttonLabel: { type: "text", label: "Button label (optional)" },
						buttonHref: linkField("Button link"),
						featured: {
							type: "radio",
							label: "Highlight",
							options: [
								{ label: "Normal", value: false },
								{ label: "Featured", value: true },
							],
						},
					},
					defaultItemProps: { label: "", title: "Card", body: "", buttonLabel: "", buttonHref: "", featured: false },
					getItemSummary: (item: any) => item?.title || "Card",
				},
			},
			defaultProps: { cards: [] },
			render: ({ id, cards }) => (
				<section className="section" id={id}>
					<div className="container give-grid">
						{(cards || []).map((c: any, i: number) => (
							<article className={`give-card${c.featured ? " give-card--primary" : ""} reveal is-visible`} key={i}>
								{c.label ? <p className="eyebrow">{c.label}</p> : null}
								<h3>{c.title}</h3>
								<RichParagraphs text={c.body} />
								{c.buttonLabel ? (
									<a className="button button--primary" href={c.buttonHref} target={/^https?:/.test(c.buttonHref || "") ? "_blank" : undefined} rel="noopener">{c.buttonLabel}</a>
								) : null}
							</article>
						))}
					</div>
				</section>
			),
		},

		Quote: {
			label: "Pull quote",
			fields: { text: { type: "textarea", label: "The line" } },
			defaultProps: { text: "A line worth pulling out." },
			render: ({ id, text }) => (
				<section className="section prose-block" id={id}>
					<div className="container">
						<p className="rest-pull reveal is-visible" style={{ whiteSpace: "pre-wrap" }}>{text}</p>
					</div>
				</section>
			),
		},

		Buttons: {
			label: "Buttons",
			fields: {
				buttons: {
					type: "array",
					label: "Buttons",
					arrayFields: {
						label: { type: "text", label: "Label" },
						href: linkField(),
						style: {
							type: "radio",
							label: "Style",
							options: [
								{ label: "Solid", value: "primary" },
								{ label: "Outline", value: "secondary" },
							],
						},
					},
					defaultItemProps: { label: "Plan a Visit", href: "/visit", style: "primary" },
					getItemSummary: (item: any) => item?.label || "Button",
				},
			},
			defaultProps: { buttons: [{ label: "Plan a Visit", href: "/visit", style: "primary" }] },
			render: ({ id, buttons }) => (
				<section className="section" style={{ paddingTop: 0 }} id={id}>
					<div className="container" style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
						{(buttons || []).map((b: any, i: number) => (
							<a className={`button button--${b.style === "secondary" ? "secondary" : "primary"}`} href={b.href} key={i}>
								{b.label}
							</a>
						))}
					</div>
				</section>
			),
		},

		TapButtons: {
			label: "Tap page (big phone buttons)",
			fields: {
				brand: { type: "text", label: "Small line at the top" },
				heading: { type: "text", label: "Big heading (two or three short words)" },
				lede: { type: "text", label: "One line under the heading" },
				links: {
					type: "array",
					label: "Buttons",
					arrayFields: {
						label: { type: "text", label: "Button text" },
						blurb: { type: "textarea", label: "Small line underneath" },
						href: linkField(),
						feature: {
							type: "radio",
							label: "Style",
							options: [
								{ label: "Normal", value: "no" },
								{ label: "Gold (the main one)", value: "yes" },
							],
						},
					},
					defaultItemProps: { label: "A next step", blurb: "", href: "", feature: "no" },
					getItemSummary: (item: any) => item?.label || "Button",
				},
				footLabel: { type: "text", label: "Small link at the bottom" },
				footHref: linkField("Where the bottom link goes"),
			},
			defaultProps: {
				brand: "New Life Grand Rapids",
				heading: "Start here.",
				lede: "",
				links: [{ label: "A next step", blurb: "", href: "", feature: "no" }],
				footLabel: "Everything else at New Life",
				footHref: "/",
			},
			render: ({ brand, heading, lede, links, footLabel, footHref }) => (
				<div className="tap">
					<div className="tap__glow" aria-hidden="true"></div>
					<div className="tap__inner">
						<div className="tap__head">
							{brand ? (
								<a className="tap__brand" href="/">
									{brand}
								</a>
							) : null}
							{heading ? <h1 className="tap__title">{heading}</h1> : null}
							{lede ? <p className="tap__lede" style={{ whiteSpace: "pre-wrap" }}>{lede}</p> : null}
						</div>

						<nav className="tap__stack" aria-label="Take a step">
							{(links || []).map((l: any, i: number) => {
								const href = String(l?.href || "").trim();
								const cls = [
									"tapbtn",
									l?.feature === "yes" ? "tapbtn--feature" : "",
									href ? "" : "tapbtn--empty",
								]
									.filter(Boolean)
									.join(" ");
								const body = (
									<>
										<span className="tapbtn__label">{l?.label || "Untitled"}</span>
										{l?.blurb ? <span className="tapbtn__blurb">{l.blurb}</span> : null}
										<span className="tapbtn__arrow" aria-hidden="true">
											→
										</span>
									</>
								);
								// A button with no link yet is shown to staff as a placeholder
								// rather than rendered as a link that goes nowhere.
								return href ? (
									<a
										className={cls}
										href={href}
										key={i}
										target={isExternal(href) ? "_blank" : undefined}
										rel={isExternal(href) ? "noopener" : undefined}
									>
										{body}
									</a>
								) : (
									<span className={cls} key={i}>
										{body}
									</span>
								);
							})}
						</nav>

						{footLabel ? (
							<div className="tap__foot">
								<a href={footHref || "/"}>{footLabel}</a>
							</div>
						) : null}
					</div>
				</div>
			),
		},

		Image: {
			label: "Photo",
			fields: {
				src: {
					type: "custom",
					label: "Photo",
					render: ({ value, onChange }: any) => <ImagePickerField value={value} onChange={onChange} />,
				},
				alt: { type: "text", label: "Describe the photo (for screen readers)" },
				caption: { type: "text", label: "Caption (optional)" },
				width: {
					type: "radio",
					label: "Size",
					options: [
						{ label: "Full width", value: "full" },
						{ label: "Inset", value: "inset" },
					],
				},
			},
			defaultProps: { src: "", alt: "", caption: "", width: "inset" },
			render: ({ id, src, alt, caption, width }) => (
				<section className="section" style={{ paddingTop: "24px", paddingBottom: "24px" }} id={id}>
					<div className="container">
						{src ? (
							<figure style={{ margin: 0, maxWidth: width === "inset" ? "760px" : "100%", marginInline: "auto" }}>
								<img src={src} alt={alt || ""} style={{ width: "100%", borderRadius: "18px", display: "block" }} />
								{caption ? (
									<figcaption style={{ marginTop: "10px", fontSize: "14px", opacity: 0.65, textAlign: "center" }}>{caption}</figcaption>
								) : null}
							</figure>
						) : (
							<p style={{ opacity: 0.5, textAlign: "center", padding: "40px 0", border: "1px dashed rgba(128,128,128,.4)", borderRadius: "18px" }}>
								Pick or upload a photo →
							</p>
						)}
					</div>
				</section>
			),
		},

		Gallery: {
			label: "Photo gallery",
			fields: {
				eyebrow: { type: "text", label: "Small label above" },
				title: { type: "text", label: "Section title" },
				photos: {
					type: "array",
					label: "Photos",
					arrayFields: {
						src: {
							type: "custom",
							label: "Photo",
							render: ({ value, onChange }: any) => <ImagePickerField value={value} onChange={onChange} />,
						},
						alt: { type: "text", label: "Describe the photo (for screen readers)" },
					},
					defaultItemProps: { src: "", alt: "" },
					getItemSummary: (item: any, i?: number) => item?.alt || `Photo ${(i ?? 0) + 1}`,
				},
				align: alignField(),
			},
			defaultProps: { eyebrow: "", title: "", photos: [], align: "left" },
			render: ({ id, eyebrow, title, photos, align }) => (
				<section className="section" id={id}>
					<div className="container">
						{(eyebrow || title) ? (
							<div style={{ textAlign: align || "left" }}>
								{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
								{title ? <h2>{title}</h2> : null}
							</div>
						) : null}
						<div
							style={{
								marginTop: title || eyebrow ? "22px" : 0,
								display: "grid",
								gap: "12px",
								gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
							}}
						>
							{(photos || []).filter((p: any) => p?.src).map((p: any, i: number) => (
								<img
									key={i}
									src={p.src}
									alt={p.alt || ""}
									loading="lazy"
									style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: "14px", display: "block" }}
								/>
							))}
						</div>
					</div>
				</section>
			),
		},

		Video: {
			label: "Video (YouTube or Vimeo)",
			fields: {
				url: { type: "text", label: "YouTube or Vimeo link (paste any share link)" },
				caption: { type: "text", label: "Caption (optional)" },
			},
			defaultProps: { url: "", caption: "" },
			render: ({ id: blockId, url, caption }) => {
				const id = youtubeId(url);
				const vimeo = id ? null : vimeoId(url);
				return (
					<section className="section" style={{ paddingTop: "24px", paddingBottom: "24px" }} id={blockId}>
						<div className="container">
							<figure style={{ margin: 0, maxWidth: "860px", marginInline: "auto" }}>
								{id || vimeo ? (
									<iframe
										src={id ? `https://www.youtube-nocookie.com/embed/${id}` : `https://player.vimeo.com/video/${vimeo}`}
										title={caption || "Video"}
										allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
										allowFullScreen
										style={{ width: "100%", aspectRatio: "16 / 9", border: 0, borderRadius: "18px", display: "block" }}
									/>
								) : (
									<p style={{ opacity: 0.5, textAlign: "center", padding: "40px 0", border: "1px dashed rgba(128,128,128,.4)", borderRadius: "18px" }}>
										Paste a YouTube or Vimeo link →
									</p>
								)}
								{caption ? (
									<figcaption style={{ marginTop: "10px", fontSize: "14px", opacity: 0.65, textAlign: "center" }}>{caption}</figcaption>
								) : null}
							</figure>
						</div>
					</section>
				);
			},
		},

		PackSignupForm: {
			label: "Team sign-up form (Meals of Hope)",
			fields: {
				eyebrow: { type: "text", label: "Small label above" },
				title: { type: "text", label: "Title" },
				body: richTextField("Intro copy"),
				submitLabel: { type: "text", label: "Button label" },
				align: alignField(),
				anchorId: { type: "text", label: "Link anchor (for a button elsewhere on this page to jump here, e.g. volunteer-to-pack)" },
			},
			defaultProps: {
				eyebrow: "Bring a team",
				title: "Save us a table",
				body: "Tell us who's coming and we'll have a table ready for you on November 14th.",
				submitLabel: "Save our table",
				align: "left",
				anchorId: "volunteer-to-pack",
			},
			// Static, server-rendered markup — the same pattern as every other
			// block. A small vanilla-JS enhancer (in MountedPage.astro, scoped to
			// [data-pack-signup-form]) wires the fetch/submit behavior, the same
			// way /connect.astro's own form works with no client-side React.
			render: ({ eyebrow, title, body, submitLabel, align, anchorId }) => (
				<section className="section pack-signup" id={anchorId || "volunteer-to-pack"}>
					<div className="container pack-signup__wrap">
						{(eyebrow || title) ? (
							<div style={{ textAlign: align || "left" }}>
								{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
								{title ? <h2>{title}</h2> : null}
							</div>
						) : null}
						{body ? <RichParagraphs text={body} /> : null}

						<form className="pack-signup-form" data-pack-signup-form noValidate>
							<div className="pack-signup-row">
								<label className="pack-signup-field">
									<span>First name</span>
									<input name="firstName" type="text" autoComplete="given-name" required />
								</label>
								<label className="pack-signup-field">
									<span>Last name</span>
									<input name="lastName" type="text" autoComplete="family-name" required />
								</label>
							</div>
							<div className="pack-signup-row">
								<label className="pack-signup-field">
									<span>Email</span>
									<input name="email" type="email" autoComplete="email" inputMode="email" />
								</label>
								<label className="pack-signup-field">
									<span>Mobile phone</span>
									<input name="phone" type="tel" autoComplete="tel" inputMode="tel" />
								</label>
							</div>
							<p className="pack-signup-note">Either one is fine — we just need a way to reach you.</p>

							<label className="pack-signup-field">
								<span>How many people should we expect, including yourself?</span>
								<input name="headcount" type="number" min="1" step="1" required />
							</label>

							{/* Not shown to people — only bots fill this in. */}
							<div className="pack-signup-hp" aria-hidden="true">
								<label>
									Website
									<input name="website" type="text" tabIndex={-1} autoComplete="off" />
								</label>
							</div>

							<p className="pack-signup-error" data-pack-signup-error role="alert" hidden></p>

							<button className="button button--primary" type="submit" data-pack-signup-submit>
								{submitLabel || "Save our table"}
							</button>
						</form>

						<div className="pack-signup-done" data-pack-signup-done hidden>
							<p className="eyebrow">Thank you</p>
							<h3>We've saved your table.</h3>
							<p>We'll be in touch with the details before November 14th.</p>
						</div>
					</div>
				</section>
			),
		},

		GivingEmbed: {
			label: "Giving form (embedded)",
			fields: {
				eyebrow: { type: "text", label: "Small label above" },
				title: { type: "text", label: "Title" },
				src: { type: "text", label: "SecureGive widget link (from SecureGive's embed code)" },
				height: { type: "text", label: "Height (px)" },
				anchorId: { type: "text", label: "Link anchor (for a button elsewhere on this page to jump here, e.g. give-online)" },
				align: alignField(),
			},
			defaultProps: {
				eyebrow: "Give online",
				title: "Give toward Meals of Hope",
				src: "https://app.securegive.com/NewLifeGR/global-impact-and-city-transformation/static/widget/donate?cats=47923&amts=false",
				height: "772",
				anchorId: "give-meals",
				align: "center",
			},
			render: ({ eyebrow, title, src, height, anchorId, align }) => (
				<section className="section giving-embed" id={anchorId || "give-meals"}>
					<div className="container" style={{ maxWidth: "640px", textAlign: align || "center" }}>
						{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
						{title ? <h2>{title}</h2> : null}
						{src ? (
							<div className="giving-embed__frame">
								<iframe
									src={src}
									title={title || "Give online"}
									style={{ width: "100%", height: `${parseInt(height, 10) || 772}px`, border: 0, display: "block" }}
								/>
							</div>
						) : (
							<p style={{ opacity: 0.5, textAlign: "center", padding: "40px 0", border: "1px dashed rgba(128,128,128,.4)", borderRadius: "18px" }}>
								Paste the SecureGive widget link →
							</p>
						)}
					</div>
				</section>
			),
		},

		Spacer: {
			label: "Space",
			fields: {
				size: {
					type: "custom",
					label: "Amount",
					render: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => <SpacerDrag value={value} onChange={onChange} />,
				},
			},
			defaultProps: { size: "64px" },
			// A margin, not a height — height can't go negative, and negative is
			// the whole point of the drag handle above (see SpacerDrag).
			render: ({ size }) => <div style={{ marginTop: size }} aria-hidden="true" />,
		},
	},
};
