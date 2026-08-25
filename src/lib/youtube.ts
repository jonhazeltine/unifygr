// Recent uploads for a YouTube channel, read from the public RSS feed
// (no API key, no quota). Used by the Watch page and /api/live.json so the
// "Recent Services" grid stays current on its own instead of waiting for
// someone to hand-edit the list in the Studio.

export type ChannelVideo = {
	id: string;
	title: string;
	date: string;
	tag: string;
	publishedAt: string;
};

const FEED = (channelId: string) =>
	`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

const decode = (s: string) =>
	s
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, "&")
		.trim();

// "New Life Church - Sunday Morning 08/23/2026" -> "Sunday Morning Service"
function cleanTitle(raw: string): string {
	let t = raw
		.replace(/^\s*New Life(\s+(Church|Grand Rapids))?\s*[-–—|:]\s*/i, "")
		.replace(/\s*[-–—|]?\s*\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\s*$/, "")
		.trim();
	if (!t) t = raw.trim();
	if (/^sunday( morning)?$/i.test(t)) t = "Sunday Morning Service";
	return t;
}

function tagFor(title: string): string {
	if (/worship night/i.test(title)) return "Worship Night";
	if (/sunday/i.test(title)) return "Sunday Service";
	if (/prayer/i.test(title)) return "Prayer";
	if (/christmas|easter|good friday/i.test(title)) return "Special Service";
	return "Message";
}

function formatDate(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	return new Intl.DateTimeFormat("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
		timeZone: "America/Detroit",
	}).format(d);
}

export function parseChannelFeed(xml: string, limit = 8): ChannelVideo[] {
	const out: ChannelVideo[] = [];
	const entries = xml.split("<entry>").slice(1);
	for (const entry of entries) {
		const id = entry.match(/<yt:videoId>([0-9A-Za-z_-]{11})<\/yt:videoId>/)?.[1];
		if (!id) continue;
		const rawTitle = decode(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
		const publishedAt = entry.match(/<published>([^<]+)<\/published>/)?.[1] ?? "";
		const title = cleanTitle(rawTitle) || "Sunday Morning Service";
		out.push({ id, title, date: formatDate(publishedAt), tag: tagFor(rawTitle), publishedAt });
		if (out.length >= limit) break;
	}
	return out;
}

export async function fetchChannelVideos(
	channelId: string,
	limit = 8,
	timeoutMs = 3000,
): Promise<ChannelVideo[]> {
	try {
		const res = await fetch(FEED(channelId), { signal: AbortSignal.timeout(timeoutMs) });
		if (!res.ok) return [];
		return parseChannelFeed(await res.text(), limit);
	} catch {
		return [];
	}
}
