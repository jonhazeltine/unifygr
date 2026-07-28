// The block kit for the visual builder — every block renders with the site's
// own CSS classes (global.css), so anything staff assemble looks native to
// the site. This config drives BOTH the drag-and-drop editor (Puck) and the
// server-side render of published pages (/p/<slug>).
//
// Adding a block: add a component here AND add its name to ALLOWED_BLOCKS in
// src/lib/studio/pages.ts (the fence), then it's available everywhere.

import type { Config } from "@measured/puck";

// Split a textarea into paragraphs on blank lines.
function paras(text: string) {
	return String(text || "")
		.split(/\n\s*\n/)
		.map((p) => p.trim())
		.filter(Boolean);
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
