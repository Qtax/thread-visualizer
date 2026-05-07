import type { Thread, UndoEntry, Workspace } from "./thread-visualizer-types";

export const WORKSPACES_STORAGE_KEY = "thread-visualizer-workspaces-v1";
export const ACTIVE_WORKSPACE_KEY = "thread-visualizer-active-workspace-v1";

export const MAX_UNDO_ENTRIES = 200;

/**
 * ISO timestamp of the last change to the bundled "Getting started" template.
 * Bump whenever `createInitialThreads` content changes so existing users are
 * offered an update (compared against the workspace's `createdAt`).
 */
export const GETTING_STARTED_TEMPLATE_DATE = "2026-05-07T12:00:00Z";
export const GETTING_STARTED_NAME = "Getting started";

function createInitialThreads(): Thread[] {
	return [
		{
			id: crypto.randomUUID(),
			name: "Main",
			code: [
				"Write pseudo-code in each editor.",
				"Sync tags align the code between threads and create visual connections.",
				"Use emphasis for the line where something important happens. [em]",
				"Use dim for code that does not run in this path. [dim]",
				"",
				"Monaco editors: familiar VS Code hotkeys and multi-cursor editing.",
				"Persistent edit history includes thread changes.",
				"",
				"### [sync] mutual alignment",
				"aligns with worker [sync worker]",
				"",
				"start listening",
				"receive data",
				"",
				"### [set] signal another thread",
				"send task to worker [set worker.task]",
				"",
				"### [wait] pause for a signal",
				"wait for completion [wait worker.done]",
				"",
				"shutdown()",
				"",
				"[sync error-handling]",
				"",
				"### detects cycles",
				"[wait a]",
				"[set b]",
				"",
				"### wait without set",
				"[wait set-not-found]",
				"",
				"### repeated syncs",
				"[sync worker]",
			].join("\n"),
		},
		{
			id: crypto.randomUUID(),
			name: "Worker",
			code: [
				"Add and remove threads from the tab bar.",
				"Move the threads by dragging the tabs.",
				"Comments can be made # like this",
				"",
				"### [sync] mutual alignment",
				"aligns with main [sync worker]",
				"",
				"init()",
				"\tconfig.load()",
				"\tdb.connect()",
				"\t\t# indent nested code",
				"\t\t# indentation guides",
				"",
				"### [wait] for a signal",
				"getTask [wait worker.task]",
				"get more data",
				"process task",
				"processing done [set worker.done]",
				"",
				"[sync error-handling]",
				"",
				"### detects cycles",
				"[wait b]",
				"[set a]",
				"",
				"### set without wait",
				"[set wait-not-found]",
				"",
				"### set after wait in the same thread",
				"[wait same]",
				"[set same]",
			].join("\n"),
		},
	];
}

export function createGettingStartedWorkspace(): Workspace {
	return createWorkspace(GETTING_STARTED_NAME, createInitialThreads());
}

function createCleanThreads(): Thread[] {
	return [
		{
			id: crypto.randomUUID(),
			name: "Thread 1",
			code: "",
		},
		{
			id: crypto.randomUUID(),
			name: "Thread 2",
			code: "",
		},
	];
}

export function normalizeThreads(value: unknown): Thread[] | null {
	if (!Array.isArray(value)) {
		return null;
	}

	const normalized = value
		.map((item, index) => {
			if (!item || typeof item !== "object") {
				return null;
			}

			const candidate = item as Partial<Thread>;
			const name =
				typeof candidate.name === "string" ? candidate.name : `Thread ${index + 1}`;
			const code = typeof candidate.code === "string" ? candidate.code : "";
			const id =
				typeof candidate.id === "string" && candidate.id.trim().length > 0
					? candidate.id
					: crypto.randomUUID();

			return { id, name, code } satisfies Thread;
		})
		.filter((item): item is Thread => item !== null);

	return normalized.length > 0 ? normalized : null;
}

function normalizeUndoEntries(value: unknown): UndoEntry[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.filter(
			(item): item is { threads: unknown; timestamp: number } =>
				!!item &&
				typeof item === "object" &&
				"threads" in item &&
				typeof (item as { timestamp?: unknown }).timestamp === "number"
		)
		.map((item) => {
			const threads = normalizeThreads(item.threads);
			if (!threads) return null;
			const rawCursors = (item as { cursors?: unknown }).cursors;
			let cursors: Record<string, { lineNumber: number; column: number }> | undefined;
			if (rawCursors && typeof rawCursors === "object" && !Array.isArray(rawCursors)) {
				cursors = {};
				for (const [key, value] of Object.entries(rawCursors as Record<string, unknown>)) {
					if (
						value &&
						typeof value === "object" &&
						typeof (value as { lineNumber?: unknown }).lineNumber === "number" &&
						typeof (value as { column?: unknown }).column === "number"
					) {
						cursors[key] = {
							lineNumber: (value as { lineNumber: number }).lineNumber,
							column: (value as { column: number }).column,
						};
					}
				}
			}
			const entry: UndoEntry = { threads, timestamp: item.timestamp };
			if (cursors) entry.cursors = cursors;
			return entry;
		})
		.filter((entry): entry is UndoEntry => entry !== null)
		.slice(-MAX_UNDO_ENTRIES);
}

export function createWorkspace(name: string, threads?: Thread[]): Workspace {
	const now = new Date().toISOString();
	return {
		id: crypto.randomUUID(),
		name,
		createdAt: now,
		updatedAt: now,
		threads: threads ?? createCleanThreads(),
		undoStack: [],
		redoStack: [],
	};
}

function normalizeWorkspace(item: unknown): Workspace | null {
	if (!item || typeof item !== "object") {
		return null;
	}

	const candidate = item as Partial<Workspace>;
	const id =
		typeof candidate.id === "string" && candidate.id.trim().length > 0
			? candidate.id
			: crypto.randomUUID();
	const name =
		typeof candidate.name === "string" && candidate.name.trim().length > 0
			? candidate.name.trim()
			: "Untitled";
	const threads = normalizeThreads(candidate.threads);
	if (!threads) {
		return null;
	}

	const now = new Date().toISOString();
	const createdAt =
		typeof candidate.createdAt === "string" && candidate.createdAt ? candidate.createdAt : now;
	const updatedAt =
		typeof candidate.updatedAt === "string" && candidate.updatedAt ? candidate.updatedAt : now;

	return {
		id,
		name,
		createdAt,
		updatedAt,
		threads,
		undoStack: normalizeUndoEntries(candidate.undoStack),
		redoStack: normalizeUndoEntries(candidate.redoStack),
	};
}

// --- Workspace persistence ---

export function loadWorkspaces(): { workspaces: Workspace[]; activeId: string } {
	if (typeof window === "undefined") {
		const initial = createGettingStartedWorkspace();
		return { workspaces: [initial], activeId: initial.id };
	}

	// Allow ?reset in the URL to wipe all state and start fresh.
	if (new URLSearchParams(window.location.search).has("reset")) {
		window.localStorage.removeItem(WORKSPACES_STORAGE_KEY);
		window.localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
		window.history.replaceState(null, "", window.location.pathname);
	}

	try {
		const raw = window.localStorage.getItem(WORKSPACES_STORAGE_KEY);
		if (!raw) {
			const initial = createGettingStartedWorkspace();
			return { workspaces: [initial], activeId: initial.id };
		}

		const parsed = JSON.parse(raw) as unknown[];
		const workspaces = parsed
			.map(normalizeWorkspace)
			.filter((item): item is Workspace => item !== null);

		if (workspaces.length === 0) {
			const initial = createGettingStartedWorkspace();
			return { workspaces: [initial], activeId: initial.id };
		}

		const savedActiveId = window.localStorage.getItem(ACTIVE_WORKSPACE_KEY) ?? "";
		const activeId = workspaces.some((workspace) => workspace.id === savedActiveId)
			? savedActiveId
			: workspaces[0].id;

		return { workspaces, activeId };
	} catch {
		const initial = createGettingStartedWorkspace();
		return { workspaces: [initial], activeId: initial.id };
	}
}

export function persistWorkspaces(workspaces: Workspace[]) {
	if (typeof window === "undefined") {
		return;
	}

	window.localStorage.setItem(WORKSPACES_STORAGE_KEY, JSON.stringify(workspaces));
}

export function persistActiveWorkspaceId(id: string) {
	if (typeof window === "undefined") {
		return;
	}

	window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
}
