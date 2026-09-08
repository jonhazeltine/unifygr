// Durable runtime content for the Studio. The repository files are seeds only:
// hosted edits are kept out of Git so an ordinary content save never triggers a
// deployment. The implementation deliberately uses a small Blob-shaped seam so
// it can move from Vercel Blob to R2 without changing the Studio or public
// readers.

import { get, list, put } from "@vercel/blob";

export type RuntimeLocals = Record<string, any> | undefined;

export type Stored<T> = {
	value: T;
	version: string;
	publishedAt: string;
};

export class ContentConflict extends Error {
	constructor() {
		super("This content changed while you were editing it. Refresh and review the latest copy before publishing.");
	}
}

export function runtimeToken(locals?: RuntimeLocals): string | undefined {
	return locals?.runtime?.env?.BLOB_READ_WRITE_TOKEN;
}

function version(): string {
	return `${new Date().toISOString().replace(/[-:.TZ]/g, "")}-${crypto.randomUUID().slice(0, 8)}`;
}

async function read<T>(key: string, fallback: T, locals?: RuntimeLocals): Promise<Stored<T>> {
	const accessToken = runtimeToken(locals);
	if (!accessToken) return { value: fallback, version: "seed", publishedAt: "" };
	try {
		const found = await get(key, { access: "private", useCache: false, token: accessToken });
		if (!found) return { value: fallback, version: "seed", publishedAt: "" };
		return JSON.parse(await new Response(found.stream).text()) as Stored<T>;
	} catch {
		// The committed seed keeps the public site readable if storage is unavailable.
		return { value: fallback, version: "seed", publishedAt: "" };
	}
}

async function write<T>(key: string, value: T, expectedVersion: string | undefined, fallback: T, locals?: RuntimeLocals): Promise<Stored<T>> {
	const accessToken = runtimeToken(locals);
	if (!accessToken) throw new Error("Runtime content storage is not configured on this deployment.");
	const current = await read(key, fallback, locals);
	if (expectedVersion && expectedVersion !== current.version) throw new ContentConflict();
	const next: Stored<T> = { value, version: version(), publishedAt: new Date().toISOString() };
	// Blob versions are immutable audit records; the published pointer is the only
	// mutable key. The expected-version check prevents stale editor publishes.
	await put(`studio/revisions/${key}/${next.version}.json`, JSON.stringify({ ...next, previousVersion: current.version }), {
		access: "private", contentType: "application/json", addRandomSuffix: false, token: accessToken,
	});
	await put(key, JSON.stringify(next), {
		access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, token: accessToken,
	});
	return next;
}

export async function readPublished<T>(key: string, fallback: T, locals?: RuntimeLocals): Promise<Stored<T>> {
	return read(key, fallback, locals);
}

export async function publish<T>(key: string, value: T, fallback: T, expectedVersion?: string, locals?: RuntimeLocals): Promise<Stored<T>> {
	return write(key, value, expectedVersion, fallback, locals);
}

export async function revisions(key: string, locals?: RuntimeLocals): Promise<string[]> {
	const accessToken = runtimeToken(locals);
	if (!accessToken) return [];
	const result = await list({ prefix: `studio/revisions/${key}/`, token: accessToken, limit: 500 });
	return result.blobs.map((blob) => blob.pathname).sort().reverse();
}

export async function readRevision<T>(path: string, locals?: RuntimeLocals): Promise<(Stored<T> & { previousVersion?: string }) | null> {
	const accessToken = runtimeToken(locals);
	if (!accessToken) return null;
	const found = await get(path, { access: "private", useCache: false, token: accessToken });
	return found ? JSON.parse(await new Response(found.stream).text()) : null;
}
