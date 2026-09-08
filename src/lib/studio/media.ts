// New uploads are private staging objects. A staff member must explicitly
// promote one before a page receives a public /uploads/ URL.

import { get, put } from "@vercel/blob";
import { publish, readPublished, runtimeToken, type RuntimeLocals } from "./runtime-content";

const EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg"]);
const MAX_BYTES = 8 * 1024 * 1024;
const INDEX = "studio/media/published.json";
const BUNDLED_KEYS = [
	...Object.keys(import.meta.glob("../../../public/art/**/*.{png,jpg,jpeg,webp,avif,gif,svg}")),
	...Object.keys(import.meta.glob("../../../public/uploads/**/*.{png,jpg,jpeg,webp,avif,gif,svg}")),
].map((key) => key.replace(/^.*\/public\//, "/"));

function safeFile(name: string): string {
	const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
	if (!EXT.has(ext)) throw new Error("Images only (png, jpg, webp, gif, svg).");
	const base = name.slice(0, -ext.length).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "image";
	return `${base}-${Date.now().toString(36)}${ext}`;
}

export async function listSiteImages(locals?: RuntimeLocals): Promise<string[]> {
	const saved = await readPublished(INDEX, [] as string[], locals);
	return [...new Set([...BUNDLED_KEYS, ...saved.value])].sort();
}

export async function saveUpload(name: string, dataBase64: string, locals?: RuntimeLocals): Promise<{ stageId: string }> {
	const token = runtimeToken(locals);
	if (!token) throw new Error("Runtime content storage is not configured on this deployment.");
	const file = safeFile(String(name));
	const data = String(dataBase64).replace(/^data:[^,]+,/, "");
	const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
	if (!bytes.length) throw new Error("Empty file.");
	if (bytes.length > MAX_BYTES) throw new Error("Too big — keep images under 8 MB.");
	await put(`studio/media/staged/${file}`, new Blob([bytes]), { access: "private", addRandomSuffix: false, token });
	return { stageId: file };
}

export async function promoteUpload(stageId: string, locals?: RuntimeLocals): Promise<{ src: string; via: "runtime" }> {
	const token = runtimeToken(locals);
	if (!token) throw new Error("Runtime content storage is not configured on this deployment.");
	if (!/^[a-z0-9-]+\.(png|jpe?g|webp|avif|gif|svg)$/i.test(stageId)) throw new Error("Unknown staged upload.");
	const staged = await get(`studio/media/staged/${stageId}`, { access: "private", useCache: false, token });
	if (!staged) throw new Error("That staged upload is no longer available.");
	if (!staged.stream) throw new Error("The staged upload could not be read.");
	await put(`studio/media/published/${stageId}`, await new Response(staged.stream).blob(), { access: "private", addRandomSuffix: false, token });
	const current = await readPublished(INDEX, [] as string[], locals);
	const src = `/uploads/${stageId}`;
	if (!current.value.includes(src)) await publish(INDEX, [src, ...current.value], [] as string[], current.version, locals);
	return { src, via: "runtime" };
}

export async function publishedUpload(file: string, locals?: RuntimeLocals) {
	const token = runtimeToken(locals);
	if (!token || !/^[a-z0-9-]+\.(png|jpe?g|webp|avif|gif|svg)$/i.test(file)) return null;
	return get(`studio/media/published/${file}`, { access: "private", useCache: true, token });
}
