export const MOUNTED: Record<string, string> = {
	"mission-trips": "/mission-trips",
	"staff": "/staff",
	"giving": "/giving",
	"tap": "/tap",
	"next-steps": "/next-steps",
	"meals-of-hope": "/meals-of-hope",
	"ambassador-teams": "/ambassador-teams",
	"outreach-teams": "/outreach-teams",
	"go": "/go",
};

export const BARE = new Set(["tap", "next-steps"]);

export const pagePath = (slug: string) => MOUNTED[slug] || `/p/${slug}`;
