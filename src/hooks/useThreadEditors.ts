import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";

import {
	EMPTY_CONNECTOR_OVERLAY,
	buildConnectorGeometry,
	connectorOverlayEquals,
} from "../lib/connector-geometry";
import {
	collectMatchedSyncGroups,
	collectLineCommentDecorations,
	collectSyncLineDecorations,
	collectSyncMarkers,
	collectSyncTagDecorations,
	computeAlignmentPlanFromBaseTops,
	detectHarmfulSyncCycles,
	zonePlansEqual,
} from "../lib/sync-layout";
import {
	addViewZone,
	clearViewZones,
	getSyncDecorationClassName,
	getSyncInlineTagClassName,
} from "../lib/sync-monaco";
import type {
	ConnectorOverlay,
	ConnectorPath,
	CursorPosition,
	SyncMarkerErrorReason,
	Thread,
	ZonePlan,
} from "../lib/thread-visualizer-types";

const MIN_EDITOR_HEIGHT = 180;
const DEFAULT_EDITOR_FONT_SIZE = 14;
const DEFAULT_EDITOR_LINE_HEIGHT = 22;
const DEFAULT_EDITOR_TAB_SIZE = 4;
const COMPACT_EDITOR_FONT_SIZE = 12;
const COMPACT_EDITOR_LINE_HEIGHT = 18;
const COMPACT_EDITOR_TAB_SIZE = 2;
const COMPACT_EDITOR_WIDTH_THRESHOLD = 600;

function revealPositionInWindow(
	editor: Monaco.editor.IStandaloneCodeEditor,
	position: Monaco.IPosition
): void {
	const node = editor.getDomNode();
	if (!node || typeof window === "undefined") {
		return;
	}

	const visiblePosition = editor.getScrolledVisiblePosition(position);
	if (!visiblePosition) {
		return;
	}

	const nodeRect = node.getBoundingClientRect();
	const cursorTop = nodeRect.top + visiblePosition.top;
	const cursorBottom = cursorTop + visiblePosition.height;
	const viewportTop = 8;
	const viewportBottom = window.innerHeight - 16;

	if (cursorTop < viewportTop) {
		window.scrollBy(0, cursorTop - viewportTop);
	} else if (cursorBottom > viewportBottom) {
		window.scrollBy(0, cursorBottom - viewportBottom);
	}
}

function createPointerDownCursorPrepositioner(
	editor: Monaco.editor.IStandaloneCodeEditor,
	monaco: typeof import("monaco-editor"),
	setPointerActive: (active: boolean) => void
): Monaco.IDisposable | undefined {
	const node = editor.getDomNode();
	if (!node || typeof window === "undefined" || typeof document === "undefined") {
		return undefined;
	}

	let timerId: number | null = null;
	const eventName = typeof PointerEvent === "undefined" ? "mousedown" : "pointerdown";
	const endEventName = typeof PointerEvent === "undefined" ? "mouseup" : "pointerup";
	const cancelEventName = typeof PointerEvent === "undefined" ? null : "pointercancel";

	const deactivatePointerMode = () => {
		setPointerActive(false);
		document.removeEventListener(endEventName, deactivatePointerMode, true);
		if (cancelEventName) {
			document.removeEventListener(cancelEventName, deactivatePointerMode, true);
		}
		if (timerId !== null) {
			window.clearTimeout(timerId);
			timerId = null;
		}
	};

	const activatePointerMode = () => {
		setPointerActive(true);
		document.removeEventListener(endEventName, deactivatePointerMode, true);
		if (cancelEventName) {
			document.removeEventListener(cancelEventName, deactivatePointerMode, true);
		}
		document.addEventListener(endEventName, deactivatePointerMode, true);
		if (cancelEventName) {
			document.addEventListener(cancelEventName, deactivatePointerMode, true);
		}
		if (timerId !== null) {
			window.clearTimeout(timerId);
		}
		timerId = window.setTimeout(deactivatePointerMode, 1000);
	};

	const hasCursorPosition = (target: Monaco.editor.IMouseTarget) =>
		target.type === monaco.editor.MouseTargetType.CONTENT_TEXT ||
		target.type === monaco.editor.MouseTargetType.CONTENT_EMPTY ||
		target.type === monaco.editor.MouseTargetType.CONTENT_VIEW_ZONE ||
		target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS ||
		target.type === monaco.editor.MouseTargetType.GUTTER_LINE_DECORATIONS ||
		target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
		target.type === monaco.editor.MouseTargetType.GUTTER_VIEW_ZONE;

	const handlePointerStart = (event: MouseEvent | PointerEvent) => {
		if (event.button !== 0) {
			return;
		}

		activatePointerMode();

		const target = editor.getTargetAtClientPoint(event.clientX, event.clientY);
		if (!target?.position || !hasCursorPosition(target)) {
			return;
		}

		const model = editor.getModel();
		const position = model ? model.validatePosition(target.position) : target.position;
		editor.setPosition(position);
		editor.render();
	};

	node.addEventListener(eventName, handlePointerStart, { capture: true });

	return {
		dispose: () => {
			node.removeEventListener(eventName, handlePointerStart, { capture: true });
			deactivatePointerMode();
		},
	};
}

function formatSyncErrorReason(reason: SyncMarkerErrorReason, id: string): string {
	switch (reason) {
		case "wait-without-set":
			return `Wait for "${id}" has no matching set`;
		case "set-without-wait":
			return `Set for "${id}" has no matching wait`;
		case "set-after-wait-in-thread":
			return `Set for "${id}" appears after wait in the same thread`;
		case "duplicate-sync-in-thread":
			return `Duplicate sync for "${id}" in the same thread`;
	}
}

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
	const pointerDownCursorPrepositionersRef = useRef<Record<string, Monaco.IDisposable>>({});
	const viewZoneIdsRef = useRef<Record<string, string[]>>({});
	const zonePlanRef = useRef<ZonePlan>({});
	const cyclicIdsRef = useRef<Set<string>>(new Set());
	// Per-thread per-(line,id,kind) → human-readable error reason; merged with
	// cyclicIds in applySyncDecorations to mark error tags.
	const markerErrorsRef = useRef<Map<string, string>>(new Map());
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
	const disposePointerDownCursorPrepositioner = useCallback((threadId: string) => {
		pointerDownCursorPrepositionersRef.current[threadId]?.dispose();
		delete pointerDownCursorPrepositionersRef.current[threadId];
	}, []);
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
			revealPositionInWindow(editor, clamped);
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
				? {
						fontSize: COMPACT_EDITOR_FONT_SIZE,
						lineHeight: COMPACT_EDITOR_LINE_HEIGHT,
						tabSize: COMPACT_EDITOR_TAB_SIZE,
					}
				: {
						fontSize: DEFAULT_EDITOR_FONT_SIZE,
						lineHeight: DEFAULT_EDITOR_LINE_HEIGHT,
						tabSize: DEFAULT_EDITOR_TAB_SIZE,
					};

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

		const hasSelection = selectedText.length >= 2 && !selectedText.includes("\n");

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

			const matches = model.findMatches(selectedText, false, false, false, null, false);
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
		const markerErrors = markerErrorsRef.current;
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
				const markerKey = `${threadId}:${lineNumber}:${id}:${kind}`;
				const markerErrorReason = markerErrors.get(markerKey);
				const isError = isCyclic || markerErrorReason !== undefined;
				const inlineClassName = isError
					? `${getSyncInlineTagClassName(kind)} sync-inline-tag--error`
					: getSyncInlineTagClassName(kind);
				const hoverParts: string[] = [];
				if (isCyclic) {
					hoverParts.push(`Sync id "${id}" is part of a cycle, alignment disabled`);
				}
				if (markerErrorReason !== undefined) {
					hoverParts.push(markerErrorReason);
				}
				return {
					range: new monaco.Range(lineNumber, startColumn, lineNumber, endColumn),
					options: {
						inlineClassName,
						hoverMessage:
							hoverParts.length > 0 ? { value: hoverParts.join("\n\n") } : undefined,
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
		const syncGroups = new Map<string, ConnectorEndpoint[]>();

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

			const seenSyncIds = new Set<string>();
			collectSyncMarkers(thread.code).forEach(({ id, kind, lineNumber }) => {
				if (kind === "sync" && seenSyncIds.has(id)) {
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

				if (kind === "sync") {
					seenSyncIds.add(id);
					const endpoints = syncGroups.get(id) ?? [];
					endpoints.push(entry);
					syncGroups.set(id, endpoints);
					return;
				}

				if (kind !== "set" && kind !== "wait") {
					return;
				}

				const group = groups.get(id) ?? { set: [], wait: [] };
				group[kind].push(entry);
				groups.set(id, group);
			});
		});

		const connectors: ConnectorPath[] = [];

		// For same-thread set→wait connectors, route both ends to the same
		// editor side: prefer the right side, but for the rightmost thread
		// (when there are multiple threads) use the left side so the arrow
		// loops back inside the canvas instead of overflowing right.
		const threadCount = threads.length;
		let rightmostThreadId: string | null = null;
		if (threadCount > 1) {
			let rightmostCenterX = -Infinity;
			threads.forEach((thread) => {
				const editor = editorsRef.current[thread.id];
				const editorNode = editor?.getDomNode();
				if (!editor || !editorNode) {
					return;
				}
				const rect = editorNode.getBoundingClientRect();
				const cx = rect.left - canvasRect.left + rect.width / 2;
				if (cx > rightmostCenterX) {
					rightmostCenterX = cx;
					rightmostThreadId = thread.id;
				}
			});
		}

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

					const sameThread = anchorSource.threadId === target.threadId;
					const useRightSide = sameThread
						? target.threadId !== rightmostThreadId
						: target.centerX >= anchorSource.centerX;
					const start = {
						x: useRightSide ? anchorSource.rightX : anchorSource.leftX,
						y: anchorSource.y,
					};
					const end = {
						x: sameThread
							? useRightSide
								? target.rightX
								: target.leftX
							: useRightSide
								? target.leftX
								: target.rightX,
						y: target.y,
					};
					const geometry = buildConnectorGeometry(start, end, {
						lateralSign: sameThread ? (useRightSide ? 1 : -1) : 1,
					});

					connectors.push({
						id,
						key: `${id}:anchor:${anchorSource.threadId}:${anchorSource.lineNumber}:${targetIndex}:${target.threadId}:${target.lineNumber}`,
						path: geometry.path,
						arrowPath: geometry.arrowPath,
						variant: "dependency",
					});
				});
			});

		[...syncGroups.entries()]
			.sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
			.forEach(([id, endpoints]) => {
				if (endpoints.length < 2) {
					return;
				}

				const sortedEndpoints = [...endpoints].sort((left, right) => {
					if (left.centerX !== right.centerX) {
						return left.centerX - right.centerX;
					}

					if (left.y !== right.y) {
						return left.y - right.y;
					}

					return left.lineNumber - right.lineNumber;
				});

				for (let index = 1; index < sortedEndpoints.length; index += 1) {
					const source = sortedEndpoints[index - 1];
					const target = sortedEndpoints[index];
					const sameThread = source.threadId === target.threadId;
					const targetIsRight = target.centerX >= source.centerX;
					const useRightSide = sameThread
						? target.threadId !== rightmostThreadId
						: targetIsRight;
					const start = {
						x: useRightSide ? source.rightX : source.leftX,
						y: source.y,
					};
					const end = {
						x: sameThread
							? useRightSide
								? target.rightX
								: target.leftX
							: targetIsRight
								? target.leftX
								: target.rightX,
						y: target.y,
					};
					const geometry = buildConnectorGeometry(start, end, {
						arrow: false,
						lateralSign: sameThread ? (useRightSide ? 1 : -1) : 1,
					});

					connectors.push({
						id,
						key: `${id}:sync:${index}:${source.threadId}:${source.lineNumber}:${target.threadId}:${target.lineNumber}`,
						path: geometry.path,
						variant: "sync",
					});
				}
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

		const { groups, errors } = collectMatchedSyncGroups(threads);
		const errorMap = new Map<string, string>();
		errors.forEach(({ threadId, id, kind, lineNumber, reason }) => {
			const key = `${threadId}:${lineNumber}:${id}:${kind}`;
			errorMap.set(key, formatSyncErrorReason(reason, id));
		});
		markerErrorsRef.current = errorMap;

		// Compute the next plan WITHOUT clearing zones first: measure tops as
		// Monaco currently sees them (with previously-applied zones in place),
		// then subtract back out the heights of zones strictly above each line
		// to recover the natural top. This lets us short-circuit when the plan
		// is structurally unchanged so we don't churn DOM and re-fire
		// `onDidContentSizeChange` in a tight loop (the wait area visibly
		// re-renders every frame).
		let nextPlan: ZonePlan = {};
		let nextCyclicIds: Set<string> = new Set();
		if (groups.length > 0) {
			const baseTops: Record<string, Record<number, number>> = {};
			const recordTop = (threadId: string, lineNumber: number) => {
				const editor = editorsRef.current[threadId];
				if (!editor) {
					return;
				}
				if (!baseTops[threadId]) {
					baseTops[threadId] = {};
				}
				if (baseTops[threadId][lineNumber] !== undefined) {
					return;
				}
				const measured = editor.getTopForLineNumber(lineNumber);
				const threadZones = zonePlanRef.current[threadId] ?? {};
				let appliedAbove = 0;
				for (const [rawLine, adjustment] of Object.entries(threadZones)) {
					const zoneLine = Number(rawLine);
					if (
						zoneLine < lineNumber ||
						(zoneLine === lineNumber && adjustment.placement === "before")
					) {
						appliedAbove += adjustment.height;
					}
				}
				baseTops[threadId][lineNumber] = measured - appliedAbove;
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
			nextCyclicIds = detectHarmfulSyncCycles(
				threads,
				matchedIds,
				baseTops,
				groupStrategyById
			);

			const activeGroups =
				nextCyclicIds.size === 0
					? groups
					: groups.filter((group) => !nextCyclicIds.has(group.id));

			nextPlan = computeAlignmentPlanFromBaseTops(activeGroups, baseTops);
		}

		const planUnchanged = zonePlansEqual(nextPlan, zonePlanRef.current);
		const cyclicUnchanged =
			nextCyclicIds.size === cyclicIdsRef.current.size &&
			[...nextCyclicIds].every((id) => cyclicIdsRef.current.has(id));

		if (planUnchanged && cyclicUnchanged) {
			// Refresh decorations (cheap, idempotent) but skip view-zone work.
			threads.forEach((thread) => applySyncDecorations(thread.id, thread.code));
			isApplyingZonesRef.current = false;
			if (pendingApplyViewZonesRef.current) {
				pendingApplyViewZonesRef.current = false;
				requestAnimationFrame(() => applyViewZonesRef.current());
			}
			return;
		}

		zonePlanRef.current = nextPlan;
		cyclicIdsRef.current = nextCyclicIds;

		threads.forEach((thread) => {
			const editor = editorsRef.current[thread.id];
			if (!editor) {
				return;
			}

			clearViewZones(editor, viewZoneIdsRef.current[thread.id] ?? []);
			viewZoneIdsRef.current[thread.id] = [];

			const zoneIds: string[] = [];
			Object.entries(nextPlan[thread.id] ?? {})
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
		return () => {
			Object.values(pointerDownCursorPrepositionersRef.current).forEach((disposable) =>
				disposable?.dispose()
			);
			pointerDownCursorPrepositionersRef.current = {};
		};
	}, []);

	useEffect(() => {
		const activeThreadIds = new Set(threads.map((thread) => thread.id));

		Object.keys(editorsRef.current).forEach((threadId) => {
			if (!activeThreadIds.has(threadId)) {
				disposePointerDownCursorPrepositioner(threadId);
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
	}, [disposePointerDownCursorPrepositioner, threads]);

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
				disposePointerDownCursorPrepositioner(threadId);
				editorsRef.current[threadId] = editor;
				let isPointerCursorChange = false;
				const pointerDownCursorPrepositioner = createPointerDownCursorPrepositioner(
					editor,
					monaco,
					(active) => {
						isPointerCursorChange = active;
					}
				);
				if (pointerDownCursorPrepositioner) {
					pointerDownCursorPrepositionersRef.current[threadId] =
						pointerDownCursorPrepositioner;
				}
				editor.onDidDispose(() => {
					if (editorsRef.current[threadId] !== editor) {
						pointerDownCursorPrepositioner?.dispose();
						return;
					}

					disposePointerDownCursorPrepositioner(threadId);
					delete editorsRef.current[threadId];
				});

				editor.updateOptions({
					lineHeight: DEFAULT_EDITOR_LINE_HEIGHT,
					fontSize: DEFAULT_EDITOR_FONT_SIZE,
					tabSize: DEFAULT_EDITOR_TAB_SIZE,
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

				editor.onDidChangeCursorPosition((event) => {
					if (!isPointerCursorChange) {
						revealPositionInWindow(editor, event.position);
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
			disposePointerDownCursorPrepositioner,
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
