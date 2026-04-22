import type { SyncTagKind } from "./thread-visualizer-types";

export const SYNC_DECORATION_COLOR_VALUES: Record<SyncTagKind, string> = {
	sync: "rgb(92, 151, 245)",
	wait: "rgb(255, 196, 0)",
	set: "rgb(74, 209, 124)",
};
