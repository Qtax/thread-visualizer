import { styled } from "@linaria/react";

import type { SavedState } from "../lib/thread-visualizer-types";
import {
	ControlButton,
	ControlGroup,
	DetailText,
	PanelHeading,
	SurfacePanel,
	palette,
} from "../styles/ui";

const SavedStatesSection = styled(SurfacePanel)``;

const SavedStatesList = styled.div`
	display: grid;
	gap: 8px;
`;

const SavedStateCard = styled.article`
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	border: 1px solid ${palette.border};
	border-radius: 16px;
	background: ${palette.surfaceSoft};
	padding: 10px;
`;

const SavedStateSummary = styled.div`
	min-width: 0;
	flex: 1;
`;

const SavedStateName = styled.div`
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 0.875rem;
	font-weight: 600;
`;

const SavedStateMeta = styled(DetailText)`
	margin-top: 4px;
`;

const SavedStateActions = styled(ControlGroup)`
	justify-content: flex-end;
`;

const EmptySavedStates = styled(DetailText)``;

type SavedStatesPanelProps = {
	savedStates: SavedState[];
	onLoad: (saveId: string) => void;
	onUpdate: (saveId: string) => void;
	onDelete: (saveId: string) => void;
};

export function SavedStatesPanel({
	savedStates,
	onLoad,
	onUpdate,
	onDelete,
}: SavedStatesPanelProps) {
	return (
		<SavedStatesSection>
			<PanelHeading>Saved states</PanelHeading>

			{savedStates.length === 0 ? (
				<EmptySavedStates>No saved states yet.</EmptySavedStates>
			) : (
				<SavedStatesList>
					{savedStates.map((savedState) => (
						<SavedStateCard key={savedState.id}>
							<SavedStateSummary>
								<SavedStateName>{savedState.name}</SavedStateName>
								<SavedStateMeta>
									Saved {savedState.createdAt} · Updated {savedState.updatedAt}
								</SavedStateMeta>
							</SavedStateSummary>

							<SavedStateActions>
								<ControlButton type="button" onClick={() => onLoad(savedState.id)}>
									Load
								</ControlButton>

								<ControlButton
									type="button"
									onClick={() => onUpdate(savedState.id)}
								>
									Update
								</ControlButton>

								<ControlButton
									type="button"
									onClick={() => onDelete(savedState.id)}
								>
									Remove
								</ControlButton>
							</SavedStateActions>
						</SavedStateCard>
					))}
				</SavedStatesList>
			)}
		</SavedStatesSection>
	);
}
