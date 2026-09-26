export const MOUNTED: Record<string, string> = {
	"mission-trips": "/mission-trips",
	"staff": "/staff",
	"giving": "/giving",
	"tap": "/links/pray",
	"next-steps": "/links/next-steps",
	"links": "/links",
	"meals-of-hope": "/meals-of-hope",
	"ambassador-teams": "/ambassador-teams",
	"outreach-teams": "/outreach-teams",
	"go": "/go",
};

export const BARE = new Set(["tap", "next-steps", "links"]);

export const pagePath = (slug: string) => MOUNTED[slug] || `/p/${slug}`;
