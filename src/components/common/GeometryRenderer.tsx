import React from 'react';

/**
 * GeometryRenderer - Renders basic geometric shapes using SVG
 * Supports: triangle, rectangle, square, circle, line, angle
 */

// Types for geometry data from AI
export interface GeometryPoint {
    x: number;
    y: number;
    label?: string;
}

export interface GeometryLine {
    from: GeometryPoint;
    to: GeometryPoint;
    label?: string;
    style?: 'solid' | 'dashed' | 'dotted';
}

export interface GeometryCircle {
    center: GeometryPoint;
    radius: number;
    label?: string; // Label for center
    radiusLabel?: string;
}

export interface GeometryAngle {
    vertex: GeometryPoint;
    point1: GeometryPoint;
    point2: GeometryPoint;
    label?: string; // e.g., "60°"
    isRightAngle?: boolean;
}

export interface GeometryData {
    type: 'triangle' | 'rectangle' | 'square' | 'circle' | 'line' | 'polygon' | 'custom';
    // For predefined shapes
    vertices?: GeometryPoint[];
    // For custom drawings
    lines?: GeometryLine[];
    circles?: GeometryCircle[];
    angles?: GeometryAngle[];
    // Measurements
    measurements?: { [key: string]: string }; // e.g., {"AB": "5cm", "BC": "3cm"}
    // Styling
    width?: number;
    height?: number;
    fillColor?: string;
    strokeColor?: string;
    title?: string;
}

interface GeometryRendererProps {
    data: GeometryData;
    className?: string;
}

// Convert geometry coordinates to SVG coordinates (flip Y axis)
const toSvgCoord = (point: GeometryPoint, height: number): { x: number; y: number } => {
    return { x: point.x, y: height - point.y };
};

// Calculate centroid of polygon for placing internal labels
const getCentroid = (points: GeometryPoint[]): GeometryPoint => {
    const n = points.length;
    const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / n, y: sum.y / n };
};

// Get label position offset based on vertex position relative to centroid
const getLabelOffset = (point: GeometryPoint, centroid: GeometryPoint): { dx: number; dy: number } => {
    const dx = point.x - centroid.x;
    const dy = point.y - centroid.y;
    const distance = 15;
    const angle = Math.atan2(dy, dx);
    return {
        dx: Math.cos(angle) * distance,
        dy: -Math.sin(angle) * distance // Negative because SVG Y is inverted
    };
};

const GeometryRenderer: React.FC<GeometryRendererProps> = ({ data, className = '' }) => {
    const width = data.width || 200;
    const height = data.height || 200;
    const padding = 30;
    const viewBoxWidth = width + padding * 2;
    const viewBoxHeight = height + padding * 2;

    const strokeColor = data.strokeColor || '#3b82f6'; // Blue
    const fillColor = data.fillColor || 'rgba(59, 130, 246, 0.1)';
    const labelColor = '#1f2937'; // Gray-800

    // Render vertices as points with labels
    const renderVertices = (vertices: GeometryPoint[]) => {
        const centroid = getCentroid(vertices);
        return vertices.map((v, idx) => {
            const svgPoint = toSvgCoord(v, height);
            const offset = getLabelOffset(v, centroid);
            return (
                <g key={`vertex-${idx}`}>
                    <circle
                        cx={svgPoint.x + padding}
                        cy={svgPoint.y + padding}
                        r={4}
                        fill={strokeColor}
                    />
                    {v.label && (
                        <text
                            x={svgPoint.x + padding + offset.dx}
                            y={svgPoint.y + padding + offset.dy}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize="14"
                            fontWeight="bold"
                            fill={labelColor}
                        >
                            {v.label}
                        </text>
                    )}
                </g>
            );
        });
    };

    // Render polygon (triangle, rectangle, etc.)
    const renderPolygon = (vertices: GeometryPoint[]) => {
        if (vertices.length < 3) return null;

        const points = vertices
            .map(v => {
                const svgPoint = toSvgCoord(v, height);
                return `${svgPoint.x + padding},${svgPoint.y + padding}`;
            })
            .join(' ');

        return (
            <polygon
                points={points}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={2}
            />
        );
    };

    // Render measurements on edges
    const renderMeasurements = (vertices: GeometryPoint[], measurements?: { [key: string]: string }) => {
        if (!measurements) return null;

        const elements: React.ReactElement[] = [];
        const n = vertices.length;

        for (let i = 0; i < n; i++) {
            const v1 = vertices[i];
            const v2 = vertices[(i + 1) % n];
            const edgeKey = `${v1.label || ''}${v2.label || ''}`;
            const edgeKeyReverse = `${v2.label || ''}${v1.label || ''}`;
            const measurement = measurements[edgeKey] || measurements[edgeKeyReverse];

            if (measurement) {
                const svgP1 = toSvgCoord(v1, height);
                const svgP2 = toSvgCoord(v2, height);
                const midX = (svgP1.x + svgP2.x) / 2 + padding;
                const midY = (svgP1.y + svgP2.y) / 2 + padding;

                // Offset perpendicular to the edge
                const dx = svgP2.x - svgP1.x;
                const dy = svgP2.y - svgP1.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                const offsetX = (-dy / len) * 12;
                const offsetY = (dx / len) * 12;

                elements.push(
                    <text
                        key={`measure-${i}`}
                        x={midX + offsetX}
                        y={midY + offsetY}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="12"
                        fill="#6b7280"
                        fontStyle="italic"
                    >
                        {measurement}
                    </text>
                );
            }
        }

        return elements;
    };

    // Render circle
    const renderCircle = (circle: GeometryCircle) => {
        const center = toSvgCoord(circle.center, height);
        return (
            <g key="circle">
                <circle
                    cx={center.x + padding}
                    cy={center.y + padding}
                    r={circle.radius}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={2}
                />
                {/* Center point */}
                <circle
                    cx={center.x + padding}
                    cy={center.y + padding}
                    r={3}
                    fill={strokeColor}
                />
                {/* Center label */}
                {circle.label && (
                    <text
                        x={center.x + padding - 10}
                        y={center.y + padding + 15}
                        fontSize="14"
                        fontWeight="bold"
                        fill={labelColor}
                    >
                        {circle.label}
                    </text>
                )}
                {/* Radius line */}
                {circle.radiusLabel && (
                    <>
                        <line
                            x1={center.x + padding}
                            y1={center.y + padding}
                            x2={center.x + padding + circle.radius}
                            y2={center.y + padding}
                            stroke={strokeColor}
                            strokeWidth={1.5}
                        />
                        <text
                            x={center.x + padding + circle.radius / 2}
                            y={center.y + padding - 8}
                            textAnchor="middle"
                            fontSize="12"
                            fill="#6b7280"
                            fontStyle="italic"
                        >
                            {circle.radiusLabel}
                        </text>
                    </>
                )}
            </g>
        );
    };

    // Render line segment
    const renderLine = (line: GeometryLine, idx: number) => {
        const from = toSvgCoord(line.from, height);
        const to = toSvgCoord(line.to, height);

        const dashArray = line.style === 'dashed' ? '8,4' : line.style === 'dotted' ? '2,2' : 'none';

        return (
            <g key={`line-${idx}`}>
                <line
                    x1={from.x + padding}
                    y1={from.y + padding}
                    x2={to.x + padding}
                    y2={to.y + padding}
                    stroke={strokeColor}
                    strokeWidth={2}
                    strokeDasharray={dashArray}
                />
                {/* End points */}
                <circle cx={from.x + padding} cy={from.y + padding} r={4} fill={strokeColor} />
                <circle cx={to.x + padding} cy={to.y + padding} r={4} fill={strokeColor} />
                {/* Labels */}
                {line.from.label && (
                    <text
                        x={from.x + padding - 10}
                        y={from.y + padding + 15}
                        fontSize="14"
                        fontWeight="bold"
                        fill={labelColor}
                    >
                        {line.from.label}
                    </text>
                )}
                {line.to.label && (
                    <text
                        x={to.x + padding + 10}
                        y={to.y + padding + 15}
                        fontSize="14"
                        fontWeight="bold"
                        fill={labelColor}
                    >
                        {line.to.label}
                    </text>
                )}
                {/* Measurement label */}
                {line.label && (
                    <text
                        x={(from.x + to.x) / 2 + padding}
                        y={(from.y + to.y) / 2 + padding - 10}
                        textAnchor="middle"
                        fontSize="12"
                        fill="#6b7280"
                        fontStyle="italic"
                    >
                        {line.label}
                    </text>
                )}
            </g>
        );
    };

    // Render right angle marker
    const renderRightAngle = (angle: GeometryAngle) => {
        const v = toSvgCoord(angle.vertex, height);
        const size = 12;

        // Calculate direction vectors
        const dx1 = angle.point1.x - angle.vertex.x;
        const dy1 = -(angle.point1.y - angle.vertex.y); // SVG Y inverted
        const dx2 = angle.point2.x - angle.vertex.x;
        const dy2 = -(angle.point2.y - angle.vertex.y);

        // Normalize
        const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

        const ux1 = (dx1 / len1) * size;
        const uy1 = (dy1 / len1) * size;
        const ux2 = (dx2 / len2) * size;
        const uy2 = (dy2 / len2) * size;

        const points = [
            `${v.x + padding + ux1},${v.y + padding + uy1}`,
            `${v.x + padding + ux1 + ux2},${v.y + padding + uy1 + uy2}`,
            `${v.x + padding + ux2},${v.y + padding + uy2}`
        ].join(' ');

        return (
            <polyline
                key="right-angle"
                points={points}
                fill="none"
                stroke={strokeColor}
                strokeWidth={1.5}
            />
        );
    };

    return (
        <div className={`inline-block ${className}`}>
            {data.title && (
                <p className="text-sm text-gray-600 text-center mb-1">{data.title}</p>
            )}
            <svg
                viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
                width={viewBoxWidth}
                height={viewBoxHeight}
                className="max-w-full h-auto"
            >
                {/* Background */}
                <rect
                    x={0}
                    y={0}
                    width={viewBoxWidth}
                    height={viewBoxHeight}
                    fill="white"
                    rx={8}
                />

                {/* Render based on type */}
                {data.type === 'circle' && data.circles && data.circles.map((c, i) => (
                    <React.Fragment key={`circle-${i}`}>{renderCircle(c)}</React.Fragment>
                ))}

                {(data.type === 'triangle' || data.type === 'rectangle' || data.type === 'square' || data.type === 'polygon') && data.vertices && (
                    <>
                        {renderPolygon(data.vertices)}
                        {renderVertices(data.vertices)}
                        {renderMeasurements(data.vertices, data.measurements)}
                    </>
                )}

                {data.type === 'line' && data.lines && data.lines.map((line, i) => renderLine(line, i))}

                {/* Render angles */}
                {data.angles && data.angles.map((angle, i) => (
                    <React.Fragment key={`angle-${i}`}>
                        {angle.isRightAngle && renderRightAngle(angle)}
                    </React.Fragment>
                ))}

                {/* Render additional lines */}
                {data.lines && data.type !== 'line' && data.lines.map((line, i) => renderLine(line, i))}

                {/* Single circle for circle type */}
                {data.type === 'circle' && !data.circles && data.vertices && data.vertices.length >= 1 && (
                    renderCircle({
                        center: data.vertices[0],
                        radius: 60,
                        label: data.vertices[0].label,
                        radiusLabel: data.measurements?.['r'] || data.measurements?.['radius']
                    })
                )}
            </svg>
        </div>
    );
};

export default GeometryRenderer;

// Helper function to create common shapes
export const createTriangle = (
    a: string, b: string, c: string,
    measurements?: { [key: string]: string }
): GeometryData => ({
    type: 'triangle',
    vertices: [
        { x: 20, y: 20, label: a },
        { x: 180, y: 20, label: b },
        { x: 100, y: 160, label: c }
    ],
    measurements
});

export const createRightTriangle = (
    a: string, b: string, c: string,
    measurements?: { [key: string]: string }
): GeometryData => ({
    type: 'triangle',
    vertices: [
        { x: 20, y: 20, label: a },
        { x: 180, y: 20, label: b },
        { x: 20, y: 140, label: c }
    ],
    angles: [
        {
            vertex: { x: 20, y: 20 },
            point1: { x: 180, y: 20 },
            point2: { x: 20, y: 140 },
            isRightAngle: true
        }
    ],
    measurements
});

export const createRectangle = (
    a: string, b: string, c: string, d: string,
    measurements?: { [key: string]: string }
): GeometryData => ({
    type: 'rectangle',
    vertices: [
        { x: 20, y: 20, label: a },
        { x: 180, y: 20, label: b },
        { x: 180, y: 120, label: c },
        { x: 20, y: 120, label: d }
    ],
    measurements
});

export const createSquare = (
    a: string, b: string, c: string, d: string,
    sideLength?: string
): GeometryData => ({
    type: 'square',
    vertices: [
        { x: 30, y: 30, label: a },
        { x: 150, y: 30, label: b },
        { x: 150, y: 150, label: c },
        { x: 30, y: 150, label: d }
    ],
    measurements: sideLength ? { [a + b]: sideLength } : undefined
});

export const createCircle = (
    centerLabel: string,
    radiusLabel?: string
): GeometryData => ({
    type: 'circle',
    circles: [
        {
            center: { x: 100, y: 100, label: centerLabel },
            radius: 60,
            label: centerLabel,
            radiusLabel
        }
    ]
});

export const createLineSegment = (
    a: string, b: string,
    length?: string
): GeometryData => ({
    type: 'line',
    lines: [
        {
            from: { x: 20, y: 100, label: a },
            to: { x: 180, y: 100, label: b },
            label: length
        }
    ]
});
