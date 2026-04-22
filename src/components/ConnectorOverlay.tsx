import { styled } from "@linaria/react";

import type { ConnectorOverlay as ConnectorOverlayData } from "../lib/thread-visualizer-types";

const CONNECTOR_COLOR = "rgba(82, 82, 91, 0.14)";

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
			{overlay.connectors.map((connector) => (
				<g key={connector.key}>
					<path
						d={connector.path}
						fill="none"
						stroke={CONNECTOR_COLOR}
						strokeWidth="6"
						strokeLinecap="butt"
						strokeLinejoin="round"
					/>
					<path d={connector.arrowPath} fill={CONNECTOR_COLOR} stroke="none" />
				</g>
			))}
		</OverlayCanvas>
	);
}
