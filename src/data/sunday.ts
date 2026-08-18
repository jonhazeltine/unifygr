// Everything a stranger needs to decide whether to come on Sunday.
//
// One rule for this file: only put a fact here if someone at New Life has
// confirmed it. A wrong answer about parking or kids is worse than no answer,
// because the person finds out standing in the lobby. Questions we cannot
// answer yet live in `unanswered` below and show on the Sunday page as open
// questions rather than being quietly left out.

export const service = {
	day: "Sunday",
	time: "10am",
	/** Used wherever the answer has to fit on one line. */
	shortWhen: "Sundays at 10am",
	length: "About 90 minutes",
	street: "2777 Knapp St NE",
	city: "Grand Rapids",
	state: "MI",
	zip: "49525",
	area: "Knapp's Corner",
};

/** The questions people actually ask, in the order they ask them. */
export const answers = [
	{
		q: "When is it?",
		a: "Sunday mornings at 10. One service. Plan on about 90 minutes.",
		key: true,
	},
	{
		q: "Where is it?",
		a: "2777 Knapp St NE, Grand Rapids — out at Knapp's Corner.",
		key: true,
	},
	{
		q: "What do people wear?",
		a: "Whatever you want. There is no dress code and nobody is checking.",
		key: true,
	},
	{
		q: "What about my kids?",
		a: "Nursery through 5th grade have their own space, their own teaching, and adults who learn their names. Check in at the kids desk when you arrive and someone will walk you through it.",
		key: true,
	},
	{
		q: "Do I have to do anything?",
		a: "No. You can sit in the back, not sing, not sign anything, and leave when it ends. Nobody will single you out.",
		key: true,
	},
	{
		q: "Can I watch first?",
		a: "Yes. Every Sunday service goes up on our YouTube channel, and you can watch a few before you decide to drive over.",
		key: false,
	},
];

/**
 * Real questions we cannot answer honestly yet. They render on the Sunday page
 * as an open list so the gap is visible instead of invisible. Delete each one
 * as its answer lands in `answers` above.
 */
export const unanswered = [
	"Where do I park, and which door do I come in?",
	"What is the music like, and how long does it last?",
	"How long is the teaching, and who usually does it?",
	"Is there coffee, and is there anywhere to go if my baby is loud?",
	"What happens if I show up late?",
	"Is the building accessible, and where are the accessible spaces?",
];

/** Two sentences on who these people are — for someone who will not read an essay. */
export const identity = {
	line: "Jesus Christ — crucified, risen, and Lord.",
	body: "That is the whole foundation, and it is deliberately the only thing we make everyone agree on. People here hold real convictions about baptism, the end times and everything else, and they do not all land in the same place. We would rather talk that through with you across a table than hand you a position paper.",
};
