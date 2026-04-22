import { css } from "@linaria/core";
import { styled } from "@linaria/react";

import { ConnectorOverlay } from "./components/ConnectorOverlay";
import { SavedStatesPanel } from "./components/SavedStatesPanel";
import { StateJsonPanel } from "./components/StateJsonPanel";
import { ThreadColumn } from "./components/ThreadColumn";
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
	padding-bottom: 8px;
`;

const ThreadCanvas = styled.div`
	position: relative;
	min-width: 100%;
`;

const ThreadColumns = styled.div`
	display: flex;
	min-width: 100%;
	gap: 8px;
	align-items: stretch;
`;

export default function ThreadCallPathVisualizer() {
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
					onAddThread={addThread}
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
					<ThreadCanvas ref={threadsCanvasRef}>
						<ConnectorOverlay overlay={connectorOverlay} />

						<ThreadColumns ref={threadsContentRef}>
							{threads.map((thread, index) => (
								<ThreadColumn
									key={thread.id}
									thread={thread}
									index={index}
									threadsLength={threads.length}
									sharedEditorHeight={sharedEditorHeight}
									onCodeChange={updateThread}
									onNameChange={updateThreadName}
									onMove={moveThread}
									onRemove={removeThread}
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
