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
	collectSyncLineDecorations,
	collectSyncMarkers,
	computeAlignmentPlanFromBaseTops,
	getSyncDecorationClassName,
} from "../lib/sync-utils";
import type { ConnectorOverlay, ConnectorPath, Thread } from "../lib/thread-visualizer-types";

const LINE_HEIGHT = 22;
const MIN_EDITOR_HEIGHT = 180;

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
	sharedEditorHeight: number;
	threadsCanvasRef: React.MutableRefObject<HTMLDivElement | null>;
	threadsContentRef: React.MutableRefObject<HTMLDivElement | null>;
};

export function useThreadEditors(threads: Thread[]): UseThreadEditorsResult {
	const [contentHeights, setContentHeights] = useState<Record<string, number>>({});
	const [connectorOverlay, setConnectorOverlay] =
		useState<ConnectorOverlay>(EMPTY_CONNECTOR_OVERLAY);

	const threadsCanvasRef = useRef<HTMLDivElement | null>(null);
	const threadsContentRef = useRef<HTMLDivElement | null>(null);
	const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
	const editorsRef = useRef<Record<string, Monaco.editor.IStandaloneCodeEditor | null>>({});
	const viewZoneIdsRef = useRef<Record<string, string[]>>({});
	const decorationCollectionsRef = useRef<
		Record<string, Monaco.editor.IEditorDecorationsCollection | null>
	>({});
	const applyViewZonesRef = useRef<() => void>(() => {});
	const isApplyingZonesRef = useRef(false);

	const sharedEditorHeight = Math.max(
		MIN_EDITOR_HEIGHT,
		...Object.values(contentHeights).filter((value) => Number.isFinite(value))
	);

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

	const applySyncDecorations = useCallback((threadId: string, code: string) => {
		const editor = editorsRef.current[threadId];
		const monaco = monacoRef.current;
		if (!editor || !monaco) {
			return;
		}

		const collection =
			decorationCollectionsRef.current[threadId] ?? editor.createDecorationsCollection([]);
		decorationCollectionsRef.current[threadId] = collection;

		const lineDecorations = collectSyncLineDecorations(code);
		collection.set(
			lineDecorations.map(({ kind, lineNumber }) => ({
				range: new monaco.Range(lineNumber, 1, lineNumber, 1),
				options: {
					isWholeLine: true,
					className: getSyncDecorationClassName(kind),
				},
			}))
		);
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

				const entry = {
					threadId: thread.id,
					lineNumber,
					x: centerX,
					y: editorRect.top - canvasRect.top + linePosition.top + linePosition.height / 2,
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
			return;
		}

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

		const groups = collectMatchedSyncGroups(threads);
		if (groups.length > 0) {
			const baseTops: Record<string, Record<number, number>> = {};

			groups.forEach((group) => {
				group.occurrences.forEach(({ threadId, lineNumber }) => {
					const editor = editorsRef.current[threadId];
					if (!editor) {
						return;
					}

					if (!baseTops[threadId]) {
						baseTops[threadId] = {};
					}

					baseTops[threadId][lineNumber] = editor.getTopForLineNumber(lineNumber);
				});
			});

			const plan = computeAlignmentPlanFromBaseTops(groups, baseTops);

			threads.forEach((thread) => {
				const editor = editorsRef.current[thread.id];
				if (!editor) {
					return;
				}

				const zoneIds: string[] = [];
				Object.entries(plan[thread.id] ?? {})
					.filter(([, height]) => height > 0.5)
					.sort((a, b) => Number(a[0]) - Number(b[0]))
					.forEach(([rawLine, height]) => {
						zoneIds.push(addViewZone(editor, Number(rawLine), height));
					});

				viewZoneIdsRef.current[thread.id] = zoneIds;
				editor.render();
			});
		}

		threads.forEach((thread) => {
			syncEditorHeight(thread.id);
		});

		requestAnimationFrame(() => {
			updateConnectorOverlay();
			isApplyingZonesRef.current = false;
		});
	}, [syncEditorHeight, threads, updateConnectorOverlay]);

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
					lineHeight: LINE_HEIGHT,
					fontSize: 14,
					fontFamily:
						"ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
					tabSize: 4,
					insertSpaces: false,
				});

				editor.onDidContentSizeChange(() => {
					syncEditorHeight(threadId);
					if (!isApplyingZonesRef.current) {
						requestAnimationFrame(() => applyViewZonesRef.current());
					}
				});

				editor.onDidLayoutChange(() => {
					if (!isApplyingZonesRef.current) {
						requestAnimationFrame(() => applyViewZonesRef.current());
					}
				});

				editor.onDidChangeModelContent(() => {
					syncEditorHeight(threadId);
					applySyncDecorations(threadId, editor.getValue());
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
		[applySyncDecorations, applyViewZones, syncEditorHeight, threads]
	);

	return {
		connectorOverlay,
		handleMount,
		sharedEditorHeight,
		threadsCanvasRef,
		threadsContentRef,
	};
}
