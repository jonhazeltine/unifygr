// The Studio Directory tab's "is this ministry locked" rule, pulled out of
// the tab's client script so it can be unit tested without a browser.
//
// It mirrors src/lib/partners/directory.ts `churchTicked()`/`churchRoster()`
// exactly, but reads the in-page, possibly-unsaved `settings` object instead
// of a snapshot fetched once from `/api/partners/orgs` — a church toggled
// earlier in the same Studio session (ticked, unticked, or declined) must
// lock or unlock its ministries immediately, without a reload.

export type LockRosterPartner = { churchId: string; approved: boolean; on: boolean };
export type LockRosterDeclined = { churchId: string };

/**
 * A declined church has no row in `partners` at all (see settings.ts
 * `normalise()` — "a church cannot be both carried and refused"), so it is
 * checked first and explicitly: without that check a declined church's
 * ministries would find no match and read as unlocked.
 */
export function churchTickedLive(partners: LockRosterPartner[], declined: LockRosterDeclined[], churchId: string): boolean {
	if (declined.some((d) => d.churchId === churchId)) return false;
	const partner = partners.find((p) => p.churchId === churchId);
	return Boolean(partner && partner.approved && partner.on);
}

/**
 * The lock only ever refuses to turn a ministry ON. It never blocks an
 * unrelated field — confirming (the star) is independent of whether the
 * ministry is publicly selectable — and it never blocks turning a ministry
 * OFF, or a patch that doesn't touch `listed` at all.
 */
export function orgEditAllowed(locked: boolean, patch: { listed?: boolean; confirmed?: boolean }): boolean {
	return !(locked && patch.listed === true);
}
