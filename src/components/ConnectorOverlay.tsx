import { styled } from "@linaria/react";

import type { ConnectorOverlay as ConnectorOverlayData } from "../lib/thread-visualizer-types";

export const HORIZONTAL_LINE_STROKE_WIDTH = 2;

const CONNECTOR_COLOR = "rgb(82, 82, 91)";
const CONNECTOR_STYLES = {
	dependency: {
		opacity: 0.14,
		strokeWidth: 6,
	},
	sync: {
		opacity: 0.14,
		strokeWidth: 4,
	},
} as const;

const OverlayCanvas = styled.svg`
	pointer-events: none;
	position: absolute;
	left: 0;
	top: 0;
	z-index: 10;
	overflow: visible;
`;

type ConnectorOverlayProps = {
	overlay: ConnectorOverlayData;
};

export function ConnectorOverlay({ overlay }: ConnectorOverlayProps) {
	return (
		<OverlayCanvas
			aria-hidden="true"
			width="100%"
			height={Math.max(overlay.height, 1)}
			viewBox={`0 0 ${Math.max(overlay.width, 1)} ${Math.max(overlay.height, 1)}`}
		>
			{overlay.horizontalRules.map((horizontalRule) => (
				<line
					key={horizontalRule.key}
					x1={0}
					y1={horizontalRule.y}
					x2={overlay.width}
					y2={horizontalRule.y}
					stroke={CONNECTOR_COLOR}
					strokeWidth={HORIZONTAL_LINE_STROKE_WIDTH}
					strokeLinecap="butt"
					opacity={0.5}
				/>
			))}
			{overlay.connectors.map((connector) => {
				const { opacity, strokeWidth } = CONNECTOR_STYLES[connector.variant];

				return (
					<g key={connector.key} opacity={opacity}>
						<path
							d={connector.path}
							fill="none"
							stroke={CONNECTOR_COLOR}
							strokeWidth={strokeWidth}
							strokeLinecap="butt"
							strokeLinejoin="round"
						/>
						{connector.arrowPath ? (
							<path d={connector.arrowPath} fill={CONNECTOR_COLOR} stroke="none" />
						) : null}
					</g>
				);
			})}
		</OverlayCanvas>
	);
}
