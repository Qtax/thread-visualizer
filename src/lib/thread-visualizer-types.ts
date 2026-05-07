export type Thread = {
	id: string;
	name: string;
	code: string;
};

export type SyncTagKind = "sync" | "wait" | "set";

export type LineStyleTagKind = "em" | "skip";

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
	id: string;
	kind: SyncTagKind;
	lineNumber: number;
	startColumn: number;
	endColumn: number;
	ignored: boolean;
};

export type LineStyleDecoration = {
	kind: LineStyleTagKind;
	lineNumber: number;
	startColumn: number;
	endColumn: number;
};

export type SyncMarkerErrorReason =
	| "wait-without-set"
	| "set-without-wait"
	| "set-after-wait-in-thread"
	| "duplicate-sync-in-thread";

export type SyncMarkerError = {
	threadId: string;
	id: string;
	kind: SyncTagKind;
	lineNumber: number;
	reason: SyncMarkerErrorReason;
};

export type MatchedSyncGroupsResult = {
	groups: SyncGroup[];
	/** Sync IDs participating in a cycle (broken to avoid runaway alignment). */
	cyclicIds: Set<string>;
	/** Per-occurrence semantic errors (independent of cycle detection). */
	errors: SyncMarkerError[];
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
	arrowPath?: string;
	variant: "dependency" | "sync";
};

export type ConnectorOverlay = {
	width: number;
	height: number;
	connectors: ConnectorPath[];
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
