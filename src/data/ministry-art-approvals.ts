// Jon approved these exact concepts on 2026-09-08. Each WebP is an optimized
// extraction of the approved review-board panel; no image was regenerated.
// Any new or regenerated concept needs its own approval.
export type ApprovedFamilyArt = {
	aspectRatio: string;
};

export const approvedFamilyArt: Partial<Record<string, ApprovedFamilyArt>> = {
	kids: { aspectRatio: "730 / 425" },
	students: { aspectRatio: "730 / 425" },
	"foster-adoption": { aspectRatio: "730 / 436" },
	"marriage-family": { aspectRatio: "730 / 436" },
	formation: { aspectRatio: "735 / 420" },
	seniors: { aspectRatio: "735 / 420" },
	recovery: { aspectRatio: "746 / 433" },
	"mental-health": { aspectRatio: "746 / 433" },
	"practical-care": { aspectRatio: "746 / 424" },
};
