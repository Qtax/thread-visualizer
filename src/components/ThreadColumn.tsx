import Editor from "@monaco-editor/react";
import { styled } from "@linaria/react";
import type * as Monaco from "monaco-editor";

import type { Thread } from "../lib/thread-visualizer-types";
import { palette } from "../styles/ui";

const ThreadEditorSurface = styled.div`
	overflow: hidden;
	border: 1px solid ${palette.border};
	border-top: 0;
	background: ${palette.surface};
`;

const ThreadEditorInset = styled.div`
	padding-right: 10px;
	background: ${palette.surface};
`;

const ThreadCard = styled.div`
	display: flex;
	flex-direction: column;

	& + & ${ThreadEditorSurface} {
		border-left: 0;
	}
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
	sharedEditorHeight: number;
	onCodeChange: (threadId: string, nextCode: string) => void;
	onMount: (
		threadId: string
	) => (
		editor: Monaco.editor.IStandaloneCodeEditor,
		monaco: typeof import("monaco-editor")
	) => void;
};

export function ThreadColumn({
	thread,
	sharedEditorHeight,
	onCodeChange,
	onMount,
}: ThreadColumnProps) {
	return (
		<ThreadCard>
			<ThreadEditorSurface>
				<ThreadEditorInset>
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
				</ThreadEditorInset>
			</ThreadEditorSurface>
		</ThreadCard>
	);
}
