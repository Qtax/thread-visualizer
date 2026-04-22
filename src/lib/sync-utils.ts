import type * as Monaco from "monaco-editor";

import type {
	SyncGroup,
	SyncGroupOccurrence,
	SyncLineDecoration,
	SyncMarker,
	SyncOccurrence,
	SyncTagKind,
	Thread,
	ZonePlan,
} from "./thread-visualizer-types";

export const SYNC_PATTERN = /\[(sync|wait|set)\s+([^\]]+?)\]/gi;

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

export function parseFirstSyncs(text: string): SyncOccurrence[] {
	const seen = new Set<string>();
	const lines = text.split(/\r?\n/);
	const occurrences: SyncOccurrence[] = [];

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		const matcher = new RegExp(SYNC_PATTERN);
		let match: RegExpExecArray | null = null;

		while ((match = matcher.exec(line)) !== null) {
			const id = match[2].trim();
			if (!id || seen.has(id)) {
				continue;
			}

			seen.add(id);
			occurrences.push({ id, lineNumber: index + 1 });
		}
	}

	return occurrences;
}

export function collectSyncMarkers(text: string): SyncMarker[] {
	const lines = text.split(/\r?\n/);
	const markers: SyncMarker[] = [];

	lines.forEach((line, index) => {
		const matcher = new RegExp(SYNC_PATTERN.source, SYNC_PATTERN.flags);
		let match: RegExpExecArray | null = null;

		while ((match = matcher.exec(line)) !== null) {
			const id = match[2].trim();
			if (!id) {
				continue;
			}

			markers.push({
				id,
				kind: match[1].toLowerCase() as SyncTagKind,
				lineNumber: index + 1,
			});
		}
	});

	return markers;
}

export function collectSyncLineDecorations(text: string): SyncLineDecoration[] {
	const firstKindByLine = new Map<number, SyncTagKind>();

	collectSyncMarkers(text).forEach(({ kind, lineNumber }) => {
		if (!firstKindByLine.has(lineNumber)) {
			firstKindByLine.set(lineNumber, kind);
		}
	});

	return [...firstKindByLine.entries()].map(([lineNumber, kind]) => ({
		kind,
		lineNumber,
	}));
}

export function collectMatchedSyncGroups(threads: Thread[]): SyncGroup[] {
	const grouped = new Map<string, SyncGroupOccurrence[]>();
	const perThreadSequences: Array<Array<{ id: string; lineNumber: number }>> = [];
	const lineStats = new Map<string, { min: number; sum: number; count: number }>();

	for (const thread of threads) {
		const syncs = parseFirstSyncs(thread.code);
		perThreadSequences.push(syncs.map(({ id, lineNumber }) => ({ id, lineNumber })));

		const markers = collectSyncMarkers(thread.code);
		const seenSyncIds = new Set<string>();

		markers.forEach(({ id, kind, lineNumber }) => {
			if (kind === "sync") {
				if (seenSyncIds.has(id)) {
					return;
				}

				seenSyncIds.add(id);
			}

			const occurrences = grouped.get(id) ?? [];
			occurrences.push({ threadId: thread.id, lineNumber, kind });
			grouped.set(id, occurrences);
		});

		for (const sync of syncs) {
			const currentStats = lineStats.get(sync.id);
			if (!currentStats) {
				lineStats.set(sync.id, { min: sync.lineNumber, sum: sync.lineNumber, count: 1 });
			} else {
				currentStats.min = Math.min(currentStats.min, sync.lineNumber);
				currentStats.sum += sync.lineNumber;
				currentStats.count += 1;
			}
		}
	}

	const candidateGroups = new Map<string, SyncGroup>();

	grouped.forEach((occurrences, id) => {
		const syncOccurrences = occurrences.filter((occurrence) => occurrence.kind === "sync");
		if (syncOccurrences.length > 0) {
			if (syncOccurrences.length > 1) {
				candidateGroups.set(id, {
					id,
					strategy: "align-all",
					occurrences: syncOccurrences,
				});
			}

			return;
		}

		const waitOccurrences = occurrences.filter((occurrence) => occurrence.kind === "wait");
		const setOccurrences = occurrences.filter((occurrence) => occurrence.kind === "set");

		if (waitOccurrences.length === 0) {
			return;
		}

		if (setOccurrences.length > 0) {
			candidateGroups.set(id, {
				id,
				strategy: "align-waits-to-first-set",
				occurrences: [...setOccurrences, ...waitOccurrences],
			});
			return;
		}

		if (waitOccurrences.length > 1) {
			candidateGroups.set(id, {
				id,
				strategy: "align-all",
				occurrences: waitOccurrences,
			});
		}
	});

	const matchedIds = new Set([...candidateGroups.keys()]);

	const edges = new Map<string, Set<string>>();
	const indegree = new Map<string, number>();

	matchedIds.forEach((syncId) => {
		edges.set(syncId, new Set());
		indegree.set(syncId, 0);
	});

	perThreadSequences.forEach((sequence) => {
		const filtered = sequence.filter((item) => matchedIds.has(item.id));
		for (let index = 1; index < filtered.length; index += 1) {
			const previousId = filtered[index - 1].id;
			const currentId = filtered[index].id;
			if (previousId === currentId) {
				continue;
			}

			const outgoing = edges.get(previousId);
			if (!outgoing || outgoing.has(currentId)) {
				continue;
			}

			outgoing.add(currentId);
			indegree.set(currentId, (indegree.get(currentId) ?? 0) + 1);
		}
	});

	const compareSyncIds = (left: string, right: string) => {
		const leftStats = lineStats.get(left);
		const rightStats = lineStats.get(right);
		const leftAverage = leftStats ? leftStats.sum / leftStats.count : Number.POSITIVE_INFINITY;
		const rightAverage = rightStats
			? rightStats.sum / rightStats.count
			: Number.POSITIVE_INFINITY;

		if (leftAverage !== rightAverage) {
			return leftAverage - rightAverage;
		}

		const leftMin = leftStats?.min ?? Number.POSITIVE_INFINITY;
		const rightMin = rightStats?.min ?? Number.POSITIVE_INFINITY;
		if (leftMin !== rightMin) {
			return leftMin - rightMin;
		}

		return left.localeCompare(right);
	};

	const ready = [...matchedIds]
		.filter((syncId) => (indegree.get(syncId) ?? 0) === 0)
		.sort(compareSyncIds);
	const orderedIds: string[] = [];

	while (ready.length > 0) {
		const nextId = ready.shift()!;
		orderedIds.push(nextId);

		const outgoing = edges.get(nextId);
		if (!outgoing) {
			continue;
		}

		[...outgoing].sort(compareSyncIds).forEach((targetId) => {
			const nextIndegree = (indegree.get(targetId) ?? 0) - 1;
			indegree.set(targetId, nextIndegree);
			if (nextIndegree === 0) {
				ready.push(targetId);
				ready.sort(compareSyncIds);
			}
		});
	}

	if (orderedIds.length !== matchedIds.size) {
		const remainingIds = [...matchedIds]
			.filter((syncId) => !orderedIds.includes(syncId))
			.sort(compareSyncIds);
		orderedIds.push(...remainingIds);
	}

	return orderedIds
		.map((syncId) => candidateGroups.get(syncId))
		.filter((group): group is SyncGroup => group !== undefined);
}

function getAccumulatedOffset(beforeByLine: Record<number, number>, lineNumber: number): number {
	let total = 0;

	for (const [rawLine, rawHeight] of Object.entries(beforeByLine)) {
		const line = Number(rawLine);
		if (line < lineNumber) {
			total += rawHeight;
		}
	}

	return total;
}

export function computeAlignmentPlanFromBaseTops(
	groups: SyncGroup[],
	baseTops: Record<string, Record<number, number>>
): ZonePlan {
	const threadIds = Object.keys(baseTops);
	const plan: ZonePlan = Object.fromEntries(threadIds.map((threadId) => [threadId, {}]));
	const getCurrentTop = ({ threadId, lineNumber }: SyncGroupOccurrence) => {
		const baseTop = baseTops[threadId]?.[lineNumber];
		if (baseTop === undefined) {
			return undefined;
		}

		return baseTop + getAccumulatedOffset(plan[threadId], lineNumber);
	};
	const applyAlignment = (occurrences: SyncGroupOccurrence[]) => {
		const measurable = occurrences
			.map((occurrence) => ({
				occurrence,
				top: getCurrentTop(occurrence),
			}))
			.filter(
				(entry): entry is { occurrence: SyncGroupOccurrence; top: number } =>
					entry.top !== undefined
			);

		if (measurable.length < 2) {
			return;
		}

		const targetTop = Math.max(...measurable.map((entry) => entry.top));

		measurable.forEach(({ occurrence, top }) => {
			const delta = targetTop - top;
			if (delta <= 0.5) {
				return;
			}

			plan[occurrence.threadId][occurrence.lineNumber] =
				(plan[occurrence.threadId][occurrence.lineNumber] ?? 0) + delta;
		});
	};

	groups.forEach((group) => {
		if (group.strategy === "align-all") {
			applyAlignment(group.occurrences);
			return;
		}

		const waitOccurrences = group.occurrences.filter(
			(occurrence) => occurrence.kind === "wait"
		);
		if (waitOccurrences.length === 0) {
			return;
		}

		const measurableWaits = waitOccurrences
			.map((occurrence) => ({
				occurrence,
				top: getCurrentTop(occurrence),
			}))
			.filter(
				(entry): entry is { occurrence: SyncGroupOccurrence; top: number } =>
					entry.top !== undefined
			);

		if (measurableWaits.length === 0) {
			return;
		}

		const measurableSets = group.occurrences
			.filter((occurrence) => occurrence.kind === "set")
			.map((occurrence) => ({
				occurrence,
				top: getCurrentTop(occurrence),
			}))
			.filter(
				(entry): entry is { occurrence: SyncGroupOccurrence; top: number } =>
					entry.top !== undefined
			);

		if (measurableSets.length === 0) {
			applyAlignment(waitOccurrences);
			return;
		}

		const anchorSet = measurableSets.reduce((best, current) =>
			current.top < best.top ? current : best
		);
		const targetTop = Math.max(anchorSet.top, ...measurableWaits.map((entry) => entry.top));

		measurableWaits.forEach(({ occurrence, top }) => {
			const delta = targetTop - top;
			if (delta <= 0.5) {
				return;
			}

			plan[occurrence.threadId][occurrence.lineNumber] =
				(plan[occurrence.threadId][occurrence.lineNumber] ?? 0) + delta;
		});
	});

	return plan;
}

export function clearViewZones(editor: Monaco.editor.IStandaloneCodeEditor, zoneIds: string[]) {
	editor.changeViewZones((accessor) => {
		zoneIds.forEach((zoneId) => accessor.removeZone(zoneId));
	});
}

export function addViewZone(
	editor: Monaco.editor.IStandaloneCodeEditor,
	lineNumber: number,
	heightInPx: number
): string {
	let zoneId = "";

	editor.changeViewZones((accessor) => {
		zoneId = accessor.addZone({
			afterLineNumber: Math.max(0, lineNumber - 1),
			heightInPx,
			domNode: makeZoneDom(heightInPx),
		});
	});

	return zoneId;
}

function makeZoneDom(heightInPx: number): HTMLDivElement {
	const node = document.createElement("div");
	node.style.display = "block";
	node.style.width = "100%";
	node.style.height = `${heightInPx}px`;
	node.style.pointerEvents = "none";
	node.style.background = "rgba(161, 161, 170, 0.08)";
	node.style.borderTop = "1px solid rgba(161, 161, 170, 0.1)";
	node.style.borderBottom = "1px solid rgba(161, 161, 170, 0.1)";
	node.style.boxSizing = "border-box";
	return node;
}
