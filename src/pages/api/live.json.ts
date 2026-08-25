import { church } from "../../data/site";
import { fetchChannelVideos } from "../../lib/youtube";

// On-demand (server) route — checks the YouTube channel's live status and the
// latest uploads, server-side (no CORS). Cached briefly at the edge.
export const prerender = false;

export async function GET() {
	const channelId = church.youtube.channelId;
	let live = false;
	let liveId: string | null = null;

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

	// Recent uploads via the public RSS feed (no API key).
	const videos = await fetchChannelVideos(channelId, 8);
	const latestId = videos[0]?.id ?? null;

	return new Response(JSON.stringify({ live, liveId, latestId, videos }), {
		headers: {
			"content-type": "application/json",
			"cache-control": "public, max-age=120",
		},
	});
}
