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
	background: ${palette.surface};
	padding-left: 8px;
	margin-bottom: -1px;
	overflow: hidden;
	cursor: grab;

	&[data-dragging="true"] {
		opacity: 0.5;
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
	flex: 0 1 18ch;
	min-width: 0;
	width: 18ch;
	height: 24px;
	max-width: 100%;
	border: 1px solid ${palette.border};
	background: ${palette.surface};
	color: ${palette.text};
	padding: 2px 6px;
	margin: 0 2px 0 0;
	font-size: 0.75rem;

	&:focus-visible {
		outline: 2px solid ${palette.focusRing};
		outline-offset: -1px;
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
	min-width: 20px;
	min-height: 20px;
	border: 0;
	background: transparent;
	color: ${palette.mutedText};
	padding: 0 4px;
	font-size: 0.75rem;
	cursor: pointer;

	&:hover:not(:disabled) {
		background: ${palette.surfaceHover};
		color: ${palette.text};
	}

	&:focus-visible {
		outline: 2px solid ${palette.focusRing};
		outline-offset: -1px;
	}

	&:disabled {
		opacity: 0.4;
		cursor: default;
	}
`;

const DropIndicator = styled.div`
	position: absolute;
	top: 8px;
	bottom: 6px;
	width: 2px;
	background: ${palette.text};
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

				return (
					<TabLane
						key={thread.id}
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
		</TabStrip>
	);
}
