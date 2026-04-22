import type { ChangeEvent, RefObject } from "react";

import { styled } from "@linaria/react";

import { ControlButton, FieldInput, HiddenFileInput, InlineCode, palette } from "../styles/ui";

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

const SaveNameField = styled(FieldInput)`
	width: 10rem;
`;

type ThreadToolbarProps = {
	fileInputRef: RefObject<HTMLInputElement | null>;
	saveName: string;
	saveActionLabel: string;
	isStatePanelOpen: boolean;
	onImportState: (event: ChangeEvent<HTMLInputElement>) => void;
	onSaveNameChange: (nextValue: string) => void;
	onSaveCurrentState: () => void;
	onToggleState: () => void;
	onOpenImportPicker: () => void;
	onAddThread: () => void;
};

export function ThreadToolbar({
	fileInputRef,
	saveName,
	saveActionLabel,
	isStatePanelOpen,
	onImportState,
	onSaveNameChange,
	onSaveCurrentState,
	onToggleState,
	onOpenImportPicker,
	onAddThread,
}: ThreadToolbarProps) {
	return (
		<Toolbar>
			<ToolbarIntro>
				<ToolbarTitle>Thread Call Path Visualizer</ToolbarTitle>
				<ToolbarDescription>
					Write one step per line. Matching <InlineCode>[sync ID]</InlineCode>,{" "}
					<InlineCode>[wait ID]</InlineCode>, and <InlineCode>[set ID]</InlineCode>
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

				<SaveNameField
					value={saveName}
					onChange={(event) => onSaveNameChange(event.target.value)}
					placeholder="Save name"
				/>

				<ControlButton type="button" onClick={onSaveCurrentState}>
					{saveActionLabel}
				</ControlButton>

				<ControlButton type="button" onClick={onToggleState}>
					{isStatePanelOpen ? "Hide state" : "Show state"}
				</ControlButton>

				<ControlButton type="button" onClick={onOpenImportPicker}>
					Import
				</ControlButton>

				<ControlButton type="button" onClick={onAddThread}>
					Add thread
				</ControlButton>
			</ToolbarActions>
		</Toolbar>
	);
}
