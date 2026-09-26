export const MOUNTED: Record<string, string> = {
	"mission-trips": "/mission-trips",
	"staff": "/staff",
	"giving": "/giving",
	"tap": "/links/pray",
	"next-steps": "/links/grow",
	"links": "/links",
	"new": "/links/new",
	"meals-of-hope": "/meals-of-hope",
	"ambassador-teams": "/ambassador-teams",
	"outreach-teams": "/outreach-teams",
	"go": "/go",
	"go-links": "/links/go",
};

export const BARE = new Set(["tap", "next-steps", "links", "new", "go-links"]);

export const pagePath = (slug: string) => MOUNTED[slug] || `/p/${slug}`;
