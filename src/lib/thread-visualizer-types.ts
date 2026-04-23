export type Thread = {
	id: string;
	name: string;
	code: string;
};

export type SyncOccurrence = {
	id: string;
	lineNumber: number;
};

export type SyncTagKind = "sync" | "wait" | "set";

export type SyncLineDecoration = {
	kind: SyncTagKind;
	lineNumber: number;
};

export type SyncMarker = {
	id: string;
	kind: SyncTagKind;
	lineNumber: number;
};

export type SyncTagDecoration = {
	kind: SyncTagKind;
	lineNumber: number;
	startColumn: number;
	endColumn: number;
};

export type SyncGroupOccurrence = {
	threadId: string;
	lineNumber: number;
	kind: SyncTagKind;
};

export type ZonePlacement = "before" | "after";

export type ZoneAdjustment = {
	height: number;
	kind: SyncTagKind;
	placement: ZonePlacement;
};

export type Point = {
	x: number;
	y: number;
};

export type ConnectorPath = {
	id: string;
	key: string;
	path: string;
	arrowPath: string;
};

export type ConnectorOverlay = {
	width: number;
	height: number;
	connectors: ConnectorPath[];
};

export type SavedState = {
	id: string;
	name: string;
	createdAt: string;
	updatedAt: string;
	threads: Thread[];
};

/** A workspace is a named collection of threads with its own undo history. */
export type Workspace = {
	id: string;
	name: string;
	createdAt: string;
	updatedAt: string;
	threads: Thread[];
	undoStack: UndoEntry[];
	redoStack: UndoEntry[];
};

/** A snapshot of the threads array at a point in time. */
export type UndoEntry = {
	threads: Thread[];
	cursors?: Record<string, CursorPosition>;
	timestamp: number;
};

/** A 1-based Monaco cursor position. */
export type CursorPosition = {
	lineNumber: number;
	column: number;
};

export type ZonePlan = Record<string, Record<number, ZoneAdjustment>>;
export type SyncGroup = {
	id: string;
	strategy: "align-all" | "align-waits-to-first-set";
	occurrences: SyncGroupOccurrence[];
};
