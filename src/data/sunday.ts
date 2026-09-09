// Everything a stranger needs to decide whether to come on Sunday.
//
// One rule for this file: only put a fact here if someone at New Life has
// confirmed it. A wrong answer about parking or kids is worse than no answer,
// because the person finds out standing in the lobby.

export const service = {
	length: "About 90 minutes",
	area: "Knapp's Corner",
};

type ChurchVisit = {
	serviceTime: string;
	address: { street: string; city: string; state: string; zip: string };
};

/** Combine live Studio fields with the visit details that are not editable. */
export function serviceForChurch(church: ChurchVisit) {
	return { ...service, shortWhen: church.serviceTime, ...church.address };
}

/** Split the configured service time for the large two-line home heading. */
export function serviceTimeHeading(serviceTime: string): { lead: string; emphasis: string } {
	const match = serviceTime.trim().match(/^(.*?)\s+(at\s+.+)$/i);
	return match ? { lead: match[1], emphasis: match[2] } : { lead: serviceTime, emphasis: "" };
}

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
];

export function answersForChurch(church: ChurchVisit) {
	const visit = serviceForChurch(church);
	return answers.map((answer) => {
		if (answer.q === "When is it?") return { ...answer, a: `${visit.shortWhen}. One service. Plan on ${visit.length.toLowerCase()}.` };
		if (answer.q === "Where is it?") return { ...answer, a: `${visit.street}, ${visit.city}, ${visit.state} ${visit.zip} — out at ${visit.area}.` };
		return answer;
	});
}

/** Two sentences on who these people are — for someone who will not read an essay. */
export const identity = {
	line: "Jesus Christ — crucified, risen, and Lord.",
	body: "That is the whole foundation. People here hold real convictions about baptism, the end times and everything else, and they do not all land in the same place. We would rather talk that through with you across a table than hand you a position paper.",
};
