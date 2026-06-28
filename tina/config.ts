import { defineConfig } from "tinacms";

// Local editing works out of the box: `npm run cms` serves the editor at /admin.
// To let staff edit the LIVE site, connect a (free) Tina Cloud project and set
// TINA_CLIENT_ID + TINA_TOKEN — then editing commits to GitHub and Cloudflare rebuilds.
const branch = process.env.TINA_BRANCH || process.env.CF_PAGES_BRANCH || process.env.HEAD || "main";

export default defineConfig({
	branch,
	clientId: process.env.TINA_CLIENT_ID || "",
	token: process.env.TINA_TOKEN || "",
	build: { outputFolder: "admin", publicFolder: "public" },
	media: { tina: { mediaRoot: "art", publicFolder: "public" } },
	schema: {
		collections: [
			{
				name: "site",
				label: "Site Content",
				path: "content",
				format: "json",
				match: { include: "site" },
				ui: { allowedActions: { create: false, delete: false } },
				fields: [
					{
						type: "object",
						name: "church",
						label: "Church Info",
						fields: [
							{ type: "string", name: "name", label: "Church Name" },
							{ type: "string", name: "shortName", label: "Short Name" },
							{ type: "string", name: "tagline", label: "Tagline" },
							{ type: "string", name: "serviceTime", label: "Service Time" },
							{ type: "string", name: "street", label: "Street Address" },
							{ type: "string", name: "city", label: "City" },
							{ type: "string", name: "state", label: "State" },
							{ type: "string", name: "zip", label: "ZIP" },
							{ type: "string", name: "phone", label: "Phone" },
							{ type: "string", name: "email", label: "Email" },
							{ type: "string", name: "textToGive", label: "Text-to-Give Number" },
						],
					},
					{
						type: "object",
						name: "mission",
						label: "Mission Statements",
						list: true,
						ui: { itemProps: (item) => ({ label: item ? `${item.n} — ${item.verb}` : "Mission" }) },
						fields: [
							{ type: "string", name: "n", label: "Number (01–05)" },
							{ type: "string", name: "verb", label: "Statement" },
							{
								type: "string",
								name: "pillar",
								label: "Belongs to",
								options: [
									{ value: "encounter-god", label: "Encounter God" },
									{ value: "be-transformed", label: "Be Transformed" },
									{ value: "change-the-world", label: "Change the World" },
								],
							},
						],
					},
					{
						type: "object",
						name: "sermons",
						label: "Recent Services",
						list: true,
						ui: { itemProps: (item) => ({ label: item ? `${item.title} ${item.date || ""}` : "Service" }) },
						fields: [
							{ type: "string", name: "id", label: "YouTube Video ID" },
							{ type: "string", name: "title", label: "Title" },
							{ type: "string", name: "date", label: "Date" },
							{ type: "string", name: "tag", label: "Tag" },
						],
					},
				],
			},
		],
	},
});
