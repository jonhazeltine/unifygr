// The church's Clearstream tools, as a connector staff can add to Claude.
//
// Each person gets their own URL. The token in the path says who they are and
// what they're allowed to do, so access is revoked by removing their entry —
// no shared password to rotate. Claude Team has no way to give a connector to
// some members and not others, which is exactly why the permission lives here.
//
// Speaks MCP over HTTP: one JSON-RPC request in, one JSON response out.

export const prerender = false;

import type { APIRoute } from "astro";
import { toolsFor, runTool, type Permissions } from "../../../lib/clearstream/tools";

const rpc = (id: unknown, result: unknown) =>
	new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
		headers: { "content-type": "application/json" },
	});

const rpcError = (id: unknown, code: number, message: string) =>
	new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }), {
		headers: { "content-type": "application/json" },
	});

/** CLEARSTREAM_MCP_USERS maps each person's token to who they are. */
function whoIs(token: string | undefined): Permissions | null {
	if (!token) return null;
	let users: Record<string, { name: string; canSendToLists?: boolean }> = {};
	try {
		users = JSON.parse(process.env.CLEARSTREAM_MCP_USERS || "{}");
	} catch {
		return null;
	}
	const entry = users[token];
	if (!entry) return null;
	return { name: entry.name, canSendToLists: Boolean(entry.canSendToLists) };
}

export const POST: APIRoute = async ({ request, params }) => {
	const perms = whoIs(params.token);
	if (!perms) return new Response(JSON.stringify({ error: "Not found." }), { status: 404 });

	const msg: any = await request.json().catch(() => null);
	if (!msg) return rpcError(null, -32700, "Could not read that request.");
	const { id, method } = msg;

	if (method === "initialize") {
		return rpc(id, {
			protocolVersion: msg.params?.protocolVersion ?? "2024-11-05",
			capabilities: { tools: {} },
			serverInfo: { name: "New Life texting", version: "1.0.0" },
		});
	}
	if (typeof method === "string" && method.startsWith("notifications/")) {
		return new Response(null, { status: 202 });
	}
	if (method === "ping") return rpc(id, {});
	if (method === "tools/list") return rpc(id, { tools: toolsFor(perms) });

	if (method === "tools/call") {
		const name = msg.params?.name;
		const allowed = toolsFor(perms).some((t) => t.name === name);
		const result = allowed
			? await runTool(name, msg.params?.arguments ?? {}, perms).catch((err) => ({
					error: err instanceof Error ? err.message : String(err),
				}))
			: { error: `That tool isn't available to you (${perms.name}).` };
		return rpc(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
	}

	return rpcError(id, -32601, `Method not found: ${method}`);
};

// A plain visit should say nothing useful about whether a token is real.
export const GET: APIRoute = () =>
	new Response(JSON.stringify({ error: "Not found." }), { status: 404 });
