import { css } from "@linaria/core";
import { styled } from "@linaria/react";

export const palette = {
	pageBackground: "#f3efe6",
	pageBackgroundAccent: "#fbf8f1",
	surface: "#ffffff",
	surfaceSoft: "#fcfaf5",
	border: "#d7d0c3",
	borderStrong: "#a39a8a",
	text: "#201d18",
	mutedText: "#6f685c",
	actionSurface: "#f8f3e8",
	actionSurfaceHover: "#efe6d6",
	focusRing: "rgba(182, 141, 69, 0.22)",
	shadow: "0 14px 28px rgba(42, 33, 20, 0.08)",
} as const;

const typography = {
	ui: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
	mono: '"Cascadia Mono", "Cascadia Code", Consolas, monospace',
} as const;

export const globalStyles = css`
	:global(:root) {
		color-scheme: light;
	}

	:global(html),
	:global(body),
	:global(#root) {
		min-height: 100%;
	}

	:global(body) {
		margin: 0;
		background: ${palette.pageBackground};
	}

	:global(button),
	:global(input),
	:global(textarea) {
		font: inherit;
	}

	:global(code),
	:global(textarea) {
		font-family: ${typography.mono};
	}
`;

export const AppSurface = styled.div`
	min-height: 100vh;
	background: linear-gradient(
		180deg,
		${palette.pageBackgroundAccent} 0%,
		${palette.pageBackground} 100%
	);
	color: ${palette.text};
	font-family: ${typography.ui};
`;

export const WorkspaceFrame = styled.div`
	padding: 12px;
`;

export const SurfacePanel = styled.section`
	margin-bottom: 12px;
	border: 1px solid ${palette.border};
	border-radius: 20px;
	background: ${palette.surface};
	//box-shadow: ${palette.shadow};
	padding: 10px;
`;

export const PanelHeading = styled.div`
	margin-bottom: 8px;
	font-size: 0.95rem;
	font-weight: 600;
	letter-spacing: 0.01em;
`;

export const DetailText = styled.div`
	font-size: 0.75rem;
	color: ${palette.mutedText};
`;

export const ControlGroup = styled.div`
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
`;

export const ControlButton = styled.button`
	appearance: none;
	border: 1px solid ${palette.borderStrong};
	border-radius: 12px;
	background: ${palette.actionSurface};
	color: ${palette.text};
	padding: 8px 12px;
	font-size: 0.875rem;
	font-weight: 600;
	line-height: 1.2;
	transition:
		background-color 120ms ease,
		border-color 120ms ease,
		box-shadow 120ms ease;

	&:hover:not(:disabled) {
		background: ${palette.actionSurfaceHover};
	}

	&:focus-visible {
		outline: none;
		border-color: #7f6440;
		box-shadow: 0 0 0 3px ${palette.focusRing};
	}

	&:disabled {
		cursor: not-allowed;
		opacity: 0.4;
	}
`;

export const FieldInput = styled.input`
	appearance: none;
	min-width: 0;
	border: 1px solid ${palette.borderStrong};
	border-radius: 14px;
	background: ${palette.surfaceSoft};
	color: ${palette.text};
	padding: 8px 12px;
	font-size: 0.875rem;
	line-height: 1.25;
	transition:
		border-color 120ms ease,
		box-shadow 120ms ease;

	&::placeholder {
		color: ${palette.mutedText};
	}

	&:focus-visible {
		outline: none;
		border-color: #7f6440;
		box-shadow: 0 0 0 3px ${palette.focusRing};
	}
`;

export const HiddenFileInput = styled.input`
	display: none;
`;

export const EditorTextArea = styled.textarea`
	width: 100%;
	min-height: 220px;
	resize: vertical;
	border: 1px solid ${palette.borderStrong};
	border-radius: 16px;
	background: ${palette.surfaceSoft};
	color: ${palette.text};
	padding: 10px 12px;
	font-size: 0.75rem;
	line-height: 1.5;
	transition:
		border-color 120ms ease,
		box-shadow 120ms ease;

	&:focus-visible {
		outline: none;
		border-color: #7f6440;
		box-shadow: 0 0 0 3px ${palette.focusRing};
	}
`;

export const InlineCode = styled.code`
	display: inline-block;
	border-radius: 8px;
	background: #efe7d6;
	padding: 0 4px;
	font-size: 0.92em;
	color: ${palette.text};
`;
