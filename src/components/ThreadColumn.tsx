import Editor from "@monaco-editor/react";
import { styled } from "@linaria/react";
import type * as Monaco from "monaco-editor";

import type { Thread } from "../lib/thread-visualizer-types";
import { ControlButton, FieldInput, SurfacePanel, palette } from "../styles/ui";

const ThreadCard = styled(SurfacePanel)`
	margin-bottom: 0;
	display: flex;
	min-width: 150px;
	flex: 1 1 150px;
	flex-direction: column;
`;

const ThreadHeader = styled.div`
	display: flex;
	align-items: center;
	gap: 6px;
	margin-bottom: 8px;
`;

const ThreadNameField = styled(FieldInput)`
	flex: 1;
	font-weight: 600;
`;

const ThreadShiftButton = styled(ControlButton)`
	padding-right: 10px;
	padding-left: 10px;
`;

const ThreadRemoveButton = styled(ControlButton)``;

const ThreadEditorSurface = styled.div`
	overflow: hidden;
	border: 1px solid ${palette.border};
	border-radius: 16px;
	background: ${palette.surface};
`;

const THREAD_EDITOR_OPTIONS = {
	automaticLayout: true,
	lineNumbers: "off",
	glyphMargin: false,
	folding: false,
	minimap: { enabled: false },
	overviewRulerLanes: 0,
	hideCursorInOverviewRuler: true,
	renderLineHighlight: "none",
	roundedSelection: true,
	scrollBeyondLastLine: false,
	scrollbar: {
		vertical: "hidden",
		horizontal: "hidden",
		alwaysConsumeMouseWheel: false,
	},
	wordWrap: "on",
	wrappingIndent: "indent",
	padding: { top: 8, bottom: 8 },
	guides: { indentation: false },
	quickSuggestions: false,
	suggestOnTriggerCharacters: false,
	occurrencesHighlight: "off",
	selectionHighlight: false,
	contextmenu: true,
	bracketPairColorization: { enabled: false },
} as const;

type ThreadColumnProps = {
	thread: Thread;
	index: number;
	threadsLength: number;
	sharedEditorHeight: number;
	onCodeChange: (threadId: string, nextCode: string) => void;
	onNameChange: (threadId: string, nextName: string) => void;
	onMove: (threadId: string, direction: -1 | 1) => void;
	onRemove: (threadId: string) => void;
	onMount: (
		threadId: string
	) => (
		editor: Monaco.editor.IStandaloneCodeEditor,
		monaco: typeof import("monaco-editor")
	) => void;
};

export function ThreadColumn({
	thread,
	index,
	threadsLength,
	sharedEditorHeight,
	onCodeChange,
	onNameChange,
	onMove,
	onRemove,
	onMount,
}: ThreadColumnProps) {
	return (
		<ThreadCard>
			<ThreadHeader>
				<ThreadNameField
					value={thread.name}
					onChange={(event) => onNameChange(thread.id, event.target.value)}
				/>

				<ThreadShiftButton
					type="button"
					onClick={() => onMove(thread.id, -1)}
					disabled={index === 0}
					title="Move left"
				>
					←
				</ThreadShiftButton>

				<ThreadShiftButton
					type="button"
					onClick={() => onMove(thread.id, 1)}
					disabled={index === threadsLength - 1}
					title="Move right"
				>
					→
				</ThreadShiftButton>

				<ThreadRemoveButton
					type="button"
					onClick={() => onRemove(thread.id)}
					disabled={threadsLength === 1}
					title={
						threadsLength === 1 ? "At least one thread is required" : "Remove thread"
					}
				>
					Remove
				</ThreadRemoveButton>
			</ThreadHeader>

			<ThreadEditorSurface>
				<Editor
					path={`thread-${thread.id}.txt`}
					defaultLanguage="plaintext"
					theme="vs"
					height={sharedEditorHeight}
					value={thread.code}
					onChange={(value) => onCodeChange(thread.id, value ?? "")}
					onMount={onMount(thread.id)}
					options={THREAD_EDITOR_OPTIONS}
				/>
			</ThreadEditorSurface>
		</ThreadCard>
	);
}
