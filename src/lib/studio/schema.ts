// The FENCE — the only fields the AI editor is allowed to touch.
//
// This is Stage 1's safety boundary. The editor (and, later, Claude) can read
// and change ONLY the paths listed here, inside content/site.json. Everything
// else on the site — layout, styling, code, config, and any content not on
// this list — is out of reach. New editable fields are opened up by adding a
// row here, deliberately, in code.

export type EditableField = {
	/** dot-path into content/site.json, e.g. "church.tagline" or "mission.0.verb" */
	path: string;
	/** human label shown in the editor and given to the AI */
	label: string;
	/** grouping for display */
	group: string;
	/** longer copy fields render as a textarea */
	multiline?: boolean;
	/** one-line hint about what this field is / rules for it */
	hint?: string;
};

// Static (non-array) editable fields.
const STATIC_FIELDS: EditableField[] = [
	{ path: "church.name", label: "Church name", group: "Church basics" },
	{ path: "church.shortName", label: "Short name", group: "Church basics" },
	{ path: "church.tagline", label: "Tagline", group: "Church basics", hint: "The short line under the church name." },
	{ path: "church.serviceTime", label: "Service time", group: "Church basics", hint: 'e.g. "Sundays at 10am".' },
	{ path: "church.street", label: "Street address", group: "Location" },
	{ path: "church.city", label: "City", group: "Location" },
	{ path: "church.state", label: "State", group: "Location" },
	{ path: "church.zip", label: "ZIP", group: "Location" },
	{ path: "church.phone", label: "Phone", group: "Contact" },
	{ path: "church.email", label: "Email", group: "Contact" },
	{ path: "church.textToGive", label: "Text-to-give number", group: "Contact" },
];

/**
 * Build the full editable-field list against the current content, expanding
 * array-backed fields (like each mission line) to their real indices.
 */
export function editableFields(content: any): EditableField[] {
	const fields = [...STATIC_FIELDS];

	const mission = Array.isArray(content?.mission) ? content.mission : [];
	mission.forEach((m: any, i: number) => {
		fields.push({
			path: `mission.${i}.verb`,
			label: `Mission ${m?.n ?? String(i + 1).padStart(2, "0")}`,
			group: "The Mission",
			hint: "One of the five mission commitments.",
		});
	});

	return fields;
}

/** True if a dot-path is inside the fence for the given content. */
export function isEditable(content: any, path: string): boolean {
	return editableFields(content).some((f) => f.path === path);
}
