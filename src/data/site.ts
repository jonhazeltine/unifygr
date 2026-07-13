// Central content for New Life GR / Unify GR.
// Structured so it can be lifted into TinaCMS collections later without
// reshaping the pages that consume it.

import siteContent from "../../content/site.json";

const c = siteContent.church;

// Editable basics come from content/site.json (managed by TinaCMS).
// Technical links (socials, CCB, giving, calendar) stay in code.
export const church = {
	name: c.name,
	shortName: c.shortName,
	tagline: c.tagline,
	serviceTime: c.serviceTime,
	address: {
		street: c.street,
		city: c.city,
		state: c.state,
		zip: c.zip,
	},
	phone: c.phone,
	email: c.email,
	mapUrl:
		"https://www.google.com/maps/place/2777+Knapp+St+NE,+Grand+Rapids,+MI+49525",
	social: {
		facebook: "https://www.facebook.com/NewLifeGr",
		instagram: "https://www.instagram.com/newlifegr/",
		twitter: "https://twitter.com/newlifegr",
		youtube: "https://www.youtube.com/@newlifegrandrapids2177",
	},
	youtube: {
		channelId: "UCBF6w9PV1WLUWao6tKoK3RA",
		handle: "@newlifegrandrapids2177",
	},
	external: {
		connectCard: "https://newlife.ccbchurch.com/goto/forms/156/responses/new",
		memberLogin: "https://newlife.ccbchurch.com",
		giveOnline: "https://app.securegive.com/NewLifeGR/new-life/donate/category",
		textToGive: c.textToGive,
		churchesCalendar: "https://thechurches.co", // multi-church shared calendar
		formationWelcome: "https://theformation.app/m/welcome-to-new-life",
	},
};

// Recent messages — the Sunday morning live services (and worship nights).
// Managed in content/site.json (TinaCMS); can be auto-synced from YouTube later.
export const sermons = siteContent.sermons;

export type PillarItem = {
	label: string;
	href: string;
	blurb: string;
};

export type Pillar = {
	slug: string;
	kicker: string; // the pillar's Mission verb
	title: string; // Encounter God ...
	essence: string;
	copy: string;
	video: string;
	poster: string;
	items: PillarItem[];
};

export const pillars: Pillar[] = [
	{
		slug: "encounter-god",
		kicker: "Host His Presence",
		title: "Encounter God",
		essence: "Host His presence.",
		copy: "We want to create an atmosphere where the Holy Spirit rests. We invite every member to engage in making this a reality in our gatherings. The Presence of God is attracted through desire, worship, obedience and service, humility, unity, and prayer and generosity.",
		video: "/art/generated/worship-ambient-v5.mp4",
		poster: "/art/generated/worship-ambient-v5-thumb.webp",
		items: [
			{ label: "Plan a Visit", href: "/visit", blurb: "What to expect on a Sunday, and how to find us." },
			{ label: "Watch & Sermons", href: "/watch", blurb: "Join live Sunday mornings or catch up on past messages." },
			{ label: "When & Where", href: "/visit#when-where", blurb: "Sundays at 10am · 2777 Knapp St NE." },
		],
	},
	{
		slug: "be-transformed",
		kicker: "Hear His Voice",
		title: "Be Transformed",
		essence: "Hear His voice. Obey His assignments.",
		copy: "We believe that personal transformation is possible! New Life is building ministries that assist in personal transformation. We also believe corporate transformation is possible — continually re-evaluating our culture, environment and behavior by asking, “How can we improve so that more glory will be given to God?”",
		video: "/art/generated/voice-ambient-v2.mp4",
		poster: "/art/generated/voice-ambient-v2-thumb.webp",
		items: [
			{ label: "What We Believe", href: "/beliefs", blurb: "The core convictions that anchor our church." },
			{ label: "Vision & Values", href: "/vision-values", blurb: "Where we're headed and what we hold dear." },
			{ label: "Spiritual Formation", href: "/spiritual-formation", blurb: "Growing deeper in Christ, day by day." },
			{ label: "Membership", href: "/membership", blurb: "Make New Life your home and family." },
			{ label: "Our Staff", href: "/staff", blurb: "Meet the team that leads and cares for our church." },
		],
	},
	{
		slug: "change-the-world",
		kicker: "Reveal Jesus to the City",
		title: "Change the World",
		essence: "Unite the Church. Reveal Jesus to the city.",
		copy: "We believe it is the calling of every believer to bring the light of heaven into every area of society — business, government, family, religion, media, education, entertainment — and to participate in the Great Commission, seeing the news of God's kindness spread throughout the world (Matthew 28:19-20).",
		video: "/art/generated/mission-ambient-v2.mp4",
		poster: "/art/generated/mission-ambient-v2-thumb.webp",
		items: [
			{ label: "Mission Trips", href: "/mission-trips", blurb: "Go and serve the Caribbean with Mission of Hope." },
			{ label: "Unify GR", href: "/unify-gr", blurb: "One Body, one witness across Grand Rapids churches." },
			{ label: "Giving", href: "/giving", blurb: "Fuel the mission online, by text, or by mail." },
			{ label: "Connect Card", href: church.external.connectCard, blurb: "Take a first step and let us know you're here." },
		],
	},
];

// ---- About content (real, captured from the live site) ----

// The Mission — five commitments that flow inward → outward, living under
// the three Vision pillars. Managed in content/site.json (TinaCMS).
export const mission = siteContent.mission;

export const vision = [
	{ title: "Encounter God", body: "We want to create an atmosphere where the Holy Spirit rests. We invite every member to engage in making this a reality in our gatherings. The Presence of God is attracted through desire, worship, obedience and service, humility, unity, and prayer and generosity." },
	{ title: "Be Transformed", body: "We believe that personal transformation is possible! New Life is building ministries that assist in personal transformation. We also believe corporate transformation is possible — continually re-evaluating our culture, environment and behavior by asking, “How can we improve so that more glory will be given to God?”" },
	{ title: "Change the World", body: "We believe it is the calling of every believer to bring the light of heaven into every area of society — business, government, family, religion, media, education, entertainment — and to participate in the Great Commission, seeing the news of God's kindness spread throughout the world (Matthew 28:19-20)." },
];

export const values = [
	{ title: "Passion for Jesus", body: "An insatiable desire for an intimate and growing relationship with Christ." },
	{ title: "Transparent Relationships", body: "Intentionally and openly connecting with God and others." },
	{ title: "Supernatural Life", body: "Accepting all of God's gifts and allowing the Holy Spirit to minister powerfully and miraculously through us." },
	{ title: "Godly Character", body: "A firm commitment to choose what is right in all that we do." },
	{ title: "Passion for People", body: "Joyfully pouring out the Father's love and blessing in our church, in our community, and around the world." },
];

// Grouped to match the real photos (couples share a portrait, as on the live site).
export const leadership = [
	{
		photo: "/art/staff/staff-1.jpg",
		people: [
			{ name: "Jon Hazeltine", role: "Senior Leader", bio: "Jon has served at New Life since 2002 — first as a worship leader, then youth pastor, then Senior Associate Pastor until 2014 when he accepted the responsibility of leading the church. Jon is a visionary and strategic thinker and the primary driver behind the direction of the church." },
			{ name: "Stacy Hazeltine", role: "Director of Missions, Church Leadership & Oversight", bio: "Stacy has been part of New Life since 1997, beginning in the youth group. Since then she has served in a myriad of roles and impacted every facet of our community. Her sensitivity to the Holy Spirit and her gift of discernment are invaluable to the New Life family." },
		],
	},
	{
		photo: "/art/staff/staff-2.jpg",
		people: [
			{ name: "Rebecca Taylor", role: "Senior Associate Leader, Director of Outreach", bio: "Rebecca has an extensive ministry background. She is an ordained minister with deep experience in community outreach. Rebecca currently directs the staff at New Life and preaches frequently." },
		],
	},
	{
		photo: "/art/staff/staff-3.jpg",
		people: [
			{ name: "Allie Seif", role: "Children's Ministry Director, Church Leadership & Oversight", bio: "Allie brings passion to everything she does. Her sensitivity to the Spirit and joyful love of the Lord make her perspective invaluable to the life of the church. She loves to minister to children and to lead the church in corporate ministry, and her creativity has inspired countless projects." },
			{ name: "Tory Seif", role: "Church Leadership & Oversight", bio: "Tory has been part of New Life for over a decade and brings a wealth of wisdom to the overall direction of the church. As a Ph.D. counselor he guides our pastoral care ministries, preaches on occasion, and brings excitement and stability to the forward momentum of the church." },
		],
	},
	{
		photo: "/art/staff/staff-elizabeth.png",
		people: [
			{ name: "Elizabeth Bish", role: "Connections Lead & Executive Administrator", bio: "Elizabeth helps people find their place in the New Life family and keeps the church running behind the scenes — connecting newcomers, caring for the details, and supporting the team in all they do." },
		],
	},
];

export const teams = {
	pastoralCare: {
		blurb: "Trusted ministers of the compassion and wisdom of Christ, responsible for the spiritual well-being of our church family. If you'd like someone to pray with you, visit you when you're sick, or simply encourage you, these are the people to call.",
		members: ["Tory & Allie Seif", "Tom & Sarah Rhein", "Bill & Sue Meyer", "Elizabeth Bish", "Tim & Diane Cosby", "Rebecca Taylor", "Jon Hazeltine"],
	},
	businessFinance: {
		blurb: "Wisdom, expertise and oversight for the management of church assets and finances — making sure provision is in place to do all that God has called us to do.",
		members: ["Jon Hazeltine", "Tom Rhein", "Rebecca Taylor", "Anne Gruber", "Tory Seif"],
	},
};

export const missionTrip = {
	headline: "Next Trip — Summer 2026",
	dates: "July 15 – 22, 2026",
	destination: "Jarabacoa, Dominican Republic",
	partner: "Mission of Hope",
	cost: "About $2,000 (7 nights / 8 days, includes airfare, lodging, food, transfers, and an end-of-trip excursion)",
	support: "Ask God if you should go! Be open to hearing from Him about whether this trip is for you — or prayerfully consider giving to help someone else GO.",
	faq: [
		{ q: "Where are we going?", a: "Jarabacoa, in the mountains of the Dominican Republic, to work with Mission of Hope." },
		{ q: "Who is Mission of Hope?", a: "A missions organization that started over 20 years ago in Haiti, working to see life transformation for every man, woman and child in Haiti, the Dominican Republic, and across the Caribbean. New Life has partnered with them since 2015." },
		{ q: "Is it safe?", a: "Yes. We chose a partner we could trust with the teams we send. Whether you're a family with young kids, a high school student, or traveling in your retirement years, it's a safe environment. Mission of Hope takes excellent care of our teams." },
		{ q: "What do we do on a trip?", a: "Each trip is shaped by the team — medical care, sports ministry, kids clubs, planting fruit trees, painting or construction, visiting orphanages, and ministering at churches." },
		{ q: "What are the lodging options?", a: "Summer-camp-style bunk rooms, separated by gender, usually each with its own bathroom. Family or special-accommodation housing can often be arranged." },
		{ q: "Do I need a passport?", a: "Yes. Start your application right away — it can take several months, and we can't buy a plane ticket without it." },
		{ q: "Are there required vaccines?", a: "None required, but ask your doctor for recommendations. Some consider Tetanus, HepA, HepB, Rabies, and Typhoid." },
		{ q: "Can I drink the water?", a: "Not from the tap, but Mission of Hope provides plenty of safe bottled water." },
	],
};
