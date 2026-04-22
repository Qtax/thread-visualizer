import type { ConnectorOverlay, ConnectorPath, Point } from "./thread-visualizer-types";

export const EMPTY_CONNECTOR_OVERLAY: ConnectorOverlay = {
	width: 0,
	height: 0,
	connectors: [],
};

function buildArrowHead(point: Point, angle: number): { arrowPath: string; shaftEnd: Point } {
	const length = 12;
	const halfWidth = 7;
	const directionX = Math.cos(angle);
	const directionY = Math.sin(angle);
	const shaftEnd = {
		x: point.x - directionX * length,
		y: point.y - directionY * length,
	};
	const normalX = -directionY;
	const normalY = directionX;
	const left = {
		x: shaftEnd.x + normalX * halfWidth,
		y: shaftEnd.y + normalY * halfWidth,
	};
	const right = {
		x: shaftEnd.x - normalX * halfWidth,
		y: shaftEnd.y - normalY * halfWidth,
	};

	return {
		arrowPath: `M ${left.x} ${left.y} L ${point.x} ${point.y} L ${right.x} ${right.y} Z`,
		shaftEnd,
	};
}

export function buildConnectorGeometry(
	start: Point,
	end: Point
): Omit<ConnectorPath, "id" | "key"> {
	const deltaX = end.x - start.x;
	const deltaY = end.y - start.y;

	if (Math.abs(deltaX) < 12) {
		const lateralOffset = 28;
		const verticalBend = Math.max(18, Math.min(72, Math.abs(deltaY) * 0.35));
		const arrow = buildArrowHead(end, Math.atan2(deltaY, deltaX || 1));
		const control1 = {
			x: start.x + lateralOffset,
			y: start.y + (deltaY >= 0 ? verticalBend : -verticalBend),
		};
		const control2 = {
			x: arrow.shaftEnd.x + lateralOffset,
			y: arrow.shaftEnd.y - (deltaY >= 0 ? verticalBend : -verticalBend),
		};

		return {
			path: `M ${start.x} ${start.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${arrow.shaftEnd.x} ${arrow.shaftEnd.y}`,
			arrowPath: arrow.arrowPath,
		};
	}

	const direction = Math.sign(deltaX) || 1;
	const bend = Math.max(24, Math.min(96, Math.abs(deltaX) * 0.35 + Math.abs(deltaY) * 0.12));
	const control1 = { x: start.x + direction * bend, y: start.y };
	const rawControl2 = { x: end.x - direction * bend, y: end.y };
	const arrow = buildArrowHead(end, Math.atan2(end.y - rawControl2.y, end.x - rawControl2.x));
	const control2 = { x: arrow.shaftEnd.x - direction * bend, y: arrow.shaftEnd.y };

	return {
		path: `M ${start.x} ${start.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${arrow.shaftEnd.x} ${arrow.shaftEnd.y}`,
		arrowPath: arrow.arrowPath,
	};
}

export function connectorOverlayEquals(left: ConnectorOverlay, right: ConnectorOverlay): boolean {
	if (
		left.width !== right.width ||
		left.height !== right.height ||
		left.connectors.length !== right.connectors.length
	) {
		return false;
	}

	return left.connectors.every((connector, index) => {
		const next = right.connectors[index];
		return (
			connector.id === next.id &&
			connector.key === next.key &&
			connector.path === next.path &&
			connector.arrowPath === next.arrowPath
		);
	});
}
