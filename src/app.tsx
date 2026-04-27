import { useState } from "react";

import { css } from "@linaria/core";
import { styled } from "@linaria/react";

import { ConnectorOverlay } from "./components/ConnectorOverlay";
import { ThreadColumn } from "./components/ThreadColumn";
import { ThreadTabs } from "./components/ThreadTabs";
import { ThreadToolbar } from "./components/ThreadToolbar";
import { useThreadEditors } from "./hooks/useThreadEditors";
import { useWorkspaceManager } from "./hooks/useWorkspaceManager";
import { SYNC_DECORATION_COLOR_VALUES } from "./lib/sync-decoration-colors";
import { AppSurface, WorkspaceFrame, globalStyles, palette } from "./styles/ui";

const syncDecorationStyles = css`
	:global(:root) {
		--sync-decoration-color-sync: ${SYNC_DECORATION_COLOR_VALUES.sync};
		--sync-decoration-color-wait: ${SYNC_DECORATION_COLOR_VALUES.wait};
		--sync-decoration-color-set: ${SYNC_DECORATION_COLOR_VALUES.set};
	}

	:global(.sync-line-decoration) {
		--sync-decoration-color: var(--sync-decoration-color-sync);
		border-left-width: 2px;
		border-left-style: solid;
		border-left-color: color-mix(in srgb, var(--sync-decoration-color) 45%, transparent);
		background: color-mix(in srgb, var(--sync-decoration-color) 10%, transparent);
	}

	:global(.sync-line-decoration--wait) {
		--sync-decoration-color: var(--sync-decoration-color-wait);
	}

	:global(.sync-line-decoration--set) {
		--sync-decoration-color: var(--sync-decoration-color-set);
	}

	:global(.monaco-editor .sync-inline-tag) {
		--sync-decoration-color: var(--sync-decoration-color-sync);
		color: color-mix(in srgb, var(--sync-decoration-color) 60%, currentColor);
		opacity: 0.8;
	}

	:global(.monaco-editor .sync-inline-tag--wait) {
		--sync-decoration-color: var(--sync-decoration-color-wait);
	}

	:global(.monaco-editor .sync-inline-tag--set) {
		--sync-decoration-color: var(--sync-decoration-color-set);
	}

	:global(.monaco-editor .sync-inline-tag--error) {
		text-decoration: underline dotted red;
		text-underline-offset: 2px;
	}

	:global(.monaco-editor .selection-highlight) {
		background: rgba(0, 120, 215, 0.15);
		border-radius: 2px;
	}

	:global(.monaco-editor .line-comment-decoration) {
		color: color-mix(in srgb, currentColor 40%, white);
	}

	:global(.monaco-editor .lines-content .core-guide-indent) {
		box-shadow: none !important;
		background-image: linear-gradient(
			to bottom,
			var(--indent-color) 0 50%,
			transparent 50% 100%
		);
		background-position: left top;
		background-repeat: repeat-y;
		background-size: 1px 2px;
	}
`;

const ThreadCanvasViewport = styled.div`
	overflow-x: auto;
	overflow-y: hidden;
	padding-bottom: 8px;
`;

const ThreadCanvas = styled.div`
	position: relative;
	width: fit-content;
	min-width: 100%;
`;

const ThreadColumns = styled.div`
	display: grid;
	width: 100%;
	min-width: 100%;
	gap: 0;
	align-items: stretch;
`;

export default function ThreadCallPathVisualizer() {
	const [draggedThreadId, setDraggedThreadId] = useState<string | null>(null);
	const [dropIndex, setDropIndex] = useState<number | null>(null);
	const {
		threads,
		addThread,
		removeThread,
		moveThread,
		updateThread,
		updateThreadName,

		workspaces,
		activeWorkspace,
		switchWorkspace,
		createNewWorkspace,
		duplicateWorkspace,
		renameWorkspace,
		deleteWorkspace,
		showRestoreGettingStarted,
		gettingStartedUpdateAvailable,
		restoreGettingStarted,

		undo,
		redo,
		canUndo,
		canRedo,
		cursorAdapterRef,

		fileInputRef,
		importState,
		openImportPicker,
		exportWorkspaces,

		shareWorkspace,

		pushUndoSnapshot,
	} = useWorkspaceManager();
	const threadTrackTemplate = `repeat(${threads.length}, minmax(300px, 1fr))`;
	const {
		connectorOverlay,
		handleMount,
		getCursors,
		applyCursors,
		focusEditor,
		sharedEditorHeight,
		threadsCanvasRef,
		threadsContentRef,
	} = useThreadEditors(threads, pushUndoSnapshot);

	cursorAdapterRef.current = { getCursors, applyCursors, focusEditor };

	return (
		<AppSurface className={`${globalStyles} ${syncDecorationStyles}`}>
			<WorkspaceFrame>
				<ThreadToolbar
					fileInputRef={fileInputRef}
					workspaces={workspaces}
					activeWorkspace={activeWorkspace}
					canUndo={canUndo}
					canRedo={canRedo}
					onImportState={importState}
					onOpenImportPicker={openImportPicker}
					onExportWorkspaces={exportWorkspaces}
					onSwitchWorkspace={switchWorkspace}
					onCreateWorkspace={createNewWorkspace}
					onDuplicateWorkspace={duplicateWorkspace}
					onRenameWorkspace={renameWorkspace}
					onDeleteWorkspace={deleteWorkspace}
					showRestoreGettingStarted={showRestoreGettingStarted}
					gettingStartedUpdateAvailable={gettingStartedUpdateAvailable}
					onRestoreGettingStarted={restoreGettingStarted}
					onAddThread={addThread}
					onUndo={undo}
					onRedo={redo}
					onShare={shareWorkspace}
				/>

				<ThreadCanvasViewport>
					<ThreadTabs
						trackTemplate={threadTrackTemplate}
						threads={threads}
						activeDragThreadId={draggedThreadId}
						dropIndex={dropIndex}
						onDragStart={(threadId) => {
							setDraggedThreadId(threadId);
							setDropIndex(null);
						}}
						onDragEnd={() => {
							setDraggedThreadId(null);
							setDropIndex(null);
						}}
						onDragOver={(nextIndex) => {
							if (draggedThreadId) {
								setDropIndex(nextIndex);
							}
						}}
						onDrop={(nextIndex) => {
							if (draggedThreadId) {
								moveThread(draggedThreadId, nextIndex);
							}
							setDraggedThreadId(null);
							setDropIndex(null);
						}}
						onNameChange={updateThreadName}
						onRemove={removeThread}
					/>

					<ThreadCanvas ref={threadsCanvasRef}>
						<ConnectorOverlay overlay={connectorOverlay} />

						<ThreadColumns
							ref={threadsContentRef}
							style={{ gridTemplateColumns: threadTrackTemplate }}
						>
							{threads.map((thread) => (
								<ThreadColumn
									key={thread.id}
									thread={thread}
									sharedEditorHeight={sharedEditorHeight}
									onCodeChange={updateThread}
									onMount={handleMount}
								/>
							))}
						</ThreadColumns>
					</ThreadCanvas>
				</ThreadCanvasViewport>
			</WorkspaceFrame>
		</AppSurface>
	);
}
