import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";

import {
	MAX_UNDO_ENTRIES,
	createCleanThreads,
	createWorkspace,
	loadWorkspaces,
	normalizeThreads,
	persistActiveWorkspaceId,
	persistWorkspaces,
} from "../lib/persistence";
import type { Thread, UndoEntry, Workspace } from "../lib/thread-visualizer-types";

type UseWorkspaceManagerResult = {
	// Thread operations
	threads: Thread[];
	addThread: () => void;
	removeThread: (threadId: string) => void;
	moveThread: (threadId: string, nextIndex: number) => void;
	updateThread: (threadId: string, nextCode: string) => void;
	updateThreadName: (threadId: string, nextName: string) => void;

	// Workspace operations
	workspaces: Workspace[];
	activeWorkspace: Workspace;
	switchWorkspace: (workspaceId: string) => void;
	createNewWorkspace: () => void;
	duplicateWorkspace: () => void;
	renameWorkspace: (name: string) => void;
	deleteWorkspace: (workspaceId: string) => void;

	// Undo/redo
	undo: () => void;
	redo: () => void;
	canUndo: boolean;
	canRedo: boolean;

	// Import/export
	fileInputRef: React.RefObject<HTMLInputElement | null>;
	importState: (event: ChangeEvent<HTMLInputElement>) => void;
	openImportPicker: () => void;

	// For external undo integration
	pushUndoSnapshot: () => void;
};

/** Debounce timer for persisting to localStorage. */
const PERSIST_DEBOUNCE_MS = 300;

function cloneThreads(threads: Thread[]): Thread[] {
	return threads.map((thread) => ({ ...thread }));
}

function threadsEqual(a: Thread[], b: Thread[]): boolean {
	if (a.length !== b.length) {
		return false;
	}

	for (let i = 0; i < a.length; i++) {
		if (a[i].id !== b[i].id || a[i].name !== b[i].name || a[i].code !== b[i].code) {
			return false;
		}
	}

	return true;
}

export function useWorkspaceManager(): UseWorkspaceManagerResult {
	const [state, setState] = useState(() => loadWorkspaces());
	const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	// True while an undo/redo is in progress — blocks spurious snapshot pushes
	// caused by Monaco reacting to restored thread content.
	const isRestoringRef = useRef(false);

	const activeWorkspace =
		state.workspaces.find((workspace) => workspace.id === state.activeId) ??
		state.workspaces[0];
	const threads = activeWorkspace.threads;

	// --- Persistence ---
	useEffect(() => {
		if (persistTimerRef.current !== null) {
			clearTimeout(persistTimerRef.current);
		}

		persistTimerRef.current = setTimeout(() => {
			persistTimerRef.current = null;
			persistWorkspaces(state.workspaces);
			persistActiveWorkspaceId(state.activeId);
		}, PERSIST_DEBOUNCE_MS);

		return () => {
			if (persistTimerRef.current !== null) {
				clearTimeout(persistTimerRef.current);
			}
		};
	}, [state]);

	// Flush on unload
	useEffect(() => {
		const handleBeforeUnload = () => {
			if (persistTimerRef.current !== null) {
				clearTimeout(persistTimerRef.current);
				persistTimerRef.current = null;
			}
			persistWorkspaces(state.workspaces);
			persistActiveWorkspaceId(state.activeId);
		};

		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [state]);

	// --- Helper: update active workspace ---
	const updateActiveWorkspace = useCallback((updater: (workspace: Workspace) => Workspace) => {
		setState((current) => ({
			...current,
			workspaces: current.workspaces.map((workspace) =>
				workspace.id === current.activeId ? updater(workspace) : workspace
			),
		}));
	}, []);

	// --- Undo snapshot ---
	const pushUndoSnapshot = useCallback(() => {
		if (isRestoringRef.current) {
			return;
		}

		updateActiveWorkspace((workspace) => {
			// Don't push a duplicate of the current top of the undo stack
			if (workspace.undoStack.length > 0) {
				const top = workspace.undoStack[workspace.undoStack.length - 1];
				if (threadsEqual(top.threads, workspace.threads)) {
					return workspace;
				}
			}

			const entry: UndoEntry = {
				threads: cloneThreads(workspace.threads),
				timestamp: Date.now(),
			};

			return {
				...workspace,
				undoStack: [...workspace.undoStack, entry].slice(-MAX_UNDO_ENTRIES),
				redoStack: [],
			};
		});
	}, [updateActiveWorkspace]);

	// --- Thread mutations (all push undo snapshot first) ---
	const mutateThreads = useCallback(
		(mutator: (threads: Thread[]) => Thread[]) => {
			updateActiveWorkspace((workspace) => {
				const nextThreads = mutator(workspace.threads);
				if (
					nextThreads === workspace.threads ||
					threadsEqual(nextThreads, workspace.threads)
				) {
					return workspace;
				}

				const entry: UndoEntry = {
					threads: cloneThreads(workspace.threads),
					timestamp: Date.now(),
				};

				return {
					...workspace,
					threads: nextThreads,
					updatedAt: new Date().toISOString(),
					undoStack: [...workspace.undoStack, entry].slice(-MAX_UNDO_ENTRIES),
					redoStack: [],
				};
			});
		},
		[updateActiveWorkspace]
	);

	const updateThread = useCallback(
		(threadId: string, nextCode: string) => {
			// Code changes come from Monaco — don't push undo for these since
			// we want to batch them. Monaco fires rapidly on typing; we only push
			// undo snapshots on structural changes and on the global Ctrl+Z handler
			// (which captures the pre-edit state before Monaco processes the keystroke).
			updateActiveWorkspace((workspace) => {
				const nextThreads = workspace.threads.map((thread) =>
					thread.id === threadId ? { ...thread, code: nextCode } : thread
				);

				if (threadsEqual(workspace.threads, nextThreads)) {
					return workspace;
				}

				return {
					...workspace,
					threads: nextThreads,
					updatedAt: new Date().toISOString(),
				};
			});
		},
		[updateActiveWorkspace]
	);

	const updateThreadName = useCallback(
		(threadId: string, nextName: string) => {
			mutateThreads((current) =>
				current.map((thread) =>
					thread.id === threadId ? { ...thread, name: nextName } : thread
				)
			);
		},
		[mutateThreads]
	);

	const addThread = useCallback(() => {
		mutateThreads((current) => [
			...current,
			{
				id: crypto.randomUUID(),
				name: `Thread ${current.length + 1}`,
				code: "",
			},
		]);
	}, [mutateThreads]);

	const removeThread = useCallback(
		(threadId: string) => {
			mutateThreads((current) => {
				if (current.length === 1) {
					return current;
				}

				return current.filter((thread) => thread.id !== threadId);
			});
		},
		[mutateThreads]
	);

	const moveThread = useCallback(
		(threadId: string, nextIndex: number) => {
			mutateThreads((current) => {
				const index = current.findIndex((thread) => thread.id === threadId);
				if (index < 0) {
					return current;
				}

				const next = [...current];
				const [thread] = next.splice(index, 1);
				const boundedIndex = Math.max(0, Math.min(nextIndex, current.length));
				const insertionIndex = boundedIndex > index ? boundedIndex - 1 : boundedIndex;

				if (!thread || insertionIndex === index) {
					return current;
				}

				next.splice(insertionIndex, 0, thread);
				return next;
			});
		},
		[mutateThreads]
	);

	// --- Undo / Redo ---
	const canUndo = activeWorkspace.undoStack.length > 0;
	const canRedo = activeWorkspace.redoStack.length > 0;

	const undo = useCallback(() => {
		isRestoringRef.current = true;

		updateActiveWorkspace((workspace) => {
			if (workspace.undoStack.length === 0) {
				return workspace;
			}

			const nextUndoStack = [...workspace.undoStack];
			const entry = nextUndoStack.pop()!;
			const redoEntry: UndoEntry = {
				threads: cloneThreads(workspace.threads),
				timestamp: Date.now(),
			};

			return {
				...workspace,
				threads: entry.threads,
				undoStack: nextUndoStack,
				redoStack: [...workspace.redoStack, redoEntry].slice(-MAX_UNDO_ENTRIES),
				updatedAt: new Date().toISOString(),
			};
		});

		requestAnimationFrame(() => {
			isRestoringRef.current = false;
		});
	}, [updateActiveWorkspace]);

	const redo = useCallback(() => {
		isRestoringRef.current = true;

		updateActiveWorkspace((workspace) => {
			if (workspace.redoStack.length === 0) {
				return workspace;
			}

			const nextRedoStack = [...workspace.redoStack];
			const entry = nextRedoStack.pop()!;
			const undoEntry: UndoEntry = {
				threads: cloneThreads(workspace.threads),
				timestamp: Date.now(),
			};

			return {
				...workspace,
				threads: entry.threads,
				redoStack: nextRedoStack,
				undoStack: [...workspace.undoStack, undoEntry].slice(-MAX_UNDO_ENTRIES),
				updatedAt: new Date().toISOString(),
			};
		});

		requestAnimationFrame(() => {
			isRestoringRef.current = false;
		});
	}, [updateActiveWorkspace]);

	// --- Global Ctrl+Z / Ctrl+Y handler ---
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (isRestoringRef.current) {
				return;
			}

			const isCtrlOrMeta = event.ctrlKey || event.metaKey;
			if (!isCtrlOrMeta) {
				return;
			}

			if (event.key === "z" && !event.shiftKey) {
				event.preventDefault();
				event.stopPropagation();
				undo();
				return;
			}

			if (event.key === "y" || (event.key === "z" && event.shiftKey)) {
				event.preventDefault();
				event.stopPropagation();
				redo();
				return;
			}
		};

		// Capture phase so we intercept before Monaco
		window.addEventListener("keydown", handleKeyDown, true);
		return () => window.removeEventListener("keydown", handleKeyDown, true);
	}, [undo, redo]);

	// --- Workspace operations ---
	const switchWorkspace = useCallback((workspaceId: string) => {
		setState((current) => {
			if (
				current.activeId === workspaceId ||
				!current.workspaces.some((workspace) => workspace.id === workspaceId)
			) {
				return current;
			}

			return { ...current, activeId: workspaceId };
		});
	}, []);

	const createNewWorkspace = useCallback(() => {
		const workspace = createWorkspace("Untitled");

		setState((current) => ({
			workspaces: [...current.workspaces, workspace],
			activeId: workspace.id,
		}));
	}, []);

	const duplicateWorkspace = useCallback(() => {
		setState((current) => {
			const source = current.workspaces.find(
				(workspace) => workspace.id === current.activeId
			);
			if (!source) {
				return current;
			}

			const now = new Date().toISOString();
			const duplicate: Workspace = {
				id: crypto.randomUUID(),
				name: `${source.name} (copy)`,
				createdAt: now,
				updatedAt: now,
				threads: cloneThreads(source.threads),
				undoStack: source.undoStack.map((entry) => ({
					threads: cloneThreads(entry.threads),
					timestamp: entry.timestamp,
				})),
				redoStack: source.redoStack.map((entry) => ({
					threads: cloneThreads(entry.threads),
					timestamp: entry.timestamp,
				})),
			};

			return {
				workspaces: [...current.workspaces, duplicate],
				activeId: duplicate.id,
			};
		});
	}, []);

	const renameWorkspace = useCallback(
		(name: string) => {
			const trimmed = name.trim();
			if (!trimmed) {
				return;
			}

			updateActiveWorkspace((workspace) => ({
				...workspace,
				name: trimmed,
				updatedAt: new Date().toISOString(),
			}));
		},
		[updateActiveWorkspace]
	);

	const deleteWorkspace = useCallback((workspaceId: string) => {
		setState((current) => {
			if (current.workspaces.length <= 1) {
				return current;
			}

			const nextWorkspaces = current.workspaces.filter(
				(workspace) => workspace.id !== workspaceId
			);
			const nextActiveId =
				current.activeId === workspaceId ? nextWorkspaces[0].id : current.activeId;

			return { workspaces: nextWorkspaces, activeId: nextActiveId };
		});
	}, []);

	// --- Import ---
	const openImportPicker = useCallback(() => {
		fileInputRef.current?.click();
	}, []);

	const importState = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) {
			return;
		}

		const reader = new FileReader();
		reader.onload = () => {
			try {
				const parsed = JSON.parse(String(reader.result)) as { threads?: unknown };
				const importedThreads = normalizeThreads(parsed.threads);
				if (!importedThreads) {
					return;
				}

				const name = file.name.replace(/\.json$/i, "") || "Imported";
				const workspace = createWorkspace(name, importedThreads);

				setState((current) => ({
					workspaces: [...current.workspaces, workspace],
					activeId: workspace.id,
				}));
			} catch {
				// Ignore invalid imports.
			} finally {
				event.target.value = "";
			}
		};
		reader.onerror = () => {
			event.target.value = "";
		};
		reader.readAsText(file);
	}, []);

	return {
		threads,
		addThread,
		removeThread,
		moveThread,
		updateThread,
		updateThreadName,

		workspaces: state.workspaces,
		activeWorkspace,
		switchWorkspace,
		createNewWorkspace,
		duplicateWorkspace,
		renameWorkspace,
		deleteWorkspace,

		undo,
		redo,
		canUndo,
		canRedo,

		fileInputRef,
		importState,
		openImportPicker,

		pushUndoSnapshot,
	};
}
