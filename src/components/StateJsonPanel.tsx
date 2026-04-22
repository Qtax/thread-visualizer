import { styled } from "@linaria/react";

import {
	ControlButton,
	ControlGroup,
	EditorTextArea,
	PanelHeading,
	SurfacePanel,
} from "../styles/ui";

const StatePanel = styled(SurfacePanel)``;

const StatePanelHeader = styled.div`
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	margin-bottom: 8px;
`;

const StatePanelActions = styled(ControlGroup)``;

const StateEditor = styled(EditorTextArea)``;

type StateJsonPanelProps = {
	copyStateLabel: string;
	stateText: string;
	onCopy: () => void;
	onApply: () => void;
	onChange: (nextValue: string) => void;
};

export function StateJsonPanel({
	copyStateLabel,
	stateText,
	onCopy,
	onApply,
	onChange,
}: StateJsonPanelProps) {
	return (
		<StatePanel>
			<StatePanelHeader>
				<PanelHeading>State JSON</PanelHeading>

				<StatePanelActions>
					<ControlButton type="button" onClick={onCopy}>
						{copyStateLabel}
					</ControlButton>

					<ControlButton type="button" onClick={onApply}>
						Apply
					</ControlButton>
				</StatePanelActions>
			</StatePanelHeader>

			<StateEditor
				value={stateText}
				onChange={(event) => onChange(event.target.value)}
				spellCheck={false}
			/>
		</StatePanel>
	);
}
