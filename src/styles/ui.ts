import { css } from "@linaria/core";
import { styled } from "@linaria/react";

export const palette = {
	pageBackground: "#f0f0f0",
	surface: "#ffffff",
	surfaceHover: "#f5f5f5",
	border: "#e0e0e0",
	borderStrong: "#c0c0c0",
	text: "#1e1e1e",
	mutedText: "#888",
	focusRing: "rgba(0, 120, 212, 0.35)",
	shadow: "0 4px 16px rgba(0,0,0,0.12)",
} as const;

const typography = {
	ui: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
	mono: '"Cascadia Mono", "Cascadia Code", Consolas, monospace',
} as const;

export const globalStyles = css`
	:global(:root) {
		box-sizing: border-box;
		color-scheme: light;
	}

	:global(*),
	:global(*::before),
	:global(*::after) {
		box-sizing: inherit;
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
	background: ${palette.pageBackground};
	color: ${palette.text};
	font-family: ${typography.ui};
`;

export const WorkspaceFrame = styled.div`
	padding: 8px;
`;

export const SurfacePanel = styled.section`
	margin-bottom: 8px;
	border: 1px solid ${palette.border};
	background: ${palette.surface};
	padding: 8px;
`;

export const PanelHeading = styled.div`
	margin-bottom: 6px;
	font-size: 0.8rem;
	font-weight: 600;
`;

export const DetailText = styled.div`
	font-size: 0.7rem;
	color: ${palette.mutedText};
`;

export const ControlGroup = styled.div`
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 4px;
`;

export const ControlButton = styled.button`
	appearance: none;
	border: 1px solid ${palette.border};
	background: ${palette.surface};
	color: ${palette.text};
	padding: 3px 8px;
	font-size: 0.75rem;
	line-height: 1.4;
	cursor: pointer;

	&:hover:not(:disabled) {
		background: ${palette.surfaceHover};
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

export const FieldInput = styled.input`
	appearance: none;
	min-width: 0;
	border: 1px solid ${palette.border};
	background: ${palette.surface};
	color: ${palette.text};
	padding: 3px 6px;
	font-size: 0.75rem;
	line-height: 1.4;

	&::placeholder {
		color: ${palette.mutedText};
	}

	&:focus-visible {
		outline: 2px solid ${palette.focusRing};
		outline-offset: -1px;
	}
`;

export const HiddenFileInput = styled.input`
	display: none;
`;

export const InlineCode = styled.code`
	background: ${palette.surfaceHover};
	padding: 0 3px;
	font-size: 0.88em;
`;
