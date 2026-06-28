import { church } from "../../data/site";

// On-demand (server) route — checks the YouTube channel's live status and the
// latest upload, server-side (no CORS). Cached briefly at the edge.
export const prerender = false;

export async function GET() {
	const channelId = church.youtube.channelId;
	let live = false;
	let liveId: string | null = null;
	let latestId: string | null = null;

	// Live check: the channel /live page exposes hlsManifestUrl + isLive when broadcasting.
	try {
		const res = await fetch(`https://www.youtube.com/channel/${channelId}/live`, {
			headers: { "accept-language": "en-US", "user-agent": "Mozilla/5.0" },
		});
		const html = await res.text();
		// Only "isLiveNow":true means currently broadcasting. ("isLive":true and
		// hlsManifestUrl also appear on ENDED streams, so they can't be trusted.)
		if (/"isLiveNow":true/.test(html)) {
			live = true;
			const m = html.match(/"videoId":"([0-9A-Za-z_-]{11})"/);
			liveId = m ? m[1] : null;
		}
	} catch {
		/* ignore — fall back to latest */
	}

	// Latest upload via the public RSS feed (no API key).
	try {
		const rss = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
		const xml = await rss.text();
		const m = xml.match(/<yt:videoId>([0-9A-Za-z_-]{11})<\/yt:videoId>/);
		latestId = m ? m[1] : null;
	} catch {
		/* ignore */
	}

	return new Response(JSON.stringify({ live, liveId, latestId }), {
		headers: {
			"content-type": "application/json",
			"cache-control": "public, max-age=120",
		},
	});
}
