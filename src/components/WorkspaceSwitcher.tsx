import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { styled } from "@linaria/react";

import type { Workspace } from "../lib/thread-visualizer-types";
import { palette } from "../styles/ui";

// --- Styled components ---

const SwitcherRoot = styled.div`
	position: relative;
	display: inline-flex;
	align-items: center;
	gap: 6px;
`;

const ActiveButton = styled.button`
	appearance: none;
	display: inline-flex;
	align-items: center;
	gap: 6px;
	border: 1px solid ${palette.borderStrong};
	border-radius: 12px;
	background: ${palette.actionSurface};
	color: ${palette.text};
	padding: 6px 12px;
	font-size: 0.85rem;
	font-weight: 600;
	line-height: 1.3;
	cursor: pointer;
	max-width: 24rem;
	transition:
		background-color 120ms ease,
		border-color 120ms ease;

	&:hover {
		background: ${palette.actionSurfaceHover};
	}

	&:focus-visible {
		outline: none;
		border-color: #7f6440;
		box-shadow: 0 0 0 3px ${palette.focusRing};
	}
`;

const ActiveName = styled.span`
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

const Chevron = styled.span`
	flex-shrink: 0;
	font-size: 0.6rem;
	opacity: 0.6;
	transition: transform 120ms ease;

	&[data-open="true"] {
		transform: rotate(180deg);
	}
`;

const Dropdown = styled.div`
	position: absolute;
	top: calc(100% + 4px);
	left: 0;
	z-index: 100;
	min-width: 280px;
	max-width: 420px;
	max-height: 420px;
	overflow-y: auto;
	border: 1px solid ${palette.border};
	border-radius: 14px;
	background: ${palette.surface};
	box-shadow: ${palette.shadow};
	padding: 6px;
`;

const WorkspaceItem = styled.button`
	appearance: none;
	display: flex;
	align-items: center;
	gap: 8px;
	width: 100%;
	border: 0;
	border-radius: 10px;
	background: transparent;
	color: ${palette.text};
	padding: 8px 10px;
	font-size: 0.82rem;
	font-weight: 500;
	line-height: 1.3;
	text-align: left;
	cursor: pointer;
	transition: background-color 80ms ease;

	&:hover {
		background: ${palette.pageBackgroundAccent};
	}

	&:focus-visible {
		outline: none;
		background: ${palette.pageBackgroundAccent};
		box-shadow: inset 0 0 0 2px ${palette.focusRing};
	}

	&[data-active="true"] {
		background: color-mix(in srgb, ${palette.actionSurfaceHover} 60%, white);
		font-weight: 700;
	}
`;

const ItemContent = styled.div`
	flex: 1;
	min-width: 0;
`;

const ItemName = styled.div`
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

const ItemMeta = styled.div`
	margin-top: 2px;
	font-size: 0.7rem;
	font-weight: 400;
	color: ${palette.mutedText};
`;

const ItemActions = styled.div`
	display: flex;
	gap: 2px;
	flex-shrink: 0;
`;

const ItemAction = styled.button`
	appearance: none;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 24px;
	min-height: 24px;
	border: 0;
	border-radius: 6px;
	background: transparent;
	color: ${palette.mutedText};
	padding: 0 4px;
	font-size: 0.75rem;
	cursor: pointer;
	transition:
		background-color 80ms ease,
		color 80ms ease;

	&:hover {
		background: ${palette.actionSurfaceHover};
		color: ${palette.text};
	}

	&:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px ${palette.focusRing};
	}

	&:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
`;

const DropdownDivider = styled.div`
	height: 1px;
	margin: 4px 6px;
	background: ${palette.border};
`;

const DropdownAction = styled.button`
	appearance: none;
	display: flex;
	align-items: center;
	gap: 6px;
	width: 100%;
	border: 0;
	border-radius: 10px;
	background: transparent;
	color: ${palette.text};
	padding: 8px 10px;
	font-size: 0.82rem;
	font-weight: 500;
	line-height: 1.3;
	text-align: left;
	cursor: pointer;
	transition: background-color 80ms ease;

	&:hover {
		background: ${palette.pageBackgroundAccent};
	}

	&:focus-visible {
		outline: none;
		background: ${palette.pageBackgroundAccent};
		box-shadow: inset 0 0 0 2px ${palette.focusRing};
	}
`;

const RenameInput = styled.input`
	appearance: none;
	box-sizing: border-box;
	flex: 1;
	min-width: 0;
	border: 0;
	border-radius: 6px;
	background: color-mix(in srgb, ${palette.surfaceSoft} 72%, white);
	color: ${palette.text};
	padding: 4px 8px;
	font-size: 0.82rem;
	font-weight: 600;
	line-height: 1.3;
	box-shadow: inset 0 0 0 1px ${palette.borderStrong};

	&:focus-visible {
		outline: none;
		box-shadow:
			inset 0 0 0 1px ${palette.borderStrong},
			0 0 0 3px ${palette.focusRing};
	}
`;

// --- Helpers ---

function formatDate(isoString: string): string {
	try {
		const date = new Date(isoString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60_000);
		const diffHours = Math.floor(diffMs / 3_600_000);
		const diffDays = Math.floor(diffMs / 86_400_000);

		if (diffMins < 1) {
			return "just now";
		}
		if (diffMins < 60) {
			return `${diffMins}m ago`;
		}
		if (diffHours < 24) {
			return `${diffHours}h ago`;
		}
		if (diffDays < 7) {
			return `${diffDays}d ago`;
		}

		return date.toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
			year: now.getFullYear() !== date.getFullYear() ? "numeric" : undefined,
		});
	} catch {
		return "";
	}
}

// --- Component ---

type WorkspaceSwitcherProps = {
	workspaces: Workspace[];
	activeWorkspace: Workspace;
	onSwitch: (workspaceId: string) => void;
	onCreate: () => void;
	onDuplicate: () => void;
	onRename: (name: string) => void;
	onDelete: (workspaceId: string) => void;
};

export function WorkspaceSwitcher({
	workspaces,
	activeWorkspace,
	onSwitch,
	onCreate,
	onDuplicate,
	onRename,
	onDelete,
}: WorkspaceSwitcherProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [renameDraft, setRenameDraft] = useState("");
	const rootRef = useRef<HTMLDivElement | null>(null);
	const renameInputRef = useRef<HTMLInputElement | null>(null);

	// Close dropdown on outside click
	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const handlePointerDown = (event: PointerEvent) => {
			if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
				setIsOpen(false);
				setRenamingId(null);
			}
		};

		document.addEventListener("pointerdown", handlePointerDown, true);
		return () => document.removeEventListener("pointerdown", handlePointerDown, true);
	}, [isOpen]);

	// Focus rename input
	useEffect(() => {
		if (renamingId) {
			renameInputRef.current?.focus();
			renameInputRef.current?.select();
		}
	}, [renamingId]);

	const startRename = (workspace: Workspace) => {
		setRenamingId(workspace.id);
		setRenameDraft(workspace.name);
	};

	const commitRename = () => {
		if (renamingId && renameDraft.trim()) {
			// If renaming the active workspace
			if (renamingId === activeWorkspace.id) {
				onRename(renameDraft.trim());
			}
			// For non-active workspaces we'd need a different handler,
			// but for now keep it simple — rename only active workspace
		}
		setRenamingId(null);
		setRenameDraft("");
	};

	const cancelRename = () => {
		setRenamingId(null);
		setRenameDraft("");
	};

	const handleRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") {
			event.preventDefault();
			commitRename();
		}
		if (event.key === "Escape") {
			event.preventDefault();
			cancelRename();
		}
	};

	const handleSelect = (workspaceId: string) => {
		onSwitch(workspaceId);
		setIsOpen(false);
		setRenamingId(null);
	};

	const handleCreate = () => {
		onCreate();
		setIsOpen(false);
	};

	const handleDuplicate = () => {
		onDuplicate();
		setIsOpen(false);
	};

	const sortedWorkspaces = [...workspaces].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

	return (
		<SwitcherRoot ref={rootRef}>
			<ActiveButton
				type="button"
				onClick={() => setIsOpen((current) => !current)}
				title="Switch workspace"
			>
				<ActiveName>{activeWorkspace.name}</ActiveName>
				<Chevron data-open={isOpen}>▼</Chevron>
			</ActiveButton>

			{isOpen && (
				<Dropdown>
					{sortedWorkspaces.map((workspace) => {
						const isActive = workspace.id === activeWorkspace.id;
						const isRenaming = renamingId === workspace.id;

						return (
							<WorkspaceItem
								key={workspace.id}
								type="button"
								data-active={isActive}
								onClick={() => {
									if (!isRenaming) {
										handleSelect(workspace.id);
									}
								}}
							>
								<ItemContent>
									{isRenaming ? (
										<RenameInput
											ref={renameInputRef}
											value={renameDraft}
											onChange={(e) => setRenameDraft(e.target.value)}
											onBlur={commitRename}
											onKeyDown={handleRenameKeyDown}
											onClick={(e) => e.stopPropagation()}
										/>
									) : (
										<ItemName>{workspace.name}</ItemName>
									)}
									<ItemMeta>
										Created {formatDate(workspace.createdAt)}
										{" · "}
										Modified {formatDate(workspace.updatedAt)}
										{" · "}
										{workspace.threads.length} thread
										{workspace.threads.length !== 1 ? "s" : ""}
									</ItemMeta>
								</ItemContent>

								<ItemActions>
									{isActive && !isRenaming && (
										<ItemAction
											type="button"
											title="Rename"
											onClick={(e) => {
												e.stopPropagation();
												startRename(workspace);
											}}
										>
											✎
										</ItemAction>
									)}
									<ItemAction
										type="button"
										title="Delete workspace"
										disabled={workspaces.length <= 1}
										onClick={(e) => {
											e.stopPropagation();
											onDelete(workspace.id);
										}}
									>
										✕
									</ItemAction>
								</ItemActions>
							</WorkspaceItem>
						);
					})}

					<DropdownDivider />

					<DropdownAction type="button" onClick={handleCreate}>
						+ New workspace
					</DropdownAction>

					<DropdownAction type="button" onClick={handleDuplicate}>
						⧉ Duplicate current
					</DropdownAction>
				</Dropdown>
			)}
		</SwitcherRoot>
	);
}
