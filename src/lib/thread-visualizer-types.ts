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

export type ZonePlan = Record<string, Record<number, number>>;
export type SyncGroup = [string, Array<{ threadId: string; lineNumber: number }>];
