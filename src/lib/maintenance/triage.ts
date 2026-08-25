// Reads an incoming resident text and decides whether it is a maintenance
// request — and if so, what to call it and how urgent it is.
//
// Residents text about all sorts of things: a broken furnace, but also
// housemate arrangements, thank-yous and questions. Only some of that should
// become a task, so this is a judgement call rather than a keyword match.
//
// With no ANTHROPIC_API_KEY configured the module makes no judgement at all
// and says a person should look — never the reverse. Guessing "not a
// maintenance request" would quietly drop a broken furnace on the floor.

import Anthropic from "@anthropic-ai/sdk";

export type Triage = {
	isRequest: boolean;
	title: string;
	summary: string;
	urgency: "emergency" | "soon" | "whenever";
	needsHuman: boolean;
	reason: string;
};

const SYSTEM = [
	"You read text messages sent by residents living in houses owned by a church, and decide whether each one is a maintenance or repair request that should become a task for the facilities team.",
	"",
	"It IS a request when the resident is reporting something broken, missing, unsafe, or needing attention in the house — appliances, plumbing, heating, pests, supplies the church provides, locks, damage.",
	"It is NOT a request when the resident is discussing living arrangements or housemates, answering a previous question, saying thanks, making small talk, or asking something a person should simply answer.",
	"",
	"Mark urgency 'emergency' only for things that are unsafe or cannot wait overnight — no heat in winter, no water, flooding, gas, electrical, a door that will not lock.",
	"Set needsHuman true whenever you are genuinely unsure, or when the message needs a judgement a task cannot capture. It is much better to have a person look than to guess wrong in either direction.",
	"Write the title as a short, plain description of the problem — 'Water softener out of salt', not 'Resident texted about salt'.",
].join("\n");

const FORMAT = {
	type: "json_schema" as const,
	schema: {
		type: "object",
		properties: {
			isRequest: { type: "boolean" },
			title: { type: "string" },
			summary: { type: "string" },
			urgency: { type: "string", enum: ["emergency", "soon", "whenever"] },
			needsHuman: { type: "boolean" },
			reason: { type: "string" },
		},
		required: ["isRequest", "title", "summary", "urgency", "needsHuman", "reason"],
		additionalProperties: false,
	},
};

export function triageConfigured(): boolean {
	return Boolean(process.env.ANTHROPIC_API_KEY);
}

const unreadable = (reason: string): Triage => ({
	isRequest: false,
	title: "",
	summary: "",
	urgency: "soon",
	needsHuman: true,
	reason,
});

export async function triage(input: {
	text: string;
	from: string;
	house: string | null;
	recentContext?: string[];
}): Promise<Triage> {
	if (!triageConfigured()) {
		return unreadable("No AI key is configured, so nothing was judged automatically.");
	}

	const client = new Anthropic();
	const context = input.recentContext?.length
		? `\n\nEarlier in this conversation (most recent last):\n${input.recentContext.join("\n")}`
		: "";

	try {
		const res = await client.messages.create({
			model: "claude-opus-5",
			max_tokens: 1024,
			system: SYSTEM,
			output_config: { format: FORMAT, effort: "low" },
			messages: [
				{
					role: "user",
					content: `A resident${input.house ? ` in ${input.house}` : ""} texted:\n\n"${input.text}"${context}`,
				},
			],
		});

		if (res.stop_reason === "refusal") {
			return unreadable("The message could not be assessed automatically.");
		}
		const block = res.content.find((b) => b.type === "text");
		if (!block || block.type !== "text") return unreadable("No usable answer came back.");
		return { ...(JSON.parse(block.text) as Triage) };
	} catch (err) {
		return unreadable(
			`Automatic reading failed: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
}
