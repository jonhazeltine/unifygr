// Pure helpers behind the "one scroll surface" embed panels (see
// MountedPage.astro's "nlgr-embed-height" message listener, and the
// height-posting scripts in ConnectEmbed.astro / Interior.astro). Kept out of
// the inline <script> so the clamping and source-matching logic — the two
// things most likely to regress silently — are unit-testable without a DOM.

export const MIN_EMBED_HEIGHT = 160;
export const MAX_EMBED_HEIGHT = 20000;

/** Clamp a reported iframe document height to a sane range. A tiny or
 * negative value (a bad measurement, or a message from something that isn't
 * really one of our panels) never collapses the panel to nothing; the
 * maximum is a sanity bound only (frames we control should never need an
 * internal scrollbar, even a long page like Growth Track), not a real
 * ceiling on page length. */
export function clampEmbedHeight(height: number, min = MIN_EMBED_HEIGHT, max = MAX_EMBED_HEIGHT): number {
	return Math.min(Math.max(Math.round(height), min), max);
}

export interface EmbedHeightMessage {
	type?: unknown;
	height?: unknown;
}

/** Parses a postMessage payload into a finite, positive height, or null if
 * it isn't a well-formed "nlgr-embed-height" message. */
export function parseEmbedHeightMessage(data: unknown): number | null {
	const msg = data as EmbedHeightMessage | null | undefined;
	if (!msg || msg.type !== "nlgr-embed-height") return null;
	const height = Number(msg.height);
	if (!Number.isFinite(height) || height <= 0) return null;
	return height;
}

export interface EmbedFrameRef {
	contentWindow: unknown;
}

/** Finds which of the page's embed iframes actually sent this message, by
 * object identity against the postMessage event's `source` — never by
 * string-matching `event.origin`. That's what lets the same listener accept
 * a message from our own ?embed=1 pages AND (once wired up) a
 * thechurchmap.com frame with no origin allowlist to maintain: a message
 * only matches if it came from a window this page itself put in an iframe. */
export function findEmbedFrame<T extends EmbedFrameRef>(frames: readonly T[], source: unknown): T | null {
	if (source == null) return null;
	for (const frame of frames) {
		if (frame.contentWindow === source) return frame;
	}
	return null;
}
