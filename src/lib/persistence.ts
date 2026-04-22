import type { SavedState, Thread } from "./thread-visualizer-types";

export const STORAGE_KEY = "thread-call-path-visualizer-state-v2";
export const SAVES_STORAGE_KEY = "thread-call-path-visualizer-saves-v1";

function createInitialThreads(): Thread[] {
	return [
		{
			id: crypto.randomUUID(),
			name: "Thread A",
			code: [
				"boot()",
				"prepare request context",
				"[sync ready] wait until worker is initialized",
				"send request",
				"do local work while response is processing",
				"[sync commit] wait for shared state flush",
				"complete()",
			].join("\n"),
		},
		{
			id: crypto.randomUUID(),
			name: "Thread B",
			code: [
				"boot()",
				"load worker config",
				"init worker",
				"[sync ready] signal that requests can start",
				"process request",
				"persist shared state",
				"[sync commit] signal commit done",
				"cleanup()",
			].join("\n"),
		},
	];
}

const INITIAL_THREADS = createInitialThreads();

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

export function loadThreads(): Thread[] {
	if (typeof window === "undefined") {
		return INITIAL_THREADS;
	}

	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return INITIAL_THREADS;
		}

		const parsed = JSON.parse(raw) as { threads?: unknown };
		return normalizeThreads(parsed.threads) ?? INITIAL_THREADS;
	} catch {
		return INITIAL_THREADS;
	}
}

export function normalizeSavedStates(value: unknown): SavedState[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
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
		.filter((item): item is SavedState => item !== null)
		.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function loadSavedStates(): SavedState[] {
	if (typeof window === "undefined") {
		return [];
	}

	try {
		const raw = window.localStorage.getItem(SAVES_STORAGE_KEY);
		if (!raw) {
			return [];
		}

		const parsed = JSON.parse(raw) as { saves?: unknown } | unknown;
		if (parsed && typeof parsed === "object" && "saves" in parsed) {
			return normalizeSavedStates((parsed as { saves?: unknown }).saves);
		}

		return normalizeSavedStates(parsed);
	} catch {
		return [];
	}
}

export function persistThreads(threads: Thread[]) {
	if (typeof window === "undefined") {
		return;
	}

	window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ threads }));
}

export function persistSavedStates(savedStates: SavedState[]) {
	if (typeof window === "undefined") {
		return;
	}

	window.localStorage.setItem(SAVES_STORAGE_KEY, JSON.stringify({ saves: savedStates }));
}
