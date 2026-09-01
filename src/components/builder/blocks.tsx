// The block kit for the visual builder — every block renders with the site's
// own CSS classes (global.css), so anything staff assemble looks native to
// the site. This config drives BOTH the drag-and-drop editor (Puck) and the
// server-side render of published pages (/p/<slug>).
//
// Adding a block: add a component here AND add its name to ALLOWED_BLOCKS in
// src/lib/studio/pages.ts (the fence), then it's available everywhere.

import type { Config } from "@measured/puck";
import { useEffect, useRef, useState } from "react";

// Split a textarea into paragraphs on blank lines.
function paras(text: string) {
	return String(text || "")
		.split(/\n\s*\n/)
		.map((p) => p.trim())
		.filter(Boolean);
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
			if (r.src) { onChange(r.src); setImages((im) => [r.src, ...im]); }
			else alert(r.error || "Upload failed");
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
			},
			defaultProps: {
				kicker: "New Life",
				heading: "A new page",
				lede: "",
			},
			render: ({ kicker, heading, lede }) => (
				<section className="section interior-hero">
					<div className="container">
						{kicker ? <p className="eyebrow reveal is-visible">{kicker}</p> : null}
						<h1 className="interior-hero__title reveal is-visible">{heading}</h1>
						{lede ? <p className="interior-hero__lede reveal is-visible">{lede}</p> : null}
					</div>
				</section>
			),
		},

		Prose: {
			label: "Text section",
			fields: {
				eyebrow: { type: "text", label: "Small label above" },
				title: { type: "text", label: "Section title" },
				body: { type: "textarea", label: "Body (blank line = new paragraph)" },
				tinted: {
					type: "radio",
					label: "Background",
					options: [
						{ label: "Plain", value: false },
						{ label: "Tinted", value: true },
					],
				},
			},
			defaultProps: { eyebrow: "", title: "Section title", body: "Write something here.", tinted: false },
			render: ({ eyebrow, title, body, tinted }) => (
				<section className={`section prose-block${tinted ? " prose-block--tinted" : ""}`}>
					<div className="container">
						{eyebrow ? <p className="eyebrow reveal is-visible">{eyebrow}</p> : null}
						{title ? <h2 className="prose-block__title reveal is-visible">{title}</h2> : null}
						<div className="prose-block__body">
							{paras(body).map((p, i) => (
								<p className="reveal is-visible" key={i}>{p}</p>
							))}
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
						text: { type: "textarea", label: "Card text" },
					},
					defaultItemProps: { title: "Card", text: "" },
					getItemSummary: (item: any) => item?.title || "Card",
				},
			},
			defaultProps: {
				eyebrow: "",
				title: "",
				style: "numbered",
				cards: [
					{ title: "First", text: "Something true." },
					{ title: "Second", text: "Something good." },
				],
			},
			render: ({ eyebrow, title, style, cards }) => (
				<section className="section prose-block">
					<div className="container">
						{(eyebrow || title) ? (
							<div className="section-heading reveal is-visible">
								{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
								{title ? <h2>{title}</h2> : null}
							</div>
						) : null}
						{style === "simple" ? (
							<div className="value-grid">
								{(cards || []).map((c: any, i: number) => (
									<article className="value-card reveal is-visible" key={i}>
										<h3>{c.title}</h3>
										<p>{c.text}</p>
									</article>
								))}
							</div>
						) : (
							<div style={{ display: "grid", gap: "18px", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginTop: "18px" }}>
								{(cards || []).map((c: any, i: number) => (
									<div className="command-card reveal is-visible" key={i}>
										<span className="command-card__n">{String(i + 1).padStart(2, "0")}</span>
										<h3>{c.title}</h3>
										<p>{c.text}</p>
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
						a: { type: "textarea", label: "Answer" },
					},
					defaultItemProps: { q: "A question?", a: "" },
					getItemSummary: (item: any) => item?.q || "Question",
				},
			},
			defaultProps: { eyebrow: "Good to Know", title: "Frequently asked.", items: [] },
			render: ({ eyebrow, title, items }) => (
				<section className="section section--rhythm">
					<div className="rhythm__veil"></div>
					<div className="container">
						{(eyebrow || title) ? (
							<div className="section-heading reveal is-visible">
								{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
								{title ? <h2>{title}</h2> : null}
							</div>
						) : null}
						<div className="faq-list">
							{(items || []).map((it: any, i: number) => (
								<details className="faq-item reveal is-visible" key={i}>
									<summary>{it.q}</summary>
									<p>{it.a}</p>
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
				body: { type: "textarea", label: "Body" },
				buttons: {
					type: "array",
					label: "Buttons",
					arrayFields: {
						label: { type: "text", label: "Label" },
						href: { type: "text", label: "Link" },
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
			},
			defaultProps: { eyebrow: "", title: "A word from us", body: "", buttons: [] },
			render: ({ eyebrow, title, body, buttons }) => (
				<section className="section" style={{ paddingTop: "24px", paddingBottom: "24px" }}>
					<div className="container">
						<div className="formation-cta reveal is-visible">
							{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
							{title ? <h3>{title}</h3> : null}
							{paras(body).map((p, i) => <p key={i}>{p}</p>)}
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
						bio: { type: "textarea", label: "Bio" },
						name2: { type: "text", label: "Second person's name (optional)" },
						role2: { type: "text", label: "Second person's role" },
						bio2: { type: "textarea", label: "Second person's bio" },
					},
					defaultItemProps: { photo: "", name: "Name", role: "Role", bio: "", name2: "", role2: "", bio2: "" },
					getItemSummary: (item: any) => item?.name || "Person",
				},
			},
			defaultProps: { items: [] },
			render: ({ items }) => (
				<section className="section">
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
										{p.bio ? <p>{p.bio}</p> : null}
									</div>
									{p.name2 ? (
										<div className="staff-card__person">
											<h3>{p.name2}</h3>
											{p.role2 ? <p className="staff-card__role">{p.role2}</p> : null}
											{p.bio2 ? <p>{p.bio2}</p> : null}
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
						blurb: { type: "textarea", label: "Blurb" },
						items: { type: "textarea", label: "List (one item per line)" },
					},
					defaultItemProps: { title: "Team", blurb: "", items: "" },
					getItemSummary: (item: any) => item?.title || "Card",
				},
			},
			defaultProps: { cards: [] },
			render: ({ cards }) => (
				<section className="section section--rhythm">
					<div className="rhythm__veil"></div>
					<div className="container team-grid">
						{(cards || []).map((c: any, i: number) => (
							<article className="team-card reveal is-visible" key={i}>
								<h3>{c.title}</h3>
								{c.blurb ? <p>{c.blurb}</p> : null}
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
				body: { type: "textarea", label: "Body" },
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
						href: { type: "text", label: "Link" },
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
			},
			defaultProps: { eyebrow: "", heading: "A big thing", subline: "", body: "", image: "", video: "", buttons: [], facts: [] },
			render: ({ eyebrow, heading, subline, body, image, video, buttons, facts }) => (
				<section className="section">
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
							{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
							{heading ? <h2>{heading}</h2> : null}
							{subline ? <p className="trip-hero__dates">{subline}</p> : null}
							{paras(body).map((p, i) => <p key={i}>{p}</p>)}
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
						body: { type: "textarea", label: "Card text" },
						buttonLabel: { type: "text", label: "Button label (optional)" },
						buttonHref: { type: "text", label: "Button link" },
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
			render: ({ cards }) => (
				<section className="section">
					<div className="container give-grid">
						{(cards || []).map((c: any, i: number) => (
							<article className={`give-card${c.featured ? " give-card--primary" : ""} reveal is-visible`} key={i}>
								{c.label ? <p className="eyebrow">{c.label}</p> : null}
								<h3>{c.title}</h3>
								{paras(c.body).map((p, j) => <p key={j}>{p}</p>)}
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
			render: ({ text }) => (
				<section className="section prose-block">
					<div className="container">
						<p className="rest-pull reveal is-visible">{text}</p>
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
						href: { type: "text", label: "Link (e.g. /visit)" },
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
			render: ({ buttons }) => (
				<section className="section" style={{ paddingTop: 0 }}>
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
						href: { type: "text", label: "Where it goes — paste the full link" },
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
				footHref: { type: "text", label: "Where the bottom link goes" },
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
							{lede ? <p className="tap__lede">{lede}</p> : null}
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
			render: ({ src, alt, caption, width }) => (
				<section className="section" style={{ paddingTop: "24px", paddingBottom: "24px" }}>
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

		Video: {
			label: "Video (YouTube)",
			fields: {
				url: { type: "text", label: "YouTube link (paste any share link)" },
				caption: { type: "text", label: "Caption (optional)" },
			},
			defaultProps: { url: "", caption: "" },
			render: ({ url, caption }) => {
				const id = youtubeId(url);
				return (
					<section className="section" style={{ paddingTop: "24px", paddingBottom: "24px" }}>
						<div className="container">
							<figure style={{ margin: 0, maxWidth: "860px", marginInline: "auto" }}>
								{id ? (
									<iframe
										src={`https://www.youtube-nocookie.com/embed/${id}`}
										title={caption || "Video"}
										allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
										allowFullScreen
										style={{ width: "100%", aspectRatio: "16 / 9", border: 0, borderRadius: "18px", display: "block" }}
									/>
								) : (
									<p style={{ opacity: 0.5, textAlign: "center", padding: "40px 0", border: "1px dashed rgba(128,128,128,.4)", borderRadius: "18px" }}>
										Paste a YouTube link →
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

		Spacer: {
			label: "Space",
			fields: {
				size: {
					type: "radio",
					label: "Amount",
					options: [
						{ label: "Small", value: "24px" },
						{ label: "Medium", value: "64px" },
						{ label: "Large", value: "120px" },
					],
				},
			},
			defaultProps: { size: "64px" },
			render: ({ size }) => <div style={{ height: size }} aria-hidden="true" />,
		},
	},
};
