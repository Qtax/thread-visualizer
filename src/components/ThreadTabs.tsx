import { styled } from "@linaria/react";
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";

import type { Thread } from "../lib/thread-visualizer-types";
import { palette } from "../styles/ui";

const TabStrip = styled.div`
	position: relative;
	display: grid;
	min-width: 100%;
	align-items: end;
`;

const TabLane = styled.div`
	position: relative;
	display: flex;
	align-items: end;
	padding-right: 6px;
	border-bottom: 1px solid ${palette.border};
`;

const TabShell = styled.div`
	position: relative;
	display: flex;
	min-width: 0;
	width: fit-content;
	max-width: calc(100% - 6px);
	align-items: center;
	gap: 1px;
	border: 1px solid ${palette.border};
	border-bottom: 0;
	border-radius: 5px 5px 0 0;
	background: linear-gradient(
		180deg,
		color-mix(in srgb, ${palette.surfaceSoft} 80%, white) 0%,
		${palette.surface} 100%
	);
	padding-left: 8px;
	margin-bottom: -1px;
	overflow: hidden;
	cursor: grab;

	&[data-dragging="true"] {
		opacity: 0.52;
	}

	&:focus-within {
		background: ${palette.surface};
	}

	&:active {
		cursor: grabbing;
	}
`;

const TabLabel = styled.span`
	display: block;
	flex: 0 1 22ch;
	min-width: 0;
	max-width: 22ch;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	padding: 6px 2px 7px 0;
	font-size: 0.78rem;
	font-weight: 500;
	line-height: 1.2;
	color: ${palette.text};
`;

const TabNameField = styled.input`
	appearance: none;
	box-sizing: border-box;
	flex: 0 1 18ch;
	min-width: 0;
	width: 18ch;
	height: 28px;
	max-width: 100%;
	border: 0;
	border-radius: 4px;
	background: color-mix(in srgb, ${palette.surfaceSoft} 72%, white);
	color: ${palette.text};
	padding: 4px 6px;
	margin: 0 2px 0 0;
	font-size: 0.78rem;
	font-weight: 500;
	line-height: 1.2;
	box-shadow: inset 0 0 0 1px color-mix(in srgb, ${palette.borderStrong} 78%, white);

	&:focus-visible {
		outline: none;
		box-shadow:
			inset 0 0 0 1px ${palette.borderStrong},
			0 0 0 3px ${palette.focusRing};
	}

	&::placeholder {
		color: ${palette.mutedText};
	}
`;

const TabActionGroup = styled.div`
	display: inline-flex;
	align-items: center;
	padding-right: 3px;
	gap: 1px;
`;

const TabActionButton = styled.button`
	appearance: none;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex: 0 0 auto;
	min-width: 22px;
	min-height: 22px;
	border: 0;
	border-radius: 4px;
	background: transparent;
	color: ${palette.mutedText};
	padding: 0 6px;
	font-size: 0.8rem;
	line-height: 1;
	transition:
		background-color 120ms ease,
		color 120ms ease;

	&:hover:not(:disabled) {
		background: ${palette.pageBackgroundAccent};
		color: ${palette.text};
	}

	&:focus-visible {
		outline: none;
		background: color-mix(in srgb, ${palette.surfaceSoft} 70%, white);
		box-shadow: 0 0 0 3px ${palette.focusRing};
		color: ${palette.text};
	}

	&:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}
`;

const AddTabButton = styled(TabActionButton)`
	position: absolute;
	right: 0;
	bottom: 1px;
	z-index: 1;
	min-width: 30px;
	min-height: 30px;
	border-radius: 0;
	font-size: 1rem;
	color: ${palette.text};
`;

const DropIndicator = styled.div`
	position: absolute;
	top: 8px;
	bottom: 6px;
	width: 3px;
	border-radius: 999px;
	background: ${palette.borderStrong};
	pointer-events: none;
	z-index: 10;
`;

type ThreadTabsProps = {
	trackTemplate: string;
	threads: Thread[];
	activeDragThreadId: string | null;
	dropIndex: number | null;
	onDragStart: (threadId: string) => void;
	onDragEnd: () => void;
	onDragOver: (nextIndex: number) => void;
	onDrop: (nextIndex: number) => void;
	onNameChange: (threadId: string, nextName: string) => void;
	onRemove: (threadId: string) => void;
	onAddThread: () => void;
};

function resolveDropIndex(event: DragEvent<HTMLDivElement>, index: number) {
	const bounds = event.currentTarget.getBoundingClientRect();
	return event.clientX < bounds.left + bounds.width / 2 ? index : index + 1;
}

export function ThreadTabs({
	trackTemplate,
	threads,
	activeDragThreadId,
	dropIndex,
	onDragStart,
	onDragEnd,
	onDragOver,
	onDrop,
	onNameChange,
	onRemove,
	onAddThread,
}: ThreadTabsProps) {
	const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
	const [draftName, setDraftName] = useState("");
	const editingInputRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		if (!editingThreadId) {
			return;
		}

		editingInputRef.current?.focus();
		editingInputRef.current?.select();
	}, [editingThreadId]);

	useEffect(() => {
		if (editingThreadId && !threads.some((thread) => thread.id === editingThreadId)) {
			setEditingThreadId(null);
			setDraftName("");
		}
	}, [editingThreadId, threads]);

	const commitEditing = (thread: Thread) => {
		const nextName = draftName.trim() || thread.name;
		if (nextName !== thread.name) {
			onNameChange(thread.id, nextName);
		}

		setEditingThreadId(null);
		setDraftName("");
	};

	const cancelEditing = () => {
		setEditingThreadId(null);
		setDraftName("");
	};

	const beginEditing = (thread: Thread) => {
		setEditingThreadId(thread.id);
		setDraftName(thread.name);
	};

	const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>, thread: Thread) => {
		if (event.key === "Enter") {
			event.preventDefault();
			commitEditing(thread);
		}

		if (event.key === "Escape") {
			event.preventDefault();
			cancelEditing();
		}
	};

	return (
		<TabStrip style={{ gridTemplateColumns: trackTemplate }}>
			{threads.map((thread, index) => {
				const isEditing = editingThreadId === thread.id;
				const showLeftIndicator = dropIndex === index;
				const showRightIndicator =
					index === threads.length - 1 && dropIndex === threads.length;
				const isLastThread = index === threads.length - 1;

				return (
					<TabLane
						key={thread.id}
						style={isLastThread ? { paddingRight: 36 } : undefined}
						draggable={!isEditing}
						onDragStart={(event) => {
							event.dataTransfer.effectAllowed = "move";
							event.dataTransfer.setData("text/plain", thread.id);
							onDragStart(thread.id);
						}}
						onDragEnd={onDragEnd}
						onDragOver={(event) => {
							event.preventDefault();
							event.dataTransfer.dropEffect = "move";
							onDragOver(resolveDropIndex(event, index));
						}}
						onDrop={(event) => {
							event.preventDefault();
							onDrop(resolveDropIndex(event, index));
						}}
					>
						{showLeftIndicator && <DropIndicator style={{ left: 0 }} />}
						{showRightIndicator && <DropIndicator style={{ right: 0 }} />}

						<TabShell data-dragging={activeDragThreadId === thread.id}>
							{isEditing ? (
								<TabNameField
									ref={editingInputRef}
									value={draftName}
									onChange={(event) => setDraftName(event.target.value)}
									onBlur={() => commitEditing(thread)}
									onKeyDown={(event) => handleNameKeyDown(event, thread)}
									placeholder="Thread name"
									draggable={false}
								/>
							) : (
								<TabLabel title={thread.name}>{thread.name}</TabLabel>
							)}

							<TabActionGroup>
								{!isEditing && (
									<TabActionButton
										type="button"
										onClick={() => beginEditing(thread)}
										title="Rename thread"
									>
										✎
									</TabActionButton>
								)}

								<TabActionButton
									type="button"
									onClick={() => onRemove(thread.id)}
									disabled={threads.length === 1}
									title={
										threads.length === 1
											? "At least one thread is required"
											: "Remove thread"
									}
								>
									✕
								</TabActionButton>
							</TabActionGroup>
						</TabShell>
					</TabLane>
				);
			})}

			<AddTabButton type="button" onClick={onAddThread} title="Add thread">
				+
			</AddTabButton>
		</TabStrip>
	);
}
