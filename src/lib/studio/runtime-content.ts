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

type BlobDriver = { get: typeof get; put: typeof put; list: typeof list };
let driver: BlobDriver = { get, put, list };

/** Test-only seam. Production always uses the Vercel Blob SDK. */
export function __setRuntimeContentDriverForTests(next?: BlobDriver): void {
	driver = next ?? { get, put, list };
}

export function runtimeToken(locals?: RuntimeLocals): string | undefined {
	return locals?.runtime?.env?.BLOB_READ_WRITE_TOKEN;
}

function version(): string {
	return `${new Date().toISOString().replace(/[-:.TZ]/g, "")}-${crypto.randomUUID().slice(0, 8)}`;
}

type ReadStored<T> = Stored<T> & { etag?: string; exists: boolean };

async function read<T>(key: string, fallback: T, locals?: RuntimeLocals): Promise<ReadStored<T>> {
	const accessToken = runtimeToken(locals);
	if (!accessToken) return { value: fallback, version: "seed", publishedAt: "", exists: false };
	const found = await driver.get(key, { access: "private", useCache: false, token: accessToken });
	if (!found) return { value: fallback, version: "seed", publishedAt: "", exists: false };
	if (found.statusCode !== 200 || !found.stream) throw new Error("Content storage returned an incomplete response.");
	return { ...(JSON.parse(await new Response(found.stream).text()) as Stored<T>), etag: found.blob.etag, exists: true };
}

async function write<T>(key: string, value: T, expectedVersion: string | undefined, fallback: T, locals?: RuntimeLocals): Promise<Stored<T>> {
	const accessToken = runtimeToken(locals);
	if (!accessToken) throw new Error("Runtime content storage is not configured on this deployment.");
	const current = await read(key, fallback, locals);
	if (expectedVersion && expectedVersion !== current.version) throw new ContentConflict();
	if (!current.exists) {
		// The seed is a real first revision, so the very first publish can undo.
		await driver.put(`studio/revisions/${key}/seed.json`, JSON.stringify({ value: fallback, version: "seed", publishedAt: "", previousVersion: null }), {
			access: "private", contentType: "application/json", addRandomSuffix: false, token: accessToken,
		}).catch(() => {});
	}
	const next: Stored<T> = { value, version: version(), publishedAt: new Date().toISOString() };
	await driver.put(`studio/revisions/${key}/${next.version}.json`, JSON.stringify({ ...next, previousVersion: current.version }), {
		access: "private", contentType: "application/json", addRandomSuffix: false, token: accessToken,
	});
	try {
		await driver.put(key, JSON.stringify(next), {
			access: "private", contentType: "application/json", addRandomSuffix: false,
			...(current.exists ? { ifMatch: current.etag! } : { allowOverwrite: false }), token: accessToken,
		});
	} catch (error) {
		if ((error as Error)?.name === "BlobPreconditionFailedError" || current.exists) throw new ContentConflict();
		throw error;
	}
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
	const result = await driver.list({ prefix: `studio/revisions/${key}/`, token: accessToken, limit: 500 });
	return result.blobs.map((blob) => blob.pathname).sort().reverse();
}

export async function readRevision<T>(path: string, locals?: RuntimeLocals): Promise<(Stored<T> & { previousVersion?: string }) | null> {
	const accessToken = runtimeToken(locals);
	if (!accessToken) return null;
	const found = await driver.get(path, { access: "private", useCache: false, token: accessToken });
	return found ? JSON.parse(await new Response(found.stream).text()) : null;
}

/** Move the published pointer to an existing immutable revision using CAS. */
export async function restorePublished<T>(key: string, revision: Stored<T>, expectedVersion: string, locals?: RuntimeLocals): Promise<void> {
	const accessToken = runtimeToken(locals);
	if (!accessToken) throw new Error("Runtime content storage is not configured on this deployment.");
	const current = await read(key, revision.value, locals);
	if (current.version !== expectedVersion || !current.etag) throw new ContentConflict();
	try {
		await driver.put(key, JSON.stringify(revision), {
			access: "private", contentType: "application/json", addRandomSuffix: false, ifMatch: current.etag, token: accessToken,
		});
	} catch {
		throw new ContentConflict();
	}
}
