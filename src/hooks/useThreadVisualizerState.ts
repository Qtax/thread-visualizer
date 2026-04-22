import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";

import {
	loadSavedStates,
	loadThreads,
	normalizeThreads,
	persistSavedStates,
	persistThreads,
} from "../lib/persistence";
import type { SavedState, Thread } from "../lib/thread-visualizer-types";

type UseThreadVisualizerStateResult = {
	addThread: () => void;
	applyStateText: () => void;
	copyState: () => Promise<void>;
	copyStateLabel: string;
	deleteSavedState: (saveId: string) => void;
	fileInputRef: React.RefObject<HTMLInputElement | null>;
	importState: (event: ChangeEvent<HTMLInputElement>) => void;
	isStatePanelOpen: boolean;
	loadSavedState: (saveId: string) => void;
	moveThread: (threadId: string, nextIndex: number) => void;
	openImportPicker: () => void;
	saveActionLabel: string;
	saveCurrentState: () => void;
	saveName: string;
	savedStates: SavedState[];
	setSaveName: React.Dispatch<React.SetStateAction<string>>;
	setStateText: React.Dispatch<React.SetStateAction<string>>;
	showState: () => void;
	stateText: string;
	threads: Thread[];
	updateSavedState: (saveId: string) => void;
	updateThread: (threadId: string, nextCode: string) => void;
	updateThreadName: (threadId: string, nextName: string) => void;
	removeThread: (threadId: string) => void;
};

export function useThreadVisualizerState(): UseThreadVisualizerStateResult {
	const [threads, setThreads] = useState<Thread[]>(loadThreads);
	const [savedStates, setSavedStates] = useState<SavedState[]>(loadSavedStates);
	const [isStatePanelOpen, setIsStatePanelOpen] = useState(false);
	const [stateText, setStateText] = useState("");
	const [copyStateLabel, setCopyStateLabel] = useState("Copy");
	const [saveName, setSaveName] = useState("");
	const [saveActionLabel, setSaveActionLabel] = useState("Save current");
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		persistThreads(threads);
	}, [threads]);

	useEffect(() => {
		persistSavedStates(savedStates);
	}, [savedStates]);

	useEffect(() => {
		if (!isStatePanelOpen) {
			return;
		}

		setStateText(JSON.stringify({ threads }, null, 2));
	}, [isStatePanelOpen, threads]);

	const updateThread = useCallback((threadId: string, nextCode: string) => {
		setThreads((current) =>
			current.map((thread) =>
				thread.id === threadId
					? {
							...thread,
							code: nextCode,
						}
					: thread
			)
		);
	}, []);

	const updateThreadName = useCallback((threadId: string, nextName: string) => {
		setThreads((current) =>
			current.map((thread) =>
				thread.id === threadId
					? {
							...thread,
							name: nextName,
						}
					: thread
			)
		);
	}, []);

	const addThread = useCallback(() => {
		setThreads((current) => [
			...current,
			{
				id: crypto.randomUUID(),
				name: `Thread ${current.length + 1}`,
				code: "",
			},
		]);
	}, []);

	const removeThread = useCallback(
		(threadId: string) => {
			if (threads.length === 1) {
				return;
			}

			setThreads((current) => current.filter((thread) => thread.id !== threadId));
		},
		[threads.length]
	);

	const moveThread = useCallback((threadId: string, nextIndex: number) => {
		setThreads((current) => {
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
	}, []);

	const showState = useCallback(() => {
		setIsStatePanelOpen((current) => {
			const next = !current;
			if (next) {
				setStateText(JSON.stringify({ threads }, null, 2));
			}
			return next;
		});
	}, [threads]);

	const copyState = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(stateText);
			setCopyStateLabel("Copied");
			window.setTimeout(() => {
				setCopyStateLabel("Copy");
			}, 1200);
		} catch {
			setCopyStateLabel("Copy failed");
			window.setTimeout(() => {
				setCopyStateLabel("Copy");
			}, 1200);
		}
	}, [stateText]);

	const applyStateText = useCallback(() => {
		try {
			const parsed = JSON.parse(stateText) as { threads?: unknown };
			const nextThreads = normalizeThreads(parsed.threads);
			if (!nextThreads) {
				return;
			}

			setThreads(nextThreads);
		} catch {
			// Ignore invalid state edits.
		}
	}, [stateText]);

	const saveCurrentState = useCallback(() => {
		const trimmedName = saveName.trim();
		if (!trimmedName) {
			return;
		}

		const now = new Date().toISOString();

		setSavedStates((current) => {
			const existing = current.find((item) => item.name === trimmedName);
			if (existing) {
				return current
					.map((item) =>
						item.id === existing.id
							? {
									...item,
									name: trimmedName,
									updatedAt: now,
									threads,
								}
							: item
					)
					.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
			}

			return [
				{
					id: crypto.randomUUID(),
					name: trimmedName,
					createdAt: now,
					updatedAt: now,
					threads,
				},
				...current,
			].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
		});

		setSaveActionLabel("Saved");
		window.setTimeout(() => {
			setSaveActionLabel("Save current");
		}, 2000);
	}, [saveName, threads]);

	const loadSavedState = useCallback(
		(saveId: string) => {
			const selected = savedStates.find((item) => item.id === saveId);
			if (!selected) {
				return;
			}

			const nextThreads = normalizeThreads(selected.threads);
			if (!nextThreads) {
				return;
			}

			setThreads(nextThreads);
			setSaveName(selected.name);
		},
		[savedStates]
	);

	const updateSavedState = useCallback(
		(saveId: string) => {
			const now = new Date().toISOString();

			setSavedStates((current) =>
				current
					.map((item) =>
						item.id === saveId
							? {
									...item,
									updatedAt: now,
									threads,
								}
							: item
					)
					.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
			);
		},
		[threads]
	);

	const deleteSavedState = useCallback((saveId: string) => {
		setSavedStates((current) => current.filter((item) => item.id !== saveId));
	}, []);

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
				const nextThreads = normalizeThreads(parsed.threads);
				if (!nextThreads) {
					return;
				}

				setThreads(nextThreads);
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
		addThread,
		applyStateText,
		copyState,
		copyStateLabel,
		deleteSavedState,
		fileInputRef,
		importState,
		isStatePanelOpen,
		loadSavedState,
		moveThread,
		openImportPicker,
		saveActionLabel,
		saveCurrentState,
		saveName,
		savedStates,
		setSaveName,
		setStateText,
		showState,
		stateText,
		threads,
		updateSavedState,
		updateThread,
		updateThreadName,
		removeThread,
	};
}
