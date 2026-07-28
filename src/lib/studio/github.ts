// GitHub-backed persistence for production. On Vercel the filesystem is
// read-only, so saves commit straight to the repo's main branch via the
// GitHub API — Vercel then rebuilds and the change goes live (~1–2 min).
//
// Needs env: GITHUB_TOKEN (repo write), GITHUB_REPO ("owner/name").

type FileChange = {
	/** repo-relative path, e.g. "content/pages/foo.json" */
	path: string;
	/** utf8 content — omit when deleting */
	content?: string;
	/** base64 content for binary files (takes precedence over content) */
	contentBase64?: string;
	/** delete the file instead of writing it */
	remove?: boolean;
};

function config() {
	const token = process.env.GITHUB_TOKEN;
	const repo = process.env.GITHUB_REPO || "jonhazeltine/unifygr";
	if (!token) throw new Error("Saving on the live site isn't set up yet (missing GitHub access).");
	return { token, repo };
}

async function gh(path: string, token: string, init?: RequestInit): Promise<any> {
	const res = await fetch(`https://api.github.com${path}`, {
		...init,
		headers: {
			authorization: `Bearer ${token}`,
			accept: "application/vnd.github+json",
			"user-agent": "unifygr-studio",
			...(init?.headers || {}),
		},
	});
	if (!res.ok) throw new Error(`GitHub ${init?.method || "GET"} ${path} → ${res.status}: ${(await res.text()).slice(0, 200)}`);
	return res.json();
}

/**
 * Commit a set of file changes to main in one commit (git data API, so
 * multi-file saves are atomic). Returns the commit sha.
 */
export async function commitToMain(changes: FileChange[], message: string): Promise<string> {
	const { token, repo } = config();

	const ref = await gh(`/repos/${repo}/git/ref/heads/main`, token);
	const baseSha = ref.object.sha;
	const baseCommit = await gh(`/repos/${repo}/git/commits/${baseSha}`, token);

	const tree: any[] = [];
	for (const c of changes) {
		if (c.remove) {
			tree.push({ path: c.path, mode: "100644", type: "blob", sha: null });
		} else if (c.contentBase64 != null) {
			const blob = await gh(`/repos/${repo}/git/blobs`, token, {
				method: "POST",
				body: JSON.stringify({ content: c.contentBase64, encoding: "base64" }),
			});
			tree.push({ path: c.path, mode: "100644", type: "blob", sha: blob.sha });
		} else {
			tree.push({ path: c.path, mode: "100644", type: "blob", content: c.content ?? "" });
		}
	}

	const newTree = await gh(`/repos/${repo}/git/trees`, token, {
		method: "POST",
		body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree }),
	});
	const commit = await gh(`/repos/${repo}/git/commits`, token, {
		method: "POST",
		body: JSON.stringify({ message, tree: newTree.sha, parents: [baseSha] }),
	});
	await gh(`/repos/${repo}/git/refs/heads/main`, token, {
		method: "PATCH",
		body: JSON.stringify({ sha: commit.sha }),
	});
	return commit.sha;
}
