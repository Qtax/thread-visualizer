import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";

import {
	EMPTY_CONNECTOR_OVERLAY,
	buildConnectorGeometry,
	connectorOverlayEquals,
} from "../lib/connector-geometry";
import {
	addViewZone,
	clearViewZones,
	collectMatchedSyncGroups,
	collectLineCommentDecorations,
	collectSyncLineDecorations,
	collectSyncMarkers,
	collectSyncTagDecorations,
	computeAlignmentPlanFromBaseTops,
	detectHarmfulSyncCycles,
	getSyncDecorationClassName,
	getSyncInlineTagClassName,
} from "../lib/sync-utils";
import type {
	ConnectorOverlay,
	ConnectorPath,
	CursorPosition,
	Thread,
	ZonePlan,
} from "../lib/thread-visualizer-types";

const MIN_EDITOR_HEIGHT = 180;
const DEFAULT_EDITOR_FONT_SIZE = 14;
const DEFAULT_EDITOR_LINE_HEIGHT = 22;
const COMPACT_EDITOR_FONT_SIZE = 12;
const COMPACT_EDITOR_LINE_HEIGHT = 20;
const COMPACT_EDITOR_WIDTH_THRESHOLD = 600;

type ConnectorEndpoint = {
	threadId: string;
	lineNumber: number;
	x: number;
	y: number;
	centerX: number;
	leftX: number;
	rightX: number;
};

type UseThreadEditorsResult = {
	connectorOverlay: ConnectorOverlay;
	handleMount: (
		threadId: string
	) => (
		editor: Monaco.editor.IStandaloneCodeEditor,
		monaco: typeof import("monaco-editor")
	) => void;
	getCursors: () => Record<string, CursorPosition>;
	applyCursors: (cursors: Record<string, CursorPosition>) => void;
	focusEditor: (threadId: string) => void;
	sharedEditorHeight: number;
	threadsCanvasRef: React.MutableRefObject<HTMLDivElement | null>;
	threadsContentRef: React.MutableRefObject<HTMLDivElement | null>;
};

export function useThreadEditors(
	threads: Thread[],
	pushUndoSnapshot?: (cursorOverrides?: Record<string, CursorPosition>) => void
): UseThreadEditorsResult {
	const [contentHeights, setContentHeights] = useState<Record<string, number>>({});
	const [connectorOverlay, setConnectorOverlay] =
		useState<ConnectorOverlay>(EMPTY_CONNECTOR_OVERLAY);

	const threadsCanvasRef = useRef<HTMLDivElement | null>(null);
	const threadsContentRef = useRef<HTMLDivElement | null>(null);
	const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
	const editorsRef = useRef<Record<string, Monaco.editor.IStandaloneCodeEditor | null>>({});
	const viewZoneIdsRef = useRef<Record<string, string[]>>({});
	const zonePlanRef = useRef<ZonePlan>({});
	const cyclicIdsRef = useRef<Set<string>>(new Set());
	const decorationCollectionsRef = useRef<
		Record<string, Monaco.editor.IEditorDecorationsCollection | null>
	>({});
	const selectionHighlightCollectionsRef = useRef<
		Record<string, Monaco.editor.IEditorDecorationsCollection | null>
	>({});
	const applyViewZonesRef = useRef<() => void>(() => {});
	const isApplyingZonesRef = useRef(false);
	const pendingApplyViewZonesRef = useRef(false);
	const pushUndoSnapshotRef = useRef(pushUndoSnapshot);
	pushUndoSnapshotRef.current = pushUndoSnapshot;
	const contentChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const hasPendingSnapshotRef = useRef(false);
	const getCursors = useCallback((): Record<string, CursorPosition> => {
		const positions: Record<string, CursorPosition> = {};
		for (const [threadId, editor] of Object.entries(editorsRef.current)) {
			if (editor) {
				const pos = editor.getPosition();
				if (pos) {
					positions[threadId] = { lineNumber: pos.lineNumber, column: pos.column };
				}
			}
		}
		return positions;
	}, []);

	const applyCursors = useCallback((cursors: Record<string, CursorPosition>) => {
		for (const [threadId, position] of Object.entries(cursors)) {
			const editor = editorsRef.current[threadId];
			if (!editor) continue;
			const model = editor.getModel();
			if (!model) continue;
			const clamped = model.validatePosition(position);
			editor.setPosition(clamped);
			editor.revealPositionInCenterIfOutsideViewport(clamped);
		}
	}, []);

	const focusEditor = useCallback((threadId: string) => {
		editorsRef.current[threadId]?.focus();
	}, []);

	const sharedEditorHeight = Math.max(
		MIN_EDITOR_HEIGHT,
		...Object.values(contentHeights).filter((value) => Number.isFinite(value))
	);

	// Clear the connector overlay immediately when switching workspaces so stale
	// arrows don't flash before the new layout is computed.
	const threadIdKey = threads.map((t) => t.id).join(",");
	useLayoutEffect(() => {
		setConnectorOverlay(EMPTY_CONNECTOR_OVERLAY);
	}, [threadIdKey]);

	const syncEditorFontSize = useCallback((editor: Monaco.editor.IStandaloneCodeEditor) => {
		const layoutInfo = editor.getLayoutInfo();
		const useCompactTypography =
			layoutInfo.width < COMPACT_EDITOR_WIDTH_THRESHOLD
				? { fontSize: COMPACT_EDITOR_FONT_SIZE, lineHeight: COMPACT_EDITOR_LINE_HEIGHT }
				: { fontSize: DEFAULT_EDITOR_FONT_SIZE, lineHeight: DEFAULT_EDITOR_LINE_HEIGHT };

		editor.updateOptions(useCompactTypography);
	}, []);

	const syncEditorHeight = useCallback((threadId: string) => {
		const editor = editorsRef.current[threadId];
		if (!editor) {
			return;
		}

		const measuredHeight = Math.max(MIN_EDITOR_HEIGHT, editor.getContentHeight() + 4);

		setContentHeights((current) => {
			const currentHeight = current[threadId] ?? MIN_EDITOR_HEIGHT;

			return currentHeight === measuredHeight
				? current
				: {
						...current,
						[threadId]: measuredHeight,
					};
		});
	}, []);

	const applySelectionHighlights = useCallback((selectedText: string) => {
		const monaco = monacoRef.current;
		if (!monaco) {
			return;
		}

		const trimmed = selectedText;
		const hasSelection = trimmed.length >= 2 && !trimmed.includes("\n");

		for (const [threadId, editor] of Object.entries(editorsRef.current)) {
			if (!editor) {
				continue;
			}

			const collection =
				selectionHighlightCollectionsRef.current[threadId] ??
				editor.createDecorationsCollection([]);
			selectionHighlightCollectionsRef.current[threadId] = collection;

			if (!hasSelection) {
				collection.set([]);
				continue;
			}

			const model = editor.getModel();
			if (!model) {
				collection.set([]);
				continue;
			}

			const matches = model.findMatches(trimmed, false, false, false, null, false);
			collection.set(
				matches.map((match) => ({
					range: match.range,
					options: { className: "selection-highlight" },
				}))
			);
		}
	}, []);

	const applySyncDecorations = useCallback((threadId: string, code: string) => {
		const editor = editorsRef.current[threadId];
		const monaco = monacoRef.current;
		if (!editor || !monaco) {
			return;
		}

		const collection =
			decorationCollectionsRef.current[threadId] ?? editor.createDecorationsCollection([]);
		decorationCollectionsRef.current[threadId] = collection;

		const cyclicIds = cyclicIdsRef.current;
		const lineDecorations = collectSyncLineDecorations(code);
		const inlineTagDecorations = collectSyncTagDecorations(code);
		const commentDecorations = collectLineCommentDecorations(code);
		collection.set([
			...lineDecorations.map(({ kind, lineNumber }) => ({
				range: new monaco.Range(lineNumber, 1, lineNumber, 1),
				options: {
					isWholeLine: true,
					className: getSyncDecorationClassName(kind),
				},
			})),
			...inlineTagDecorations.map(({ id, kind, lineNumber, startColumn, endColumn }) => {
				const isCyclic = cyclicIds.has(id);
				const inlineClassName = isCyclic
					? `${getSyncInlineTagClassName(kind)} sync-inline-tag--error`
					: getSyncInlineTagClassName(kind);
				return {
					range: new monaco.Range(lineNumber, startColumn, lineNumber, endColumn),
					options: {
						inlineClassName,
						hoverMessage: isCyclic
							? {
									value: `Sync id "${id}" is part of a cycle, alignment disabled.`,
								}
							: undefined,
					},
				};
			}),
			...commentDecorations.map(({ lineNumber, startColumn, endColumn }) => ({
				range: new monaco.Range(lineNumber, startColumn, lineNumber, endColumn),
				options: {
					inlineClassName: "line-comment-decoration",
					stickiness: monaco.editor.TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
				},
			})),
		]);
	}, []);

	const updateConnectorOverlay = useCallback(() => {
		const canvas = threadsCanvasRef.current;
		const content = threadsContentRef.current;
		if (!canvas) {
			setConnectorOverlay((current) =>
				connectorOverlayEquals(current, EMPTY_CONNECTOR_OVERLAY)
					? current
					: EMPTY_CONNECTOR_OVERLAY
			);
			return;
		}

		const canvasRect = canvas.getBoundingClientRect();
		const groups = new Map<string, { set: ConnectorEndpoint[]; wait: ConnectorEndpoint[] }>();

		threads.forEach((thread) => {
			const editor = editorsRef.current[thread.id];
			const editorNode = editor?.getDomNode();
			if (!editor || !editorNode) {
				return;
			}

			const editorRect = editorNode.getBoundingClientRect();
			const leftX = editorRect.left - canvasRect.left + 10;
			const rightX = editorRect.right - canvasRect.left - 10;
			const centerX = editorRect.left - canvasRect.left + editorRect.width / 2;

			collectSyncMarkers(thread.code).forEach(({ id, kind, lineNumber }) => {
				if (kind !== "set" && kind !== "wait") {
					return;
				}

				const linePosition = editor.getScrolledVisiblePosition({ lineNumber, column: 1 });
				if (!linePosition) {
					return;
				}

				const zoneAdjustment = zonePlanRef.current[thread.id]?.[lineNumber];
				const targetYOffset =
					kind === "wait" && zoneAdjustment?.placement === "after"
						? zoneAdjustment.height
						: 0;
				const entry = {
					threadId: thread.id,
					lineNumber,
					x: centerX,
					y:
						editorRect.top -
						canvasRect.top +
						linePosition.top +
						linePosition.height / 2 +
						targetYOffset,
					centerX,
					leftX,
					rightX,
				};
				const group = groups.get(id) ?? { set: [], wait: [] };
				group[kind].push(entry);
				groups.set(id, group);
			});
		});

		const connectors: ConnectorPath[] = [];

		[...groups.entries()]
			.sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
			.forEach(([id, group]) => {
				if (group.set.length === 0 || group.wait.length === 0) {
					return;
				}

				const anchorSource = group.set.reduce((best, current) =>
					current.y < best.y ||
					(current.y === best.y && current.lineNumber < best.lineNumber)
						? current
						: best
				);

				group.wait.forEach((target, targetIndex) => {
					if (
						anchorSource.threadId === target.threadId &&
						anchorSource.lineNumber === target.lineNumber
					) {
						return;
					}

					const targetIsRight = target.centerX >= anchorSource.centerX;
					const start = {
						x: targetIsRight ? anchorSource.rightX : anchorSource.leftX,
						y: anchorSource.y,
					};
					const end = {
						x: targetIsRight ? target.leftX : target.rightX,
						y: target.y,
					};
					const geometry = buildConnectorGeometry(start, end);

					connectors.push({
						id,
						key: `${id}:anchor:${anchorSource.threadId}:${anchorSource.lineNumber}:${targetIndex}:${target.threadId}:${target.lineNumber}`,
						path: geometry.path,
						arrowPath: geometry.arrowPath,
					});
				});
			});

		const nextOverlay: ConnectorOverlay = {
			width: Math.max(
				content?.scrollWidth ?? 0,
				content?.offsetWidth ?? 0,
				canvas.clientWidth,
				1
			),
			height: Math.max(canvas.offsetHeight, 1),
			connectors,
		};

		setConnectorOverlay((current) =>
			connectorOverlayEquals(current, nextOverlay) ? current : nextOverlay
		);
	}, [threads]);

	const applyViewZones = useCallback(() => {
		if (isApplyingZonesRef.current) {
			pendingApplyViewZonesRef.current = true;
			return;
		}

		pendingApplyViewZonesRef.current = false;
		isApplyingZonesRef.current = true;

		threads.forEach((thread) => {
			const editor = editorsRef.current[thread.id];
			if (!editor) {
				return;
			}

			clearViewZones(editor, viewZoneIdsRef.current[thread.id] ?? []);
			viewZoneIdsRef.current[thread.id] = [];
			editor.render();
		});

		const { groups } = collectMatchedSyncGroups(threads);
		zonePlanRef.current = {};
		cyclicIdsRef.current = new Set();
		if (groups.length > 0) {
			// baseTops must cover every set/sync/wait line we may inspect, both
			// for alignment and for cycle detection (which considers all set
			// instances across threads to pick the global anchor).
			const baseTops: Record<string, Record<number, number>> = {};
			const recordTop = (threadId: string, lineNumber: number) => {
				const editor = editorsRef.current[threadId];
				if (!editor) {
					return;
				}
				if (!baseTops[threadId]) {
					baseTops[threadId] = {};
				}
				if (baseTops[threadId][lineNumber] === undefined) {
					baseTops[threadId][lineNumber] = editor.getTopForLineNumber(lineNumber);
				}
			};

			groups.forEach((group) => {
				group.occurrences.forEach(({ threadId, lineNumber }) => {
					recordTop(threadId, lineNumber);
				});
			});
			threads.forEach((thread) => {
				collectSyncMarkers(thread.code).forEach(({ lineNumber }) => {
					recordTop(thread.id, lineNumber);
				});
			});

			const matchedIds = new Set(groups.map((group) => group.id));
			const groupStrategyById = new Map(
				groups.map((group) => [group.id, group.strategy] as const)
			);
			const cyclicIds = detectHarmfulSyncCycles(
				threads,
				matchedIds,
				baseTops,
				groupStrategyById
			);
			cyclicIdsRef.current = cyclicIds;

			const activeGroups =
				cyclicIds.size === 0 ? groups : groups.filter((group) => !cyclicIds.has(group.id));

			const plan = computeAlignmentPlanFromBaseTops(activeGroups, baseTops);
			zonePlanRef.current = plan;

			threads.forEach((thread) => {
				const editor = editorsRef.current[thread.id];
				if (!editor) {
					return;
				}

				const zoneIds: string[] = [];
				Object.entries(plan[thread.id] ?? {})
					.filter(([, adjustment]) => adjustment.height > 0.5)
					.sort((a, b) => Number(a[0]) - Number(b[0]))
					.forEach(([rawLine, adjustment]) => {
						zoneIds.push(
							addViewZone(editor, monacoRef.current!, Number(rawLine), adjustment)
						);
					});

				viewZoneIdsRef.current[thread.id] = zoneIds;
				editor.render();
			});
		}

		threads.forEach((thread) => {
			syncEditorHeight(thread.id);
		});

		// Refresh decorations across all threads so cycle/error markers stay
		// consistent with the latest cross-thread analysis.
		threads.forEach((thread) => applySyncDecorations(thread.id, thread.code));

		requestAnimationFrame(() => {
			updateConnectorOverlay();
			isApplyingZonesRef.current = false;
			if (pendingApplyViewZonesRef.current) {
				pendingApplyViewZonesRef.current = false;
				applyViewZonesRef.current();
			}
		});
	}, [applySyncDecorations, syncEditorHeight, threads, updateConnectorOverlay]);

	useEffect(() => {
		const canvas = threadsCanvasRef.current;
		const content = threadsContentRef.current;
		if (!canvas || !content || typeof ResizeObserver === "undefined") {
			return;
		}

		let frameId = 0;
		const scheduleOverlayUpdate = () => {
			if (frameId !== 0) {
				cancelAnimationFrame(frameId);
			}

			frameId = requestAnimationFrame(() => {
				frameId = 0;
				updateConnectorOverlay();
			});
		};

		const observer = new ResizeObserver(() => {
			scheduleOverlayUpdate();
		});

		observer.observe(canvas);
		observer.observe(content);

		return () => {
			observer.disconnect();
			if (frameId !== 0) {
				cancelAnimationFrame(frameId);
			}
		};
	}, [updateConnectorOverlay]);

	useEffect(() => {
		const activeThreadIds = new Set(threads.map((thread) => thread.id));

		Object.keys(editorsRef.current).forEach((threadId) => {
			if (!activeThreadIds.has(threadId)) {
				delete editorsRef.current[threadId];
			}
		});

		Object.keys(viewZoneIdsRef.current).forEach((threadId) => {
			if (!activeThreadIds.has(threadId)) {
				delete viewZoneIdsRef.current[threadId];
			}
		});

		Object.keys(decorationCollectionsRef.current).forEach((threadId) => {
			if (!activeThreadIds.has(threadId)) {
				delete decorationCollectionsRef.current[threadId];
			}
		});

		Object.keys(selectionHighlightCollectionsRef.current).forEach((threadId) => {
			if (!activeThreadIds.has(threadId)) {
				delete selectionHighlightCollectionsRef.current[threadId];
			}
		});

		setContentHeights((current) => {
			const nextEntries = Object.entries(current).filter(([threadId]) =>
				activeThreadIds.has(threadId)
			);
			return nextEntries.length === Object.keys(current).length
				? current
				: Object.fromEntries(nextEntries);
		});
	}, [threads]);

	useLayoutEffect(() => {
		applyViewZonesRef.current = applyViewZones;
		applyViewZones();
		threads.forEach((thread) => applySyncDecorations(thread.id, thread.code));
	}, [applySyncDecorations, applyViewZones, threads]);

	const handleMount = useCallback(
		(threadId: string) =>
			(
				editor: Monaco.editor.IStandaloneCodeEditor,
				monaco: typeof import("monaco-editor")
			) => {
				monacoRef.current = monaco;
				editorsRef.current[threadId] = editor;

				editor.updateOptions({
					lineHeight: DEFAULT_EDITOR_LINE_HEIGHT,
					fontSize: DEFAULT_EDITOR_FONT_SIZE,
					fontFamily:
						"ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
					tabSize: 4,
					insertSpaces: false,
					// Render hover/suggestion widgets in a fixed-position layer
					// so they aren't clipped by narrow editor columns.
					fixedOverflowWidgets: true,
				});

				syncEditorFontSize(editor);

				editor.onDidContentSizeChange(() => {
					syncEditorHeight(threadId);
					if (!isApplyingZonesRef.current) {
						requestAnimationFrame(() => applyViewZonesRef.current());
					} else {
						pendingApplyViewZonesRef.current = true;
					}
				});

				editor.onDidLayoutChange(() => {
					syncEditorFontSize(editor);
					if (!isApplyingZonesRef.current) {
						requestAnimationFrame(() => applyViewZonesRef.current());
					} else {
						pendingApplyViewZonesRef.current = true;
					}
				});

				editor.onDidChangeModelContent((event) => {
					// Push undo snapshot at the start of a typing burst.
					// Capture pre-edit cursor for the editing thread from the change event:
					// `event.changes[0].range` is the range that was replaced, so its start is
					// where the edit began (i.e. where the cursor was before the edit).
					if (!hasPendingSnapshotRef.current && pushUndoSnapshotRef.current) {
						hasPendingSnapshotRef.current = true;
						const firstChange = event.changes[0];
						const cursorOverrides = firstChange
							? {
									[threadId]: {
										lineNumber: firstChange.range.startLineNumber,
										column: firstChange.range.startColumn,
									},
								}
							: undefined;
						pushUndoSnapshotRef.current(cursorOverrides);
					}

					// Reset the debounce timer — after 800ms of inactivity,
					// allow the next content change to push another snapshot
					if (contentChangeTimerRef.current !== null) {
						clearTimeout(contentChangeTimerRef.current);
					}
					contentChangeTimerRef.current = setTimeout(() => {
						hasPendingSnapshotRef.current = false;
						contentChangeTimerRef.current = null;
					}, 800);

					syncEditorHeight(threadId);
					applySyncDecorations(threadId, editor.getValue());
					if (!isApplyingZonesRef.current) {
						requestAnimationFrame(() => applyViewZonesRef.current());
					} else {
						pendingApplyViewZonesRef.current = true;
					}
				});

				editor.onDidChangeCursorSelection(() => {
					const selection = editor.getSelection();
					const model = editor.getModel();
					if (selection && model && !selection.isEmpty()) {
						applySelectionHighlights(model.getValueInRange(selection));
					} else {
						applySelectionHighlights("");
					}
				});

				editor.onKeyDown((event) => {
					if (event.keyCode !== monaco.KeyCode.Tab) {
						return;
					}

					event.preventDefault();
					event.stopPropagation();

					if (event.shiftKey) {
						editor.trigger("thread-call-path", "editor.action.outdentLines", undefined);
						return;
					}

					const selection = editor.getSelection();
					if (!selection) {
						return;
					}

					if (selection.startLineNumber !== selection.endLineNumber) {
						editor.trigger("thread-call-path", "editor.action.indentLines", undefined);
						return;
					}

					editor.executeEdits("thread-call-path", [
						{
							range: selection,
							text: "\t",
							forceMoveMarkers: true,
						},
					]);
				});

				syncEditorHeight(threadId);
				applySyncDecorations(
					threadId,
					threads.find((thread) => thread.id === threadId)?.code ?? ""
				);
				applyViewZones();
			},
		[
			applySyncDecorations,
			applySelectionHighlights,
			applyViewZones,
			syncEditorFontSize,
			syncEditorHeight,
			threads,
		]
	);

	return {
		connectorOverlay,
		handleMount,
		getCursors,
		applyCursors,
		focusEditor,
		sharedEditorHeight,
		threadsCanvasRef,
		threadsContentRef,
	};
}
