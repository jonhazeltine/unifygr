// The kinds of gathering The Church Map sorts events into, and what each one
// means on our own pages.
//
// The Church Map does the sorting upstream: every event it publishes arrives
// already tagged with one theme. These are those themes, given the words New
// Life would use for them, and pointed at the ministry categories where each
// kind of gathering belongs.

/** The Church Map's theme keys, in the order they read best in a list. */
export const THEMES = [
	"youth",
	"kids",
	"young_adults",
	"womens",
	"mens",
	"family",
	"seniors",
	"bible_study",
	"class_training",
	"prayer",
	"worship_music",
	"sunday_service",
	"serve_outreach",
	"missions_trip",
	"care_support",
	"fellowship_food",
	"sports_recreation",
	"arts_culture",
	"liturgical",
	"other",
] as const;

export type Theme = (typeof THEMES)[number];

export const THEME_LABEL: Record<string, string> = {
	youth: "Youth",
	kids: "Kids",
	young_adults: "Young adults",
	womens: "Women",
	mens: "Men",
	family: "Family",
	seniors: "Seniors",
	bible_study: "Bible study",
	class_training: "Classes",
	prayer: "Prayer",
	worship_music: "Worship",
	sunday_service: "Sunday service",
	serve_outreach: "Serve",
	missions_trip: "Mission trips",
	care_support: "Care & support",
	fellowship_food: "Food & fellowship",
	sports_recreation: "Sport",
	arts_culture: "Arts",
	liturgical: "Liturgical",
	other: "Everything else",
};

/** A plain sentence for each kind, so the panel explains itself. */
export const THEME_NOTE: Record<string, string> = {
	youth: "Middle and high school gatherings.",
	kids: "Children's ministry, midweek clubs, VBS.",
	young_adults: "College age and twenties.",
	womens: "Women's studies, groups and events.",
	mens: "Men's studies, breakfasts and groups.",
	family: "Whole-family gatherings and parenting.",
	seniors: "Senior adult gatherings.",
	bible_study: "Studies and small groups.",
	class_training: "Classes, training and equipping.",
	prayer: "Prayer meetings and intercession.",
	worship_music: "Worship nights and music.",
	sunday_service: "Sunday morning services.",
	serve_outreach: "Serve days and local outreach.",
	missions_trip: "Mission trips and short-term teams.",
	care_support: "Grief, recovery and support groups.",
	fellowship_food: "Meals, potlucks and fellowship.",
	sports_recreation: "Leagues, walks and recreation.",
	arts_culture: "Concerts, art and performance.",
	liturgical: "Feast days and liturgical observances.",
	other: "Anything that fits nowhere else.",
};

/** Which of our ministry categories a theme's gatherings belong on. */
export const THEME_CATEGORIES: Record<string, string[]> = {
	youth: ["high-school", "middle-school"],
	kids: ["childrens-ministry", "nursery"],
	young_adults: ["young-adults"],
	womens: ["womens-ministry", "womens-bible-study"],
	mens: ["mens-ministry"],
	prayer: ["prayer-meetings", "intercession"],
	bible_study: ["bible-study"],
	worship_music: ["worship-nights", "corporate-worship"],
	sunday_service: ["corporate-worship"],
	family: ["parenting"],
	seniors: ["senior-adults"],
	serve_outreach: ["local-outreach"],
	care_support: ["grief-support"],
	class_training: ["discipleship-groups"],
	sports_recreation: ["adult-sports"],
	arts_culture: ["arts-ministry"],
	missions_trip: ["short-term-missions"],
	fellowship_food: ["small-groups"],
};

export function themeLabel(theme: string): string {
	return THEME_LABEL[theme] || theme.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}
