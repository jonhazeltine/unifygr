// What a Connect Card submission means, and where each interest is routed.
//
// Every interest maps to a real CCB follow-up queue (verified against the live
// CCB account) and to the wording staff will see on the Asana task. Queue ids
// are stable in CCB; if a queue is ever renamed the id keeps working.
//
// THE ORDER MATTERS. CCB is the CRM; Planning Center is the scheduler. Nobody
// enters through the scheduler. A person arrives here, lands in CCB, is worked
// by a human in a CCB queue, and only then is added to a Planning Center team
// — by hand, by that team's leader. The website never writes to Planning
// Center, and it never should: doing so would create a person there who does
// not exist in the CRM.
//
// `scheduler` is what makes that handoff visible. It rides along on the Asana
// task so whoever approves someone reads the next step instead of remembering
// it. That step is where people fall on the floor: the Ambassador team has an
// empty rota through next February while the grocery rota, seeded by hand in
// January, has seventeen people on it.

export type Interest = {
	/** value stored on the submission */
	id: string;
	/** what the person reads on the form */
	label: string;
	/** CCB process this queue belongs to (for the admin display) */
	process: string;
	/** CCB queue the person is dropped into */
	queueId: number;
	/** how the Asana task is titled */
	action: string;
	/** days from submission for the Asana due date */
	dueInDays: number;
	/**
	 * The Planning Center team this person joins AFTER staff approve them in
	 * CCB, written out for the Asana task. Omitted where no team exists yet.
	 */
	scheduler?: { team: string; serviceType: string };
};

export const INTERESTS: Interest[] = [
	{
		id: "first-time",
		label: "I'm new here — I'd like someone to reach out",
		process: "Connections – Direct and Connect",
		queueId: 178, // 1st Connect Call
		action: "First connect call",
		dueInDays: 2,
	},
	{
		id: "jesus",
		label: "I want to know Jesus / I made a decision",
		process: "Connections – New Believers",
		queueId: 144, // Launch new Believer Drip
		action: "New believer follow-up",
		dueInDays: 1,
	},
	{
		id: "baptism",
		label: "I'd like to be baptized",
		process: "Connections – Direct and Connect",
		queueId: 106, // Water Baptism
		action: "Baptism follow-up",
		dueInDays: 3,
	},
	{
		id: "prayer",
		label: "I have a prayer request",
		process: "Connections – Direct and Connect",
		queueId: 108, // Prayer
		action: "Prayer request",
		dueInDays: 1,
	},
	{
		id: "care",
		label: "I need to talk to a pastor",
		process: "Pastoral Care Connect",
		queueId: 99, // Initial Contact
		action: "Pastoral care — initial contact",
		dueInDays: 1,
	},
	{
		id: "serve",
		label: "I want to serve on a team",
		process: "Connections – Direct and Connect",
		queueId: 111, // Interested in Serving
		action: "Serving interest",
		dueInDays: 5,
	},
	{
		// The three ways we go. None of them has its own CCB queue, so all three
		// ride the serving queue — but each carries a different Asana task title
		// so staff can tell a church visit from a mission trip from a serve day
		// without opening the task.
		id: "ambassador",
		label: "I want to go with an Ambassador Team to another church",
		process: "Connections – Direct and Connect",
		queueId: 111, // Interested in Serving
		action: "Ambassador Team interest",
		dueInDays: 5,
		scheduler: { team: "Ambassador Team", serviceType: "Church Ambassador Teams" },
	},
	{
		id: "missions",
		label: "I want to go on a Missions Team (overseas)",
		process: "Connections – Direct and Connect",
		queueId: 111, // Interested in Serving
		action: "Missions Team interest",
		dueInDays: 5,
		// No Planning Center team — a trip roster is not a Sunday rota.
	},
	{
		id: "outreach",
		label: "I want to serve our city with an Outreach Team",
		process: "Connections – Direct and Connect",
		queueId: 111, // Interested in Serving
		action: "Outreach Team interest",
		dueInDays: 5,
		scheduler: { team: "Grocery Deliveries", serviceType: "Hospitality & Connections" },
	},
	{
		id: "group",
		label: "I'd like to join a life group",
		process: "Connections – Direct and Connect",
		queueId: 112, // Invitation to Small Group
		action: "Life group invitation",
		dueInDays: 5,
	},
	{
		id: "growth-track",
		label: "I want to take the next step (Growth Track)",
		process: "Growth Track",
		queueId: 199, // 101
		action: "Growth Track 101",
		dueInDays: 5,
	},
];

export function interestById(id: string): Interest | undefined {
	return INTERESTS.find((i) => i.id === id);
}

/** The queue a submission routes to when no interest was picked. */
export const DEFAULT_INTEREST = INTERESTS[0];
