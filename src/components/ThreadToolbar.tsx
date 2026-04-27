import type { ChangeEvent, MutableRefObject } from "react";
import { useState } from "react";

import { styled } from "@linaria/react";

import type { Workspace } from "../lib/thread-visualizer-types";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { ControlButton, HiddenFileInput, InlineCode, palette } from "../styles/ui";

const Toolbar = styled.header`
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
	padding: 4px 0;
	margin-bottom: 4px;
	border-bottom: 1px solid ${palette.border};
`;

const ToolbarIntro = styled.div`
	margin-left: auto;
	text-align: right;
`;

const ToolbarTitle = styled.h1`
	margin: 0;
	font-size: 0.8rem;
	font-weight: 600;
	color: ${palette.mutedText};

	a {
		color: inherit;
		text-decoration: none;

		&:hover {
			text-decoration: underline;
		}
	}
`;

const ToolbarDescription = styled.p`
	margin: 1px 0 0;
	font-size: 0.68rem;
	color: ${palette.mutedText};
`;

const ToolbarActions = styled.div`
	display: flex;
	align-items: center;
	gap: 2px;
`;

const ImportFileField = styled(HiddenFileInput)``;

const Separator = styled.div`
	width: 1px;
	height: 16px;
	background: ${palette.border};
	margin: 0 4px;
`;

type ThreadToolbarProps = {
	fileInputRef: MutableRefObject<HTMLInputElement | null>;
	workspaces: Workspace[];
	activeWorkspace: Workspace;
	canUndo: boolean;
	canRedo: boolean;
	onImportState: (event: ChangeEvent<HTMLInputElement>) => void;
	onOpenImportPicker: () => void;
	onExportWorkspaces: (workspaceIds: string[]) => void;
	onSwitchWorkspace: (workspaceId: string) => void;
	onCreateWorkspace: () => void;
	onDuplicateWorkspace: () => void;
	onRenameWorkspace: (name: string) => void;
	onDeleteWorkspace: (workspaceId: string) => void;
	showRestoreGettingStarted: boolean;
	gettingStartedUpdateAvailable: boolean;
	onRestoreGettingStarted: () => void;
	onAddThread: () => void;
	onUndo: () => void;
	onRedo: () => void;
	onShare: () => Promise<string | null>;
};

export function ThreadToolbar({
	fileInputRef,
	workspaces,
	activeWorkspace,
	canUndo,
	canRedo,
	onImportState,
	onOpenImportPicker,
	onExportWorkspaces,
	onSwitchWorkspace,
	onCreateWorkspace,
	onDuplicateWorkspace,
	onRenameWorkspace,
	onDeleteWorkspace,
	showRestoreGettingStarted,
	gettingStartedUpdateAvailable,
	onRestoreGettingStarted,
	onAddThread,
	onUndo,
	onRedo,
	onShare,
}: ThreadToolbarProps) {
	const [shareLabel, setShareLabel] = useState("Share");

	const handleShare = async () => {
		const url = await onShare();
		if (url) {
			setShareLabel("Copied!");
			window.setTimeout(() => setShareLabel("Share"), 1500);
		}
	};

	return (
		<Toolbar>
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
					onExport={onExportWorkspaces}
					onImport={onOpenImportPicker}
					showRestoreGettingStarted={showRestoreGettingStarted}
					gettingStartedUpdateAvailable={gettingStartedUpdateAvailable}
					onRestoreGettingStarted={onRestoreGettingStarted}
				/>

				<Separator />

				<ControlButton type="button" onClick={onAddThread} title="Add thread">
					+ Thread
				</ControlButton>

				<Separator />

				<ControlButton
					type="button"
					onClick={onUndo}
					disabled={!canUndo}
					title="Undo (Ctrl+Z)"
				>
					↩
				</ControlButton>

				<ControlButton
					type="button"
					onClick={onRedo}
					disabled={!canRedo}
					title="Redo (Ctrl+Y)"
				>
					↪
				</ControlButton>

				<Separator />

				<ControlButton
					type="button"
					onClick={handleShare}
					title="Copy shareable link to current workspace"
				>
					🔗 {shareLabel}
				</ControlButton>
			</ToolbarActions>

			<ToolbarIntro>
				<ToolbarTitle>
					<a href="https://github.com/Qtax/thread-visualizer" target="_blank">
						Thread Call Path Visualizer
					</a>
				</ToolbarTitle>
				<ToolbarDescription>
					Use <InlineCode>[sync ID]</InlineCode> <InlineCode>[wait ID]</InlineCode>{" "}
					<InlineCode>[set ID]</InlineCode> to align across threads
				</ToolbarDescription>
			</ToolbarIntro>
		</Toolbar>
	);
}
