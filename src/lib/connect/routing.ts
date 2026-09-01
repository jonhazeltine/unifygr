// What a Connect Card submission means, and where each interest is routed.
//
// THE ORDER MATTERS. CCB is the CRM; Planning Center is the scheduler. Every
// submission reaches CCB first — that is the person's record, and it is what
// syncs across. Only then does a serving sign-up open a card in Planning
// Center, and only ever a card: a leader still decides, and nobody is added to
// a team automatically. Never write to Planning Center before CCB; that would
// put someone in the scheduler who does not exist in the CRM.
//
// A queue is only worth filing into if somebody opens it. Most of CCB's are
// not worked (see queueId below), so most interests deliberately have none —
// the person still lands in CCB, and the Asana task is what staff actually
// see. Filing into a dead queue is worse than not filing: it looks handled.
//
// `scheduler` names the Planning Center team an interest ends up on and rides
// along on the Asana task, because the hand-add after approval is the step
// where people fall on the floor. The Ambassador rota sat empty through next
// February while the grocery rota, seeded by hand in January, carries
// seventeen people.

export type Interest = {
	/** value stored on the submission */
	id: string;
	/** what the person reads on the form */
	label: string;
	/**
	 * The heading this sits under on the form. Eleven flat radios was a wall on
	 * a phone, and four of them said the same thing four ways.
	 */
	group: string;
	/**
	 * A second-level choice, shown only once someone has said they want to
	 * serve. Routing is unchanged — these are still their own interests, with
	 * their own Asana titles — they just stop shouting from the top level.
	 */
	underServe?: true;
	/** CCB process this queue belongs to (for the admin display) */
	process: string;
	/**
	 * CCB queue the person is dropped into — ONLY where a human actually works
	 * that queue. Checked against the live account 2026-09-01: pastoral care is
	 * worked (Initial Contact holds 604 people, 594 closed out, by Sue Meyer,
	 * Jon and Sarah Rhein), and 1st Connect Call has real completions. The rest
	 * are dead — Small Group and Growth Track hold nobody at all, Prayer and
	 * Interested in Serving held one untouched test each. Leave queueId off for
	 * those: the person still reaches CCB, and the Asana task is what a staff
	 * member actually sees. Re-check before adding one back.
	 */
	queueId?: number;
	/** how the Asana task is titled */
	action: string;
	/** days from submission for the Asana due date */
	dueInDays: number;
	/**
	 * The Planning Center team this person joins AFTER staff approve them in
	 * CCB, written out for the Asana task. Omitted where no team exists yet.
	 */
	scheduler?: { team: string; serviceType: string };
	/**
	 * True for the interests that mean "I want to serve". These also open a
	 * card on the Planning Center serving workflow — after CCB, never instead
	 * of it — so a leader picks them up where they already schedule from.
	 */
	serving?: true;
};

export const INTERESTS: Interest[] = [
	{
		id: "first-time",
		group: "New here",
		label: "I'm new — I'd like someone to reach out",
		process: "Connections – Direct and Connect",
		queueId: 178, // 1st Connect Call
		action: "First connect call",
		dueInDays: 2,
	},
	{
		id: "jesus",
		group: "A step with Jesus",
		label: "I want to know Jesus, or I've made a decision",
		process: "Connections – New Believers",
		// No queueId: CCB's "Launch new Believer Drip" is dead — empty but for one untouched entry (checked 2026-09-01).
		action: "New believer follow-up",
		dueInDays: 1,
	},
	{
		id: "baptism",
		group: "A step with Jesus",
		label: "I'd like to be baptized",
		process: "Connections – Direct and Connect",
		// No queueId: CCB's "Water Baptism" is dead — only admin accounts, three stalled (checked 2026-09-01).
		action: "Baptism follow-up",
		dueInDays: 3,
	},
	{
		id: "prayer",
		group: "Prayer and care",
		label: "I have a prayer request",
		process: "Connections – Direct and Connect",
		// No queueId: CCB's "Prayer" is dead — one untouched test entry (checked 2026-09-01).
		action: "Prayer request",
		dueInDays: 1,
	},
	{
		id: "care",
		group: "Prayer and care",
		label: "I need to talk to a pastor",
		process: "Pastoral Care Connect",
		queueId: 99, // Initial Contact
		action: "Pastoral care — initial contact",
		dueInDays: 1,
	},
	{
		id: "serve",
		group: "Serving and going",
		serving: true,
		label: "I want to serve or go with a team",
		process: "Connections – Direct and Connect",
		// No queueId: CCB's "Interested in Serving" is dead — one untouched test entry (checked 2026-09-01).
		action: "Serving interest",
		dueInDays: 5,
	},
	{
		// The three ways we go. Each carries its own Asana task title so staff can
		// tell a church visit from a mission trip from a serve day at a glance.
		id: "ambassador",
		underServe: true,
		group: "Serving and going",
		serving: true,
		label: "An Ambassador Team — visiting another church",
		process: "Connections – Direct and Connect",
		// No queueId: CCB's "Interested in Serving" is dead — one untouched test entry (checked 2026-09-01).
		action: "Ambassador Team interest",
		dueInDays: 5,
		scheduler: { team: "Ambassador Team", serviceType: "Church Ambassador Teams" },
	},
	{
		id: "missions",
		underServe: true,
		group: "Serving and going",
		serving: true,
		label: "A Missions Team — overseas",
		process: "Connections – Direct and Connect",
		// No queueId: CCB's "Interested in Serving" is dead — one untouched test entry (checked 2026-09-01).
		action: "Missions Team interest",
		dueInDays: 5,
		// No Planning Center team — a trip roster is not a Sunday rota.
	},
	{
		id: "outreach",
		underServe: true,
		group: "Serving and going",
		serving: true,
		label: "An Outreach Team — serving our city",
		process: "Connections – Direct and Connect",
		// No queueId: CCB's "Interested in Serving" is dead — one untouched test entry (checked 2026-09-01).
		action: "Outreach Team interest",
		dueInDays: 5,
		scheduler: { team: "Grocery Deliveries", serviceType: "Hospitality & Connections" },
	},
	{
		id: "group",
		group: "Getting connected",
		label: "Join a life group",
		process: "Connections – Direct and Connect",
		// No queueId: CCB's "Invitation to Small Group" is dead — nobody in it at all (checked 2026-09-01).
		action: "Life group invitation",
		dueInDays: 5,
	},
	{
		id: "growth-track",
		group: "Getting connected",
		label: "Take the next step (Growth Track)",
		process: "Growth Track",
		// No queueId: CCB's "101" is dead — nobody in it at all (checked 2026-09-01).
		action: "Growth Track 101",
		dueInDays: 5,
	},
];

export function interestById(id: string): Interest | undefined {
	return INTERESTS.find((i) => i.id === id);
}

/** The queue a submission routes to when no interest was picked. */
export const DEFAULT_INTEREST = INTERESTS[0];
