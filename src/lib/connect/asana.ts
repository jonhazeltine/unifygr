// Creates the staff follow-up task in Asana for a Connect Card submission.
//
// Auth is a personal access token (ASANA_TOKEN). Until that token is set the
// module reports itself as unconfigured rather than throwing — a submission
// must still reach CCB and still be recorded, and the task can be created
// later from the admin page's retry.

const API = "https://app.asana.com/api/1.0";

export function asanaConfigured(): boolean {
	return Boolean(process.env.ASANA_TOKEN && process.env.ASANA_PROJECT_ID);
}

export class AsanaError extends Error {}

async function call(path: string, body: unknown): Promise<any> {
	const res = await fetch(`${API}${path}`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${process.env.ASANA_TOKEN}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ data: body }),
	});
	const json = await res.json().catch(() => ({}));
	if (!res.ok) {
		const msg = json?.errors?.[0]?.message ?? `Asana returned HTTP ${res.status}`;
		throw new AsanaError(msg);
	}
	return json.data;
}

export type AsanaTask = { gid: string; url: string };

export async function createFollowUpTask(input: {
	name: string;
	notes: string;
	dueOn: string;
	/** Target a different project than the Connect Card one (e.g. a house). */
	projectId?: string;
	/** Column to drop the task into, when the caller names its own project. */
	sectionId?: string;
}): Promise<AsanaTask> {
	if (!input.projectId && !asanaConfigured()) throw new AsanaError("Asana is not connected yet.");
	if (!process.env.ASANA_TOKEN) throw new AsanaError("Asana is not connected yet.");

	const projectId = input.projectId ?? String(process.env.ASANA_PROJECT_ID);
	// The "New" column belongs to the Connect Card project only; a caller with
	// its own project names its own column.
	const sectionId = input.projectId ? input.sectionId : process.env.ASANA_SECTION_ID;

	const task = await call("/tasks", {
		name: input.name,
		notes: input.notes,
		due_on: input.dueOn,
		projects: [projectId],
	});

	// Placing the task in the "New" column is a nicety — a task that lands in
	// the project's default column is still a task, so never fail over this.
	if (sectionId) {
		try {
			await call(`/sections/${sectionId}/addTask`, { task: task.gid });
		} catch {
			/* leave it in the default column */
		}
	}

	return { gid: task.gid, url: task.permalink_url ?? `https://app.asana.com/0/${projectId}/${task.gid}` };
}
