import type {
	MatchedSyncGroupsResult,
	LineStyleDecoration,
	LineStyleTagKind,
	SyncGroup,
	SyncGroupOccurrence,
	SyncLineDecoration,
	SyncMarker,
	SyncMarkerError,
	SyncTagDecoration,
	SyncTagKind,
	Thread,
	ZoneAdjustment,
	ZonePlan,
} from "./thread-visualizer-types";

export const SYNC_PATTERN = /\[(sync|wait|set)\s+([^\]\s]+)\s*\]/gi;
export const LINE_STYLE_TAG_PATTERN = /\[(em|skip)\]/gi;

type LineStyleDecorations = {
	tags: LineStyleDecoration[];
	text: LineStyleDecoration[];
};

type SyncOccurrence = {
	id: string;
	lineNumber: number;
};

function getLineCommentStart(line: string): number {
	return line.indexOf("#");
}

function getLineCodeSegment(line: string): string {
	const commentStart = getLineCommentStart(line);
	return commentStart === -1 ? line : line.slice(0, commentStart);
}

function hasSkipTag(line: string): boolean {
	return /\[skip\]/i.test(line);
}

function parseFirstSyncs(text: string): SyncOccurrence[] {
	const seen = new Set<string>();
	const lines = text.split(/\r?\n/);
	const occurrences: SyncOccurrence[] = [];

	for (let index = 0; index < lines.length; index += 1) {
		const line = getLineCodeSegment(lines[index]);
		if (hasSkipTag(line)) {
			continue;
		}

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
		const codeSegment = getLineCodeSegment(line);
		if (hasSkipTag(codeSegment)) {
			return;
		}

		const matcher = new RegExp(SYNC_PATTERN.source, SYNC_PATTERN.flags);
		let match: RegExpExecArray | null = null;

		while ((match = matcher.exec(codeSegment)) !== null) {
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

export function collectSyncTagDecorations(text: string): SyncTagDecoration[] {
	const lines = text.split(/\r?\n/);
	const decorations: SyncTagDecoration[] = [];

	lines.forEach((line, index) => {
		const codeSegment = getLineCodeSegment(line);
		const ignored = hasSkipTag(codeSegment);
		const matcher = new RegExp(SYNC_PATTERN.source, SYNC_PATTERN.flags);
		let match: RegExpExecArray | null = null;

		while ((match = matcher.exec(codeSegment)) !== null) {
			const fullMatch = match[0];
			const id = match[2].trim();
			if (!id) {
				continue;
			}

			decorations.push({
				id,
				kind: match[1].toLowerCase() as SyncTagKind,
				lineNumber: index + 1,
				startColumn: match.index + 1,
				endColumn: match.index + fullMatch.length + 1,
				ignored,
			});
		}
	});

	return decorations;
}

export function collectLineStyleDecorations(text: string): LineStyleDecorations {
	const lines = text.split(/\r?\n/);
	const tags: LineStyleDecoration[] = [];
	const styledLines = new Map<number, LineStyleTagKind>();

	lines.forEach((line, index) => {
		const codeSegment = getLineCodeSegment(line);
		const matcher = new RegExp(LINE_STYLE_TAG_PATTERN.source, LINE_STYLE_TAG_PATTERN.flags);
		let match: RegExpExecArray | null = null;

		while ((match = matcher.exec(codeSegment)) !== null) {
			const kind = match[1].toLowerCase() as LineStyleTagKind;
			const lineNumber = index + 1;
			if (kind === "skip" || !styledLines.has(lineNumber)) {
				styledLines.set(lineNumber, kind);
			}

			tags.push({
				kind,
				lineNumber,
				startColumn: match.index + 1,
				endColumn: match.index + match[0].length + 1,
			});
		}
	});

	return {
		tags,
		text: collectLineStyleTextDecorations(lines, styledLines),
	};
}

function collectLineStyleTextDecorations(
	lines: string[],
	styledLines: Map<number, LineStyleTagKind>
): LineStyleDecoration[] {
	const decorations: LineStyleDecoration[] = [];

	for (const [lineNumber, kind] of styledLines) {
		const line = lines[lineNumber - 1] ?? "";
		const codeSegment = getLineCodeSegment(line);
		const excludedRanges = [
			...collectKnownTagRanges(codeSegment, LINE_STYLE_TAG_PATTERN),
			...collectKnownTagRanges(codeSegment, SYNC_PATTERN),
		].sort((a, b) => a.startColumn - b.startColumn);
		let startColumn = 1;

		for (const excludedRange of excludedRanges) {
			pushNonEmptyLineStyleRange(
				decorations,
				line,
				kind,
				lineNumber,
				startColumn,
				excludedRange.startColumn
			);
			startColumn = Math.max(startColumn, excludedRange.endColumn);
		}

		pushNonEmptyLineStyleRange(
			decorations,
			line,
			kind,
			lineNumber,
			startColumn,
			line.length + 1
		);
	}

	return decorations;
}

function collectKnownTagRanges(
	line: string,
	pattern: RegExp
): Array<{ startColumn: number; endColumn: number }> {
	const ranges: Array<{ startColumn: number; endColumn: number }> = [];
	const matcher = new RegExp(pattern.source, pattern.flags);
	let match: RegExpExecArray | null = null;

	while ((match = matcher.exec(line)) !== null) {
		ranges.push({
			startColumn: match.index + 1,
			endColumn: match.index + match[0].length + 1,
		});
	}

	return ranges;
}

function pushNonEmptyLineStyleRange(
	decorations: LineStyleDecoration[],
	line: string,
	kind: LineStyleTagKind,
	lineNumber: number,
	startColumn: number,
	endColumn: number
): void {
	if (
		endColumn <= startColumn ||
		line.slice(startColumn - 1, endColumn - 1).trim().length === 0
	) {
		return;
	}

	decorations.push({
		kind,
		lineNumber,
		startColumn,
		endColumn,
	});
}

export function collectLineCommentDecorations(text: string): Array<{
	lineNumber: number;
	startColumn: number;
	endColumn: number;
}> {
	const lines = text.split(/\r?\n/);
	const decorations: Array<{
		lineNumber: number;
		startColumn: number;
		endColumn: number;
	}> = [];

	lines.forEach((line, index) => {
		const commentStart = getLineCommentStart(line);
		if (commentStart === -1) {
			return;
		}

		decorations.push({
			lineNumber: index + 1,
			startColumn: commentStart + 1,
			endColumn: line.length + 1,
		});
	});

	return decorations;
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

export function collectMatchedSyncGroups(threads: Thread[]): MatchedSyncGroupsResult {
	const grouped = new Map<string, SyncGroupOccurrence[]>();
	const perThreadSequences: Array<Array<{ id: string; lineNumber: number }>> = [];
	const lineStats = new Map<string, { min: number; sum: number; count: number }>();
	const seenSetIdsByThread = new Map<string, Set<string>>();

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

			// Only the FIRST set per id in a thread participates in alignment.
			// Repeating sets later in the same thread for the same id are
			// ignored (they still get highlighted via decorations, but never
			// act as anchors).
			if (kind === "set") {
				const seenForThread = seenSetIdsByThread.get(thread.id) ?? new Set<string>();
				if (seenForThread.has(id)) {
					return;
				}
				seenForThread.add(id);
				seenSetIdsByThread.set(thread.id, seenForThread);
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

	// For each (thread, id) the line of the first wait, used to exclude sets
	// that come at/after a wait in the same thread (those are reported as
	// `set-after-wait-in-thread` errors and must not act as alignment anchors,
	// otherwise the wait would expand to align with the invalid set below it).
	const firstWaitLineByThreadId = new Map<string, Map<string, number>>();
	threads.forEach((thread) => {
		const perThread = new Map<string, number>();
		collectSyncMarkers(thread.code).forEach(({ id, kind, lineNumber }) => {
			if (kind === "wait" && !perThread.has(id)) {
				perThread.set(id, lineNumber);
			}
		});
		firstWaitLineByThreadId.set(thread.id, perThread);
	});

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
		const setOccurrences = occurrences
			.filter((occurrence) => occurrence.kind === "set")
			.filter((setOccurrence) => {
				const firstWaitLine = firstWaitLineByThreadId.get(setOccurrence.threadId)?.get(id);
				// Exclude same-thread sets that appear at/after the first wait
				// of the same id in that thread — those are invalid anchors.
				return firstWaitLine === undefined || setOccurrence.lineNumber < firstWaitLine;
			});

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

		// Wait-only ids do NOT form an alignment group. Each wait is just an
		// unsatisfied wait and is reported via `errors` below; they should
		// render at their natural one-line height with no expansion.
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

	// Cycle detection moved out of this function: it requires line-top
	// positions to determine which set is the global anchor for each id.
	// See detectHarmfulSyncCycles, called by the alignment caller.

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
	const buildFallbackOrder = (ids: string[]): string[] => {
		const visited = new Set<string>();
		const visiting = new Set<string>();
		const postOrder: string[] = [];
		const sortedIds = [...ids].sort(compareSyncIds);

		const visit = (syncId: string) => {
			if (visited.has(syncId)) {
				return;
			}
			if (visiting.has(syncId)) {
				return;
			}

			visiting.add(syncId);
			const outgoing = edges.get(syncId);
			if (outgoing) {
				[...outgoing]
					.filter((targetId) => ids.includes(targetId))
					.sort(compareSyncIds)
					.forEach(visit);
			}
			visiting.delete(syncId);
			visited.add(syncId);
			postOrder.push(syncId);
		};

		sortedIds.forEach(visit);
		return postOrder.reverse();
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
		const remainingIds = buildFallbackOrder(
			[...matchedIds].filter((syncId) => !orderedIds.includes(syncId))
		);
		orderedIds.push(...remainingIds);
	}

	const errors = collectSyncMarkerErrors(threads);

	return {
		groups: orderedIds
			.map((syncId) => candidateGroups.get(syncId))
			.filter((group): group is SyncGroup => group !== undefined),
		cyclicIds: new Set<string>(),
		errors,
	};
}

/**
 * Compute per-occurrence semantic errors for sync markers:
 *   - `wait-without-set`:        a wait whose id has no set in any thread.
 *   - `set-without-wait`:        a set whose id has no wait in any thread.
 *   - `set-after-wait-in-thread`: a set that appears at or below a wait of
 *     the same id in the same thread (sets must precede waits in a thread).
 *   - `duplicate-sync-in-thread`: every sync after the first occurrence of
 *     the same id in the same thread.
 */
function collectSyncMarkerErrors(threads: Thread[]): SyncMarkerError[] {
	const errors: SyncMarkerError[] = [];
	const idHasWait = new Set<string>();
	const idHasSet = new Set<string>();

	const perThread = threads.map((thread) => ({
		threadId: thread.id,
		markers: collectSyncMarkers(thread.code),
	}));

	perThread.forEach(({ markers }) => {
		markers.forEach(({ id, kind }) => {
			if (kind === "wait") {
				idHasWait.add(id);
			} else if (kind === "set") {
				idHasSet.add(id);
			}
		});
	});

	perThread.forEach(({ threadId, markers }) => {
		const firstWaitLineById = new Map<string, number>();
		const seenSyncLines = new Map<string, number>();

		markers.forEach(({ id, kind, lineNumber }) => {
			if (kind === "wait" && !firstWaitLineById.has(id)) {
				firstWaitLineById.set(id, lineNumber);
			}
		});

		markers.forEach((marker) => {
			const { id, kind, lineNumber } = marker;

			if (kind === "wait") {
				if (!idHasSet.has(id)) {
					errors.push({ threadId, id, kind, lineNumber, reason: "wait-without-set" });
				}
				return;
			}

			if (kind === "set") {
				if (!idHasWait.has(id)) {
					errors.push({ threadId, id, kind, lineNumber, reason: "set-without-wait" });
					return;
				}
				const firstWaitLine = firstWaitLineById.get(id);
				if (firstWaitLine !== undefined && lineNumber >= firstWaitLine) {
					errors.push({
						threadId,
						id,
						kind,
						lineNumber,
						reason: "set-after-wait-in-thread",
					});
				}
				return;
			}

			// kind === "sync"
			if (seenSyncLines.has(id)) {
				errors.push({
					threadId,
					id,
					kind,
					lineNumber,
					reason: "duplicate-sync-in-thread",
				});
			} else {
				seenSyncLines.set(id, lineNumber);
			}
		});
	});

	return errors;
}

/**
 * Detect harmful sync-id cycles using line-top positions.
 *
 * A "harmful" edge A → B exists in some thread T when adding a zone for a
 * marker of id A in T would push the *anchor* for id B in T downward,
 * forcing further alignment growth that can chain back to A.
 *
 * Anchor selection per id B (using baseTops):
 *   - For ids with at least one set: anchor = the single set with the
 *     globally smallest baseTop. Other sets of B (in any thread, including
 *     repeats in the same thread) are non-anchors and don't participate.
 *   - For sync-only groups: every sync of B is treated as an anchor (they
 *     align with each other).
 *   - For wait-only groups: every wait of B is treated as an anchor (they
 *     align with each other).
 *
 * Edge condition for expander A at line L_a, anchor of B at line L_b in
 * the same thread:
 *   - wait-anchored zones are placed "after" L_a → push lines > L_a
 *   - sync-anchored zones are placed "before" L_a → push lines >= L_a
 */
export function detectHarmfulSyncCycles(
	threads: Thread[],
	matchedIds: Set<string>,
	baseTops: Record<string, Record<number, number>>,
	groupStrategyById: Map<string, SyncGroup["strategy"]>
): Set<string> {
	if (matchedIds.size === 0) {
		return new Set();
	}

	type AnchorInstance = { threadId: string; lineNumber: number; kind: SyncTagKind };
	const anchorsById = new Map<string, AnchorInstance[]>();
	matchedIds.forEach((id) => anchorsById.set(id, []));

	const perThreadMarkers: Array<{ threadId: string; markers: SyncMarker[] }> = threads.map(
		(thread) => ({
			threadId: thread.id,
			markers: collectSyncMarkers(thread.code),
		})
	);

	// Collect all candidate anchor instances per id.
	const setInstancesById = new Map<string, AnchorInstance[]>();
	perThreadMarkers.forEach(({ threadId, markers }) => {
		const seenSetByThread = new Set<string>();
		const seenSyncByThread = new Set<string>();
		markers.forEach(({ id, kind, lineNumber }) => {
			if (!matchedIds.has(id)) {
				return;
			}
			if (kind === "set") {
				if (seenSetByThread.has(id)) {
					return;
				}
				seenSetByThread.add(id);
				const arr = setInstancesById.get(id) ?? [];
				arr.push({ threadId, lineNumber, kind });
				setInstancesById.set(id, arr);
			} else if (kind === "sync") {
				if (seenSyncByThread.has(id)) {
					return;
				}
				seenSyncByThread.add(id);
				const arr = anchorsById.get(id);
				if (arr) {
					arr.push({ threadId, lineNumber, kind });
				}
			} else {
				// wait
				const strategy = groupStrategyById.get(id);
				if (strategy === "align-all") {
					// Wait-only group: each wait is an anchor for the others.
					const arr = anchorsById.get(id);
					if (arr) {
						arr.push({ threadId, lineNumber, kind });
					}
				}
			}
		});
	});

	// For ids with sets, pick the single global anchor set: the one with the
	// smallest baseTop. This matches the runtime alignment choice.
	setInstancesById.forEach((instances, id) => {
		let best: AnchorInstance | undefined;
		let bestTop = Number.POSITIVE_INFINITY;
		instances.forEach((instance) => {
			const top = baseTops[instance.threadId]?.[instance.lineNumber];
			if (top === undefined) {
				return;
			}
			if (top < bestTop) {
				bestTop = top;
				best = instance;
			}
		});
		if (best) {
			anchorsById.get(id)!.push(best);
		}
	});

	// Build harmful-edges graph.
	const harmfulEdges = new Map<string, Set<string>>();
	matchedIds.forEach((id) => harmfulEdges.set(id, new Set()));

	perThreadMarkers.forEach(({ threadId, markers }) => {
		const expanders = markers.filter(
			(marker) => marker.kind === "wait" || marker.kind === "sync"
		);
		// Only consider anchors that live in this same thread — pushing a
		// marker line in thread T cannot move a marker in thread T'.
		expanders.forEach((expander) => {
			if (!matchedIds.has(expander.id)) {
				return;
			}
			matchedIds.forEach((targetId) => {
				if (targetId === expander.id) {
					return;
				}
				const targetAnchors = anchorsById.get(targetId);
				if (!targetAnchors) {
					return;
				}
				for (const anchor of targetAnchors) {
					if (anchor.threadId !== threadId) {
						continue;
					}
					const pushes =
						expander.kind === "wait"
							? anchor.lineNumber > expander.lineNumber
							: anchor.lineNumber >= expander.lineNumber;
					if (pushes) {
						harmfulEdges.get(expander.id)!.add(targetId);
						break;
					}
				}
			});
		});
	});

	return findCyclicSyncIds(matchedIds, harmfulEdges);
}

function findCyclicSyncIds(matchedIds: Set<string>, edges: Map<string, Set<string>>): Set<string> {
	const cyclic = new Set<string>();
	const index = new Map<string, number>();
	const lowlink = new Map<string, number>();
	const onStack = new Set<string>();
	const stack: string[] = [];
	let nextIndex = 0;

	// Iterative Tarjan's SCC to avoid recursion stack limits.
	type Frame = { v: string; outIter: Iterator<string>; pendingChild?: string };
	const run = (start: string) => {
		const frames: Frame[] = [];
		const push = (v: string) => {
			index.set(v, nextIndex);
			lowlink.set(v, nextIndex);
			nextIndex += 1;
			stack.push(v);
			onStack.add(v);
			const outgoing = edges.get(v);
			frames.push({
				v,
				outIter: (outgoing ?? new Set<string>()).values(),
			});
		};

		push(start);

		while (frames.length > 0) {
			const frame = frames[frames.length - 1];
			if (frame.pendingChild !== undefined) {
				const w = frame.pendingChild;
				frame.pendingChild = undefined;
				lowlink.set(frame.v, Math.min(lowlink.get(frame.v)!, lowlink.get(w)!));
			}

			let advanced = false;
			while (true) {
				const { value: w, done } = frame.outIter.next();
				if (done) {
					break;
				}
				if (!matchedIds.has(w)) {
					continue;
				}
				if (!index.has(w)) {
					frame.pendingChild = w;
					push(w);
					advanced = true;
					break;
				} else if (onStack.has(w)) {
					lowlink.set(frame.v, Math.min(lowlink.get(frame.v)!, index.get(w)!));
				}
			}

			if (advanced) {
				continue;
			}

			if (lowlink.get(frame.v) === index.get(frame.v)) {
				const scc: string[] = [];
				while (true) {
					const w = stack.pop()!;
					onStack.delete(w);
					scc.push(w);
					if (w === frame.v) {
						break;
					}
				}
				const hasSelfLoop = edges.get(frame.v)?.has(frame.v) ?? false;
				if (scc.length > 1 || hasSelfLoop) {
					scc.forEach((id) => cyclic.add(id));
				}
			}

			frames.pop();
		}
	};

	for (const id of matchedIds) {
		if (!index.has(id)) {
			run(id);
		}
	}

	return cyclic;
}

function buildZoneAdjustment(kind: SyncTagKind, height: number): ZoneAdjustment {
	return {
		height,
		kind,
		placement: kind === "wait" ? "after" : "before",
	};
}

export function computeAlignmentPlanFromBaseTops(
	groups: SyncGroup[],
	baseTops: Record<string, Record<number, number>>
): ZonePlan {
	const threadIds = Object.keys(baseTops);
	const emptyPlan = (): ZonePlan =>
		Object.fromEntries(threadIds.map((threadId) => [threadId, {}]));

	// Top of the occurrence's line excluding the occurrence's OWN zone at
	// that line. This is the "natural" top to compare against when computing
	// alignment targets — including the own zone would lock in stale values
	// from prior passes (recordZone keeps the max, so it can't shrink).
	const baseTopExcludingOwn = (
		occurrence: SyncGroupOccurrence,
		plan: ZonePlan
	): number | undefined => {
		const baseTop = baseTops[occurrence.threadId]?.[occurrence.lineNumber];
		if (baseTop === undefined) {
			return undefined;
		}

		const threadPlan = plan[occurrence.threadId] ?? {};
		let total = baseTop;
		for (const [rawLine, adjustment] of Object.entries(threadPlan)) {
			const line = Number(rawLine);
			if (line < occurrence.lineNumber) {
				total += adjustment.height;
			}
		}
		return total;
	};

	const recordZone = (nextPlan: ZonePlan, occurrence: SyncGroupOccurrence, height: number) => {
		if (height <= 0.5) {
			return;
		}

		const adjustment = buildZoneAdjustment(occurrence.kind, height);
		const threadPlan = nextPlan[occurrence.threadId];
		const existing = threadPlan[occurrence.lineNumber];
		// Multiple constraints at the same (thread, line) are satisfied by a
		// single zone of the maximum required height (not the sum) so iterating
		// to a fixed point cannot diverge.
		if (!existing || existing.height < adjustment.height) {
			threadPlan[occurrence.lineNumber] = adjustment;
		}
	};

	const computeNextPlan = (prevPlan: ZonePlan): ZonePlan => {
		const nextPlan = emptyPlan();

		groups.forEach((group) => {
			if (group.strategy === "align-all") {
				const measurable = group.occurrences
					.map((occurrence) => ({
						occurrence,
						top: baseTopExcludingOwn(occurrence, prevPlan),
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
					recordZone(nextPlan, occurrence, targetTop - top);
				});
				return;
			}

			const waitOccurrences = group.occurrences.filter(
				(occurrence) => occurrence.kind === "wait"
			);
			if (waitOccurrences.length === 0) {
				return;
			}

			const measurableSets = group.occurrences
				.filter((occurrence) => occurrence.kind === "set")
				.map((occurrence) => ({
					occurrence,
					top: baseTopExcludingOwn(occurrence, prevPlan),
				}))
				.filter(
					(entry): entry is { occurrence: SyncGroupOccurrence; top: number } =>
						entry.top !== undefined
				);

			if (measurableSets.length === 0) {
				const measurableWaits = waitOccurrences
					.map((occurrence) => ({
						occurrence,
						top: baseTopExcludingOwn(occurrence, prevPlan),
					}))
					.filter(
						(entry): entry is { occurrence: SyncGroupOccurrence; top: number } =>
							entry.top !== undefined
					);

				if (measurableWaits.length < 2) {
					return;
				}

				const targetTop = Math.max(...measurableWaits.map((entry) => entry.top));

				measurableWaits.forEach(({ occurrence, top }) => {
					recordZone(nextPlan, occurrence, targetTop - top);
				});
				return;
			}

			// Anchor = the first-in-time set (smallest natural top). Only the first
			// set matters; later sets do not constrain waits.
			const anchorSet = measurableSets.reduce((best, current) =>
				current.top < best.top ? current : best
			);

			waitOccurrences.forEach((occurrence) => {
				const baseExcl = baseTopExcludingOwn(occurrence, prevPlan);
				if (baseExcl === undefined) {
					return;
				}
				// Each wait extends independently to reach the first-in-time set.
				// If the wait would already be at or past the anchor set,
				// the required height is <= 0 and recordZone no-ops.
				recordZone(nextPlan, occurrence, anchorSet.top - baseExcl);
			});
		});

		return nextPlan;
	};

	const localPlansEqual = (a: ZonePlan, b: ZonePlan): boolean => zonePlansEqual(a, b, threadIds);

	let plan = emptyPlan();
	const MAX_PASSES = 32;
	for (let pass = 0; pass < MAX_PASSES; pass += 1) {
		const nextPlan = computeNextPlan(plan);
		if (localPlansEqual(nextPlan, plan)) {
			return nextPlan;
		}
		plan = nextPlan;
	}
	return plan;
}

/**
 * Structural equality on `ZonePlan`s, tolerant of sub-pixel height jitter.
 * If `threadIds` is omitted, compares the union of keys from both plans.
 */
export function zonePlansEqual(a: ZonePlan, b: ZonePlan, threadIds?: string[]): boolean {
	const ids = threadIds ?? [...new Set([...Object.keys(a), ...Object.keys(b)])];
	for (const threadId of ids) {
		const lhs = a[threadId] ?? {};
		const rhs = b[threadId] ?? {};
		const lhsKeys = Object.keys(lhs);
		const rhsKeys = Object.keys(rhs);
		if (lhsKeys.length !== rhsKeys.length) {
			return false;
		}
		for (const key of lhsKeys) {
			const left = lhs[Number(key)];
			const right = rhs[Number(key)];
			if (!right) {
				return false;
			}
			if (
				Math.abs(left.height - right.height) > 0.5 ||
				left.placement !== right.placement ||
				left.kind !== right.kind
			) {
				return false;
			}
		}
	}
	return true;
}
