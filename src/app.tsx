import { useState } from "react";

import { css } from "@linaria/core";
import { styled } from "@linaria/react";

import { ConnectorOverlay } from "./components/ConnectorOverlay";
import { SavedStatesPanel } from "./components/SavedStatesPanel";
import { StateJsonPanel } from "./components/StateJsonPanel";
import { ThreadColumn } from "./components/ThreadColumn";
import { ThreadTabs } from "./components/ThreadTabs";
import { ThreadToolbar } from "./components/ThreadToolbar";
import { useThreadEditors } from "./hooks/useThreadEditors";
import { useThreadVisualizerState } from "./hooks/useThreadVisualizerState";
import { AppSurface, WorkspaceFrame, globalStyles, palette } from "./styles/ui";

const syncDecorationStyles = css`
	:global(.sync-line-decoration) {
		--sync-decoration-color: rgb(92, 151, 245);
		border-left-width: 2px;
		border-left-style: solid;
		border-left-color: color-mix(in srgb, var(--sync-decoration-color) 45%, transparent);
		background: color-mix(in srgb, var(--sync-decoration-color) 15%, transparent);
	}

	:global(.sync-line-decoration--wait) {
		--sync-decoration-color: rgb(255, 196, 0);
	}

	:global(.sync-line-decoration--set) {
		--sync-decoration-color: rgb(74, 209, 124);
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
		addThread,
		applyStateText,
		copyState,
		copyStateLabel,
		deleteSavedState,
		fileInputRef,
		importState,
		isStatePanelOpen,
		loadSavedState,
		moveThread,
		openImportPicker,
		saveActionLabel,
		saveCurrentState,
		saveName,
		savedStates,
		setSaveName,
		setStateText,
		showState,
		stateText,
		threads,
		updateSavedState,
		updateThread,
		updateThreadName,
		removeThread,
	} = useThreadVisualizerState();
	const threadTrackTemplate = `repeat(${threads.length}, minmax(300px, 1fr))`;
	const {
		connectorOverlay,
		handleMount,
		sharedEditorHeight,
		threadsCanvasRef,
		threadsContentRef,
	} = useThreadEditors(threads);

	return (
		<AppSurface className={`${globalStyles} ${syncDecorationStyles}`}>
			<WorkspaceFrame>
				<ThreadToolbar
					fileInputRef={fileInputRef}
					saveName={saveName}
					saveActionLabel={saveActionLabel}
					isStatePanelOpen={isStatePanelOpen}
					onImportState={importState}
					onSaveNameChange={setSaveName}
					onSaveCurrentState={saveCurrentState}
					onToggleState={showState}
					onOpenImportPicker={openImportPicker}
				/>

				<SavedStatesPanel
					savedStates={savedStates}
					onLoad={loadSavedState}
					onUpdate={updateSavedState}
					onDelete={deleteSavedState}
				/>

				{isStatePanelOpen && (
					<StateJsonPanel
						copyStateLabel={copyStateLabel}
						stateText={stateText}
						onCopy={copyState}
						onApply={applyStateText}
						onChange={setStateText}
					/>
				)}

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
						onAddThread={addThread}
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
