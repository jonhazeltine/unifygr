// Shared helper for a forced-tool-call to the Anthropic Messages API. Both the
// fenced-field brain (brain.ts) and the full-page brain (page-brain.ts) need
// the exact same "ask for structured JSON back" shape, so it lives once here
// with one mockable seam for tests.

export type ToolCallRequest = {
	prompt: string;
	toolName: string;
	toolDescription: string;
	inputSchema: Record<string, unknown>;
	model?: string;
	maxTokens?: number;
	timeoutMs?: number;
};

let fetchImpl: typeof fetch = (...args: Parameters<typeof fetch>) => fetch(...args);

/** Test-only seam. Production always uses the real global fetch. */
export function __setAnthropicFetchForTests(next?: typeof fetch): void {
	fetchImpl = next ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
}

/**
 * Send one message to Claude with a single tool forced, and return that
 * tool's parsed `input`. Throws a plain Error (message safe to show staff in
 * small part) on any non-2xx response or a missing tool call.
 */
export async function callAnthropicTool(request: ToolCallRequest): Promise<Record<string, unknown>> {
	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");
	const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
		method: "POST",
		headers: {
			"x-api-key": apiKey,
			"anthropic-version": "2023-06-01",
			"content-type": "application/json",
		},
		body: JSON.stringify({
			model: request.model || process.env.STUDIO_API_MODEL || "claude-sonnet-5",
			max_tokens: request.maxTokens ?? 4096,
			tools: [{
				name: request.toolName,
				description: request.toolDescription,
				input_schema: request.inputSchema,
			}],
			tool_choice: { type: "tool", name: request.toolName },
			messages: [{ role: "user", content: request.prompt }],
		}),
		signal: AbortSignal.timeout(request.timeoutMs ?? 30_000),
	});
	if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 150)}`);
	const body = (await res.json()) as any;
	const tool = (body.content || []).find((c: any) => c.type === "tool_use");
	if (!tool?.input) throw new Error("Anthropic API returned no tool output.");
	return tool.input as Record<string, unknown>;
}
