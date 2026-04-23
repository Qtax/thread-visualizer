import type { ChangeEvent, MutableRefObject } from "react";

import { styled } from "@linaria/react";

import type { Workspace } from "../lib/thread-visualizer-types";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { ControlButton, HiddenFileInput, InlineCode, palette } from "../styles/ui";

const Toolbar = styled.header`
	display: flex;
	flex-wrap: wrap;
	align-items: flex-start;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 12px;
`;

const ToolbarIntro = styled.div`
	max-width: 42rem;
`;

const ToolbarTitle = styled.h1`
	margin: 0;
	font-size: 1.35rem;
	font-weight: 700;
	letter-spacing: -0.02em;
`;

const ToolbarDescription = styled.p`
	margin: 4px 0 0;
	font-size: 0.75rem;
	line-height: 1.5;
	color: ${palette.mutedText};
`;

const ToolbarActions = styled.div`
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
`;

const ImportFileField = styled(HiddenFileInput)``;

const UndoButton = styled(ControlButton)`
	padding: 6px 10px;
	font-size: 0.8rem;
	min-width: 32px;
`;

type ThreadToolbarProps = {
	fileInputRef: MutableRefObject<HTMLInputElement | null>;
	workspaces: Workspace[];
	activeWorkspace: Workspace;
	canUndo: boolean;
	canRedo: boolean;
	onImportState: (event: ChangeEvent<HTMLInputElement>) => void;
	onOpenImportPicker: () => void;
	onSwitchWorkspace: (workspaceId: string) => void;
	onCreateWorkspace: () => void;
	onDuplicateWorkspace: () => void;
	onRenameWorkspace: (name: string) => void;
	onDeleteWorkspace: (workspaceId: string) => void;
	onUndo: () => void;
	onRedo: () => void;
};

export function ThreadToolbar({
	fileInputRef,
	workspaces,
	activeWorkspace,
	canUndo,
	canRedo,
	onImportState,
	onOpenImportPicker,
	onSwitchWorkspace,
	onCreateWorkspace,
	onDuplicateWorkspace,
	onRenameWorkspace,
	onDeleteWorkspace,
	onUndo,
	onRedo,
}: ThreadToolbarProps) {
	return (
		<Toolbar>
			<ToolbarIntro>
				<ToolbarTitle>Thread Call Path Visualizer</ToolbarTitle>
				<ToolbarDescription>
					Write one step per line. Matching <InlineCode>[sync ID]</InlineCode>,{" "}
					<InlineCode>[wait ID]</InlineCode>, and <InlineCode>[set ID]</InlineCode>{" "}
					markers align vertically across threads.
				</ToolbarDescription>
			</ToolbarIntro>

			<ToolbarActions>
				<ImportFileField
					ref={fileInputRef}
					type="file"
					accept="application/json"
					onChange={onImportState}
				/>

				<WorkspaceSwitcher
					workspaces={workspaces}
					activeWorkspace={activeWorkspace}
					onSwitch={onSwitchWorkspace}
					onCreate={onCreateWorkspace}
					onDuplicate={onDuplicateWorkspace}
					onRename={onRenameWorkspace}
					onDelete={onDeleteWorkspace}
				/>

				<UndoButton
					type="button"
					onClick={onUndo}
					disabled={!canUndo}
					title="Undo (Ctrl+Z)"
				>
					↩
				</UndoButton>

				<UndoButton
					type="button"
					onClick={onRedo}
					disabled={!canRedo}
					title="Redo (Ctrl+Y)"
				>
					↪
				</UndoButton>

				<ControlButton type="button" onClick={onOpenImportPicker}>
					Import
				</ControlButton>
			</ToolbarActions>
		</Toolbar>
	);
}
