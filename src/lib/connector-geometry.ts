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
	end: Point,
	options?: { lateralSign?: 1 | -1 }
): Omit<ConnectorPath, "id" | "key"> {
	const deltaX = end.x - start.x;
	const deltaY = end.y - start.y;

	if (Math.abs(deltaX) < 12) {
		// Same-thread / same-side connector. Build a path that exits the
		// start block perpendicular to the editor edge, loops outward, and
		// arrives at the end block perpendicular to the editor edge as well.
		// Path = stub-out → cubic lobe → stub-in (then arrowhead). Control
		// points share the y of their adjacent endpoint, so the cubic's
		// tangent at each end is purely horizontal — joining the straight
		// stubs without a visible kink.
		const lateralSign = options?.lateralSign ?? 1;
		const stubLength = Math.max(9, Math.min(18, Math.abs(deltaY) * 0.09 + 7));
		const lobeWidth = Math.max(20, Math.min(30, Math.abs(deltaY) * 0.11 + 15));

		const startStubEnd = { x: start.x + lateralSign * stubLength, y: start.y };
		const endStubStart = { x: end.x + lateralSign * stubLength, y: end.y };

		// Arrowhead points back toward the editor edge along the stub.
		const arrowAngle = Math.atan2(0, -lateralSign);
		const arrow = buildArrowHead(end, arrowAngle);
		// The shaft must end where the arrow begins; replace the inner stub
		// endpoint accordingly so the path lines up with the arrow.
		const stubInTarget = arrow.shaftEnd;

		const control1 = {
			x: startStubEnd.x + lateralSign * lobeWidth,
			y: startStubEnd.y,
		};
		const control2 = {
			x: endStubStart.x + lateralSign * lobeWidth,
			y: endStubStart.y,
		};

		return {
			path:
				`M ${start.x} ${start.y}` +
				` L ${startStubEnd.x} ${startStubEnd.y}` +
				` C ${control1.x} ${control1.y}, ${control2.x} ${control2.y},` +
				` ${endStubStart.x} ${endStubStart.y}` +
				` L ${stubInTarget.x} ${stubInTarget.y}`,
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
