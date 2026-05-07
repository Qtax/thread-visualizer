import type * as Monaco from "monaco-editor";

import type { LineStyleTagKind, SyncTagKind, ZoneAdjustment } from "./thread-visualizer-types";

export function getSyncDecorationClassName(kind: SyncTagKind): string {
	switch (kind) {
		case "wait":
			return "sync-line-decoration sync-line-decoration--wait";
		case "set":
			return "sync-line-decoration sync-line-decoration--set";
		default:
			return "sync-line-decoration sync-line-decoration--sync";
	}
}

export function getSyncInlineTagClassName(kind: SyncTagKind): string {
	switch (kind) {
		case "wait":
			return "sync-inline-tag sync-inline-tag--wait";
		case "set":
			return "sync-inline-tag sync-inline-tag--set";
		default:
			return "sync-inline-tag sync-inline-tag--sync";
	}
}

export function getLineStyleTagClassName(kind: LineStyleTagKind): string {
	return `line-style-tag line-style-tag--${kind}`;
}

export function getLineStyleTextClassName(kind: LineStyleTagKind): string {
	return `line-style-text line-style-text--${kind}`;
}

export function clearViewZones(editor: Monaco.editor.IStandaloneCodeEditor, zoneIds: string[]) {
	editor.changeViewZones((accessor) => {
		zoneIds.forEach((zoneId) => accessor.removeZone(zoneId));
	});
}

export function addViewZone(
	editor: Monaco.editor.IStandaloneCodeEditor,
	monaco: typeof import("monaco-editor"),
	lineNumber: number,
	adjustment: ZoneAdjustment
): string {
	let zoneId = "";
	const afterLineNumber =
		adjustment.placement === "after" ? lineNumber : Math.max(0, lineNumber - 1);

	editor.changeViewZones((accessor) => {
		zoneId = accessor.addZone({
			afterLineNumber,
			heightInPx: adjustment.height,
			domNode: makeZoneDom(editor, monaco, afterLineNumber, adjustment),
		});
	});

	return zoneId;
}

function makeZoneDom(
	editor: Monaco.editor.IStandaloneCodeEditor,
	monaco: typeof import("monaco-editor"),
	afterLineNumber: number,
	adjustment: ZoneAdjustment
): HTMLDivElement {
	const node = document.createElement("div");
	const model = editor.getModel();
	const modelOptions = model?.getOptions();
	const tabSize = modelOptions?.tabSize ?? 4;
	const indentSize = modelOptions?.indentSize ?? tabSize;
	const fontInfo = editor.getOption(monaco.editor.EditorOption.fontInfo);
	const indentStepPx = Math.max(fontInfo.spaceWidth * Math.max(indentSize, 1), 1);
	const guideCount = model
		? getWhitespaceLineIndentLevel(model, afterLineNumber, indentSize, tabSize)
		: 0;

	node.style.display = "block";
	node.style.position = "relative";
	node.style.width = "100%";
	node.style.height = `${adjustment.height}px`;
	node.style.pointerEvents = "none";
	if (adjustment.kind === "sync") {
		node.style.backgroundColor = "rgba(161, 161, 170, 0.05)";
	} else {
		const color = `var(--sync-decoration-color-${adjustment.kind})`;
		node.style.backgroundColor = `color-mix(in srgb, ${color} 4%, transparent)`;
		node.style.boxShadow = `inset 2px 0 0 0 color-mix(in srgb, ${color} 45%, transparent)`;
	}
	node.style.boxSizing = "border-box";

	if (guideCount > 0) {
		const guides = document.createElement("div");
		guides.style.position = "absolute";
		guides.style.top = "0";
		guides.style.left = "0";
		guides.style.height = "100%";
		guides.style.width = `${guideCount * indentStepPx}px`;

		for (let guideIndex = 0; guideIndex < guideCount; guideIndex += 1) {
			const guide = document.createElement("div");
			guide.style.position = "absolute";
			guide.style.top = "0";
			guide.style.left = `${guideIndex * indentStepPx}px`;
			guide.style.width = "1px";
			guide.style.height = "100%";
			guide.style.backgroundImage =
				"linear-gradient(to bottom, color-mix(in srgb, currentColor 18%, transparent) 0 50%, transparent 50% 100%)";
			guide.style.backgroundPosition = "left top";
			guide.style.backgroundRepeat = "repeat-y";
			guide.style.backgroundSize = "1px 2px";
			guides.appendChild(guide);
		}

		node.appendChild(guides);
	}

	return node;
}

function getWhitespaceLineIndentLevel(
	model: Monaco.editor.ITextModel,
	afterLineNumber: number,
	indentSize: number,
	tabSize: number
): number {
	const aboveIndent = findNearestContentIndent(model, afterLineNumber, -1, tabSize);
	const belowIndent = findNearestContentIndent(model, afterLineNumber + 1, 1, tabSize);

	if (aboveIndent === -1 || belowIndent === -1) {
		return 0;
	}

	if (aboveIndent < belowIndent) {
		return 1 + Math.floor(aboveIndent / indentSize);
	}

	if (aboveIndent === belowIndent) {
		return Math.ceil(belowIndent / indentSize);
	}

	return 1 + Math.floor(belowIndent / indentSize);
}

function findNearestContentIndent(
	model: Monaco.editor.ITextModel,
	startLineNumber: number,
	direction: 1 | -1,
	tabSize: number
): number {
	for (
		let lineNumber = startLineNumber;
		lineNumber >= 1 && lineNumber <= model.getLineCount();
		lineNumber += direction
	) {
		const indent = computeVisibleIndent(model.getLineContent(lineNumber), tabSize);
		if (indent >= 0) {
			return indent;
		}
	}

	return -1;
}

function computeVisibleIndent(line: string, tabSize: number): number {
	let visibleIndent = 0;
	let hasWhitespace = false;

	for (const character of line) {
		if (character === " ") {
			visibleIndent += 1;
			hasWhitespace = true;
			continue;
		}

		if (character === "\t") {
			visibleIndent += tabSize - (visibleIndent % tabSize);
			hasWhitespace = true;
			continue;
		}

		return visibleIndent;
	}

	return hasWhitespace || line.length === 0 ? -1 : visibleIndent;
}
