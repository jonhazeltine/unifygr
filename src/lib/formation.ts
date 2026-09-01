// The Formation App — New Life's own community inside it.
//
// New Life's spiritual formation runs in The Formation App (theformation.app),
// a separate product of Jon's. Our community there is `unifygr`, and the modules
// it publishes are read live so this page follows the app rather than a copy of
// it: publish a module in the app and it turns up here.
//
// Read with the app's ANON key, which is the same key its own web client ships
// to every browser — the rows we ask for are the ones its public community page
// already serves to the world. Nothing here can see anything a visitor to
// theformation.app/c/unifygr could not.
//
// Needs env: FORMATION_SUPABASE_URL, FORMATION_SUPABASE_ANON_KEY.

export const FORMATION_APP = "https://theformation.app";
/** New Life's community. The link a person follows to join it. */
export const COMMUNITY_SLUG = "unifygr";
export const COMMUNITY_URL = `${FORMATION_APP}/c/${COMMUNITY_SLUG}`;

export type FormationModule = {
	title: string;
	description: string | null;
	slug: string | null;
	image: string | null;
	/** Lessons a person can see without joining, and the total. */
	lessons: number;
	openLessons: number;
	href: string;
};

export type Formation = {
	modules: FormationModule[];
	/** true when the app could not be reached and this is the written fallback */
	stale: boolean;
	/** why, when it is stale — emitted as an HTML comment so a failure is findable */
	reason?: string;
};

// One fetch serves every render for a few minutes. Modules change when somebody
// publishes one, which is rare.
const TTL_MS = 10 * 60 * 1000;
let cached: { at: number; value: Formation } | null = null;

function env(name: string): string | undefined {
	return process.env[name] || (import.meta as any).env?.[name];
}

// What the page shows if the app is unreachable. Written down rather than
// guessed: this is the module New Life publishes today.
const FALLBACK: FormationModule[] = [
	{
		title: "Welcome to New Life",
		description: "Understanding the heart and foundation of New Life.",
		slug: "welcome-to-new-life",
		image: null,
		lessons: 5,
		openLessons: 1,
		href: `${FORMATION_APP}/m/welcome-to-new-life`,
	},
];

async function fetchModules(): Promise<Formation> {
	const url = env("FORMATION_SUPABASE_URL")?.replace(/\/+$/, "");
	const key = env("FORMATION_SUPABASE_ANON_KEY");
	if (!url || !key)
		return {
			modules: FALLBACK,
			stale: true,
			reason: `missing env: ${!url ? "FORMATION_SUPABASE_URL " : ""}${!key ? "FORMATION_SUPABASE_ANON_KEY" : ""}`.trim(),
		};

	const headers = { apikey: key, authorization: `Bearer ${key}` };
	const get = async (path: string) => {
		const res = await fetch(`${url}/rest/v1/${path}`, {
			headers,
			signal: AbortSignal.timeout(8000),
		});
		if (!res.ok) throw new Error(`The Formation App returned ${res.status}`);
		return res.json();
	};

	const community = await get(
		`communities?select=id&public_slug=eq.${COMMUNITY_SLUG}&limit=1`,
	);
	const id = community?.[0]?.id;
	if (!id) throw new Error("New Life's community was not found in the app");

	const areas = await get(
		`journey_areas?select=title,description,public_slug,background_image_url,display_order,levels:journey_levels(public_visibility)` +
			`&community_id=eq.${id}&is_public=eq.true&order=display_order`,
	);

	const modules: FormationModule[] = (areas || []).map((a: any) => {
		const levels: any[] = a.levels || [];
		return {
			title: a.title,
			description: a.description ?? null,
			slug: a.public_slug ?? null,
			image: a.background_image_url ?? null,
			lessons: levels.filter((l) => l.public_visibility !== "hidden").length,
			openLessons: levels.filter((l) => l.public_visibility === "visible").length,
			href: a.public_slug ? `${FORMATION_APP}/m/${a.public_slug}` : COMMUNITY_URL,
		};
	});

	return { modules: modules.length ? modules : FALLBACK, stale: false };
}

/** New Life's published modules. Never throws — falls back to what we know. */
export async function formation(): Promise<Formation> {
	if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
	try {
		const value = await fetchModules();
		cached = { at: Date.now(), value };
		return value;
	} catch (err: any) {
		return { modules: FALLBACK, stale: true, reason: String(err?.message || err).slice(0, 200) };
	}
}
