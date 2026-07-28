// Shared media-library logic: list the site's images (existing art + staff
// uploads) and save new uploads. Used by the media API and the AI co-editor
// (so the AI can place real images, never invented paths).

import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["public/art", "public/uploads"];
const EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg"]);
const MAX_BYTES = 8 * 1024 * 1024;

async function walk(dir: string, out: string[]): Promise<void> {
	let entries;
	try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
	for (const e of entries) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) await walk(p, out);
		else if (EXT.has(path.extname(e.name).toLowerCase())) out.push(p);
	}
}

/** All site images as web paths ("/art/…", "/uploads/…"). */
export async function listSiteImages(): Promise<string[]> {
	const files: string[] = [];
	for (const d of SCAN_DIRS) await walk(path.join(ROOT, d), files);
	return files
		.map((f) => "/" + path.relative(path.join(ROOT, "public"), f).split(path.sep).join("/"))
		.sort();
}

/** Save an uploaded image to public/uploads/. Returns its web path. */
export async function saveUpload(name: string, dataBase64: string): Promise<string> {
	const ext = path.extname(String(name)).toLowerCase();
	if (!EXT.has(ext)) throw new Error("Images only (png, jpg, webp, gif, svg).");

	const base = path.basename(String(name), ext).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "image";
	const buf = Buffer.from(String(dataBase64).replace(/^data:[^,]+,/, ""), "base64");
	if (buf.length === 0) throw new Error("Empty file.");
	if (buf.length > MAX_BYTES) throw new Error("Too big — keep images under 8 MB.");

	const dir = path.join(ROOT, "public", "uploads");
	await fs.mkdir(dir, { recursive: true });
	const file = `${base}-${Date.now().toString(36)}${ext}`;
	await fs.writeFile(path.join(dir, file), buf);
	return `/uploads/${file}`;
}
