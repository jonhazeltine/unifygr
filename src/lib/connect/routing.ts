// What a Connect Card submission means, and where each interest is routed.
//
// Every interest maps to a real CCB follow-up queue (verified against the live
// CCB account) and to the wording staff will see on the Asana task. Queue ids
// are stable in CCB; if a queue is ever renamed the id keeps working.

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
