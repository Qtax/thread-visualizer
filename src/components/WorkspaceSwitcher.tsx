import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { styled } from "@linaria/react";

import type { Workspace } from "../lib/thread-visualizer-types";
import { palette } from "../styles/ui";

// --- Styled components ---

const SwitcherRoot = styled.div`
	position: relative;
	display: inline-flex;
	align-items: center;
`;

const ActiveButton = styled.button`
	appearance: none;
	display: inline-flex;
	align-items: center;
	gap: 4px;
	border: 1px solid ${palette.border};
	background: ${palette.surface};
	color: ${palette.text};
	padding: 3px 8px;
	font-size: 0.75rem;
	font-weight: 600;
	line-height: 1.4;
	cursor: pointer;
	min-width: 260px;
	max-width: 520px;

	&:hover {
		background: ${palette.surfaceHover};
	}

	&:focus-visible {
		outline: 2px solid ${palette.focusRing};
		outline-offset: -1px;
	}
`;

const ActiveName = styled.span`
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

const Chevron = styled.span`
	flex-shrink: 0;
	font-size: 0.55rem;
	margin-left: auto;
	opacity: 0.5;
`;

const Dropdown = styled.div`
	position: absolute;
	top: calc(100% + 2px);
	left: 0;
	z-index: 100;
	min-width: 320px;
	max-width: 520px;
	max-height: 400px;
	overflow-y: auto;
	border: 1px solid ${palette.border};
	background: ${palette.surface};
	box-shadow: ${palette.shadow};
	padding: 4px;
`;

const WorkspaceItem = styled.div`
	display: flex;
	align-items: center;
	gap: 6px;
	width: 100%;
	background: transparent;
	color: ${palette.text};
	padding: 5px 8px;
	font-size: 0.75rem;
	text-align: left;
	cursor: pointer;

	&:hover {
		background: ${palette.surfaceHover};
	}

	&:focus-visible {
		outline: 2px solid ${palette.focusRing};
		outline-offset: -1px;
	}

	&[data-active="true"] {
		background: ${palette.surfaceHover};
		font-weight: 600;
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
	margin-top: 1px;
	font-size: 0.65rem;
	color: ${palette.mutedText};
`;

const ItemActions = styled.div`
	display: flex;
	gap: 1px;
	flex-shrink: 0;
`;

const ItemAction = styled.button`
	appearance: none;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 20px;
	min-height: 20px;
	border: 0;
	background: transparent;
	color: ${palette.mutedText};
	padding: 0 3px;
	font-size: 0.7rem;
	cursor: pointer;

	&:hover {
		background: ${palette.surfaceHover};
		color: ${palette.text};
	}

	&:focus-visible {
		outline: 2px solid ${palette.focusRing};
		outline-offset: -1px;
	}

	&:disabled {
		opacity: 0.35;
		cursor: default;
	}
`;

const DropdownDivider = styled.div`
	height: 1px;
	margin: 3px 4px;
	background: ${palette.border};
`;

const DropdownAction = styled.button`
	appearance: none;
	display: flex;
	align-items: center;
	gap: 4px;
	width: 100%;
	border: 0;
	background: transparent;
	color: ${palette.text};
	padding: 5px 8px;
	font-size: 0.75rem;
	text-align: left;
	cursor: pointer;

	&:hover {
		background: ${palette.surfaceHover};
	}

	&:focus-visible {
		outline: 2px solid ${palette.focusRing};
		outline-offset: -1px;
	}
`;

const UpdateDot = styled.span`
	display: inline-block;
	width: 7px;
	height: 7px;
	margin-left: auto;
	border-radius: 50%;
	background: #3a8bff;
	flex-shrink: 0;
`;

const RenameInput = styled.input`
	appearance: none;
	flex: 1;
	min-width: 0;
	border: 1px solid ${palette.border};
	background: ${palette.surface};
	color: ${palette.text};
	padding: 2px 6px;
	font-size: 0.75rem;
	font-weight: 600;

	&:focus-visible {
		outline: 2px solid ${palette.focusRing};
		outline-offset: -1px;
	}
`;

const ExportCheckbox = styled.input`
	margin: 0 4px 0 0;
	cursor: pointer;
`;

const ExportBar = styled.div`
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 4px 8px;
`;

const ExportButton = styled.button`
	appearance: none;
	border: 1px solid ${palette.border};
	background: ${palette.surface};
	color: ${palette.text};
	padding: 2px 8px;
	font-size: 0.7rem;
	cursor: pointer;
	margin-left: auto;
	white-space: nowrap;

	&:hover {
		background: ${palette.surfaceHover};
	}

	&:disabled {
		opacity: 0.4;
		cursor: default;
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
	onExport: (workspaceIds: string[]) => void;
	onImport: () => void;
	showRestoreGettingStarted: boolean;
	gettingStartedUpdateAvailable: boolean;
	onRestoreGettingStarted: () => void;
};

export function WorkspaceSwitcher({
	workspaces,
	activeWorkspace,
	onSwitch,
	onCreate,
	onDuplicate,
	onRename,
	onDelete,
	onExport,
	onImport,
	showRestoreGettingStarted,
	gettingStartedUpdateAvailable,
	onRestoreGettingStarted,
}: WorkspaceSwitcherProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [renameDraft, setRenameDraft] = useState("");
	const [exportSelection, setExportSelection] = useState<Set<string>>(new Set());
	const [isExportMode, setIsExportMode] = useState(false);
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
				setIsExportMode(false);
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
		if (isExportMode) {
			setExportSelection((prev) => {
				const next = new Set(prev);
				if (next.has(workspaceId)) {
					next.delete(workspaceId);
				} else {
					next.add(workspaceId);
				}
				return next;
			});
			return;
		}
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

	const toggleExportMode = () => {
		setIsExportMode((prev) => {
			if (!prev) {
				setExportSelection(new Set([activeWorkspace.id]));
			}
			return !prev;
		});
	};

	const handleExport = () => {
		if (exportSelection.size > 0) {
			onExport([...exportSelection]);
		}
		setIsExportMode(false);
		setExportSelection(new Set());
		setIsOpen(false);
	};

	const sortedWorkspaces = [...workspaces].sort((a, b) =>
		a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
	);

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
								data-active={isActive}
								onClick={() => {
									if (!isRenaming) {
										handleSelect(workspace.id);
									}
								}}
							>
								{isExportMode && (
									<ExportCheckbox
										type="checkbox"
										checked={exportSelection.has(workspace.id)}
										onChange={() => handleSelect(workspace.id)}
										onClick={(e) => e.stopPropagation()}
									/>
								)}
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
									{isActive && !isRenaming && !isExportMode && (
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
									{!isExportMode && (
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
									)}
								</ItemActions>
							</WorkspaceItem>
						);
					})}

					<DropdownDivider />

					{isExportMode ? (
						<ExportBar>
							<DropdownAction type="button" onClick={toggleExportMode}>
								Cancel
							</DropdownAction>
							<ExportButton
								type="button"
								disabled={exportSelection.size === 0}
								onClick={handleExport}
							>
								Export {exportSelection.size > 0 ? `(${exportSelection.size})` : ""}
							</ExportButton>
						</ExportBar>
					) : (
						<>
							<DropdownAction type="button" onClick={handleCreate}>
								+ New workspace
							</DropdownAction>

							<DropdownAction type="button" onClick={handleDuplicate}>
								⧉ Duplicate current
							</DropdownAction>

							{showRestoreGettingStarted && (
								<DropdownAction
									type="button"
									onClick={() => {
										onRestoreGettingStarted();
										setIsOpen(false);
									}}
									title={
										gettingStartedUpdateAvailable
											? "A newer Getting started is available"
											: undefined
									}
								>
									↻ Restore Getting started
									{gettingStartedUpdateAvailable && <UpdateDot />}
								</DropdownAction>
							)}

							<DropdownDivider />

							<DropdownAction type="button" onClick={toggleExportMode}>
								↓ Export…
							</DropdownAction>

							<DropdownAction
								type="button"
								onClick={() => {
									onImport();
									setIsOpen(false);
								}}
							>
								↑ Import…
							</DropdownAction>
						</>
					)}
				</Dropdown>
			)}
		</SwitcherRoot>
	);
}
