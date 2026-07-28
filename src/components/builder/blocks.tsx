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
				cards: [
					{ title: "First", text: "Something true." },
					{ title: "Second", text: "Something good." },
				],
			},
			render: ({ eyebrow, title, cards }) => (
				<section className="section prose-block">
					<div className="container">
						{eyebrow ? <p className="eyebrow reveal is-visible">{eyebrow}</p> : null}
						{title ? <h2 className="prose-block__title reveal is-visible">{title}</h2> : null}
						<div style={{ display: "grid", gap: "18px", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginTop: "18px" }}>
							{(cards || []).map((c: any, i: number) => (
								<div className="command-card reveal is-visible" key={i}>
									<span className="command-card__n">{String(i + 1).padStart(2, "0")}</span>
									<h3>{c.title}</h3>
									<p>{c.text}</p>
								</div>
							))}
						</div>
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
