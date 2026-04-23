import type { SavedState, Thread, UndoEntry, Workspace } from "./thread-visualizer-types";

// Legacy keys (read-only for migration)
export const STORAGE_KEY = "thread-call-path-visualizer-state-v2";
export const SAVES_STORAGE_KEY = "thread-call-path-visualizer-saves-v1";

// New workspace keys
export const WORKSPACES_STORAGE_KEY = "thread-visualizer-workspaces-v1";
export const ACTIVE_WORKSPACE_KEY = "thread-visualizer-active-workspace-v1";

export const MAX_UNDO_ENTRIES = 200;

export function createCleanThreads(): Thread[] {
	return [
		{
			id: crypto.randomUUID(),
			name: "Thread A",
			code: "",
		},
		{
			id: crypto.randomUUID(),
			name: "Thread B",
			code: "",
		},
	];
}

function createInitialThreads(): Thread[] {
	return [
		{
			id: crypto.randomUUID(),
			name: "Main",
			code: [
				"Write pseudocode in each editor.",
				"Sync tags create visual connections.",
				"",
				"── [sync] mutual alignment ──",
				"setup()",
				"[sync initialized] aligns with Worker",
				"begin work",
				"",
				"── [set] signal another thread ──",
				"compute()",
				"[set result-ready] continues immediately",
				"wrap up local work",
				"",
				"── [wait] pause for a signal ──",
				"[wait cleanup-done] waits for Worker",
				"shutdown()",
			].join("\n"),
		},
		{
			id: crypto.randomUUID(),
			name: "Worker",
			code: [
				"Add and remove threads from the tab bar.",
				"Move the threads by dragging the tabs.",
				"# Anything after # is treated as a comment",
				"",
				"── [sync] mutual alignment ──",
				"load config",
				"load plugins",
				"[sync initialized] aligns with Main",
				"start listening",
				"",
				"── [wait] pause for a signal ──",
				"[wait result-ready] waits for Main",
				"process result",
				"",
				"── [set] signal another thread ──",
				"flush caches",
				"[set cleanup-done] signals Main",
				"exit",
			].join("\n"),
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

// --- Legacy loaders (for migration) ---

function loadLegacyThreads(): Thread[] | null {
	if (typeof window === "undefined") {
		return null;
	}

	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return null;
		}

		const parsed = JSON.parse(raw) as { threads?: unknown };
		return normalizeThreads(parsed.threads);
	} catch {
		return null;
	}
}

function loadLegacySavedStates(): SavedState[] {
	if (typeof window === "undefined") {
		return [];
	}

	try {
		const raw = window.localStorage.getItem(SAVES_STORAGE_KEY);
		if (!raw) {
			return [];
		}

		const parsed = JSON.parse(raw) as { saves?: unknown } | unknown;
		const items =
			parsed && typeof parsed === "object" && "saves" in parsed
				? (parsed as { saves?: unknown }).saves
				: parsed;

		if (!Array.isArray(items)) {
			return [];
		}

		return items
			.map((item) => {
				if (!item || typeof item !== "object") {
					return null;
				}

				const candidate = item as Partial<SavedState>;
				const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
				const threads = normalizeThreads(candidate.threads);
				if (!name || !threads) {
					return null;
				}

				const createdAt =
					typeof candidate.createdAt === "string" && candidate.createdAt
						? candidate.createdAt
						: new Date().toISOString();
				const updatedAt =
					typeof candidate.updatedAt === "string" && candidate.updatedAt
						? candidate.updatedAt
						: createdAt;

				return {
					id:
						typeof candidate.id === "string" && candidate.id.trim().length > 0
							? candidate.id
							: crypto.randomUUID(),
					name,
					createdAt,
					updatedAt,
					threads,
				} satisfies SavedState;
			})
			.filter((item): item is SavedState => item !== null);
	} catch {
		return [];
	}
}

// --- Workspace persistence ---

function threadsAreEmpty(threads: Thread[]): boolean {
	return threads.every((thread) => thread.code.trim() === "");
}

function migrateFromLegacy(): { workspaces: Workspace[]; activeId: string } {
	const workspaces: Workspace[] = [];
	const now = new Date().toISOString();

	// Migrate saved states → workspaces
	const savedStates = loadLegacySavedStates();
	for (const saved of savedStates) {
		workspaces.push({
			id: saved.id,
			name: saved.name,
			createdAt: saved.createdAt,
			updatedAt: saved.updatedAt,
			threads: saved.threads,
			undoStack: [],
			redoStack: [],
		});
	}

	// Migrate current working threads → workspace
	const legacyThreads = loadLegacyThreads();
	if (legacyThreads && !threadsAreEmpty(legacyThreads)) {
		const currentWorkspace: Workspace = {
			id: crypto.randomUUID(),
			name: "Current",
			createdAt: now,
			updatedAt: now,
			threads: legacyThreads,
			undoStack: [],
			redoStack: [],
		};
		workspaces.unshift(currentWorkspace);
	}

	// If nothing migrated, create initial workspace
	if (workspaces.length === 0) {
		const initial = createWorkspace("Getting started", createInitialThreads());
		workspaces.push(initial);
	}

	const activeId = workspaces[0].id;
	return { workspaces, activeId };
}

export function loadWorkspaces(): { workspaces: Workspace[]; activeId: string } {
	if (typeof window === "undefined") {
		const initial = createWorkspace("Getting started", createInitialThreads());
		return { workspaces: [initial], activeId: initial.id };
	}

	// Allow ?reset in the URL to wipe all state and start fresh.
	if (new URLSearchParams(window.location.search).has("reset")) {
		window.localStorage.removeItem(WORKSPACES_STORAGE_KEY);
		window.localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
		window.localStorage.removeItem(STORAGE_KEY);
		window.localStorage.removeItem(SAVES_STORAGE_KEY);
		window.history.replaceState(null, "", window.location.pathname);
	}

	try {
		const raw = window.localStorage.getItem(WORKSPACES_STORAGE_KEY);
		if (!raw) {
			// Try migration
			const migrated = migrateFromLegacy();
			persistWorkspaces(migrated.workspaces);
			persistActiveWorkspaceId(migrated.activeId);
			return migrated;
		}

		const parsed = JSON.parse(raw) as unknown[];
		const workspaces = parsed
			.map(normalizeWorkspace)
			.filter((item): item is Workspace => item !== null);

		if (workspaces.length === 0) {
			const initial = createWorkspace("Getting started", createInitialThreads());
			return { workspaces: [initial], activeId: initial.id };
		}

		const savedActiveId = window.localStorage.getItem(ACTIVE_WORKSPACE_KEY) ?? "";
		const activeId = workspaces.some((workspace) => workspace.id === savedActiveId)
			? savedActiveId
			: workspaces[0].id;

		return { workspaces, activeId };
	} catch {
		const initial = createWorkspace("Getting started", createInitialThreads());
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

function createInitialThreads_static(): Thread[] {
	return createInitialThreads();
}

export { createInitialThreads_static as createInitialThreads };
