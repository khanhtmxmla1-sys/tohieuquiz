import React from 'react';

interface Point {
    x: number;
    y: number;
    label?: string;
}

interface GeometryData {
    type: 'triangle' | 'square' | 'rectangle' | 'circle' | 'line' | 'angle';
    vertices?: Point[];
    measurements?: Record<string, string>;
    circles?: Array<{
        center: Point;
        radius: number;
        label?: string;
        radiusLabel?: string;
    }>;
    lines?: Array<{
        from: Point;
        to: Point;
        label?: string;
    }>;
    angle?: {
        vertex: Point;
        start: Point;
        end: Point;
        label?: string;
        showArc?: boolean;
    };
}

interface GeometryPreviewProps {
    data: GeometryData;
}

const GeometryPreview: React.FC<GeometryPreviewProps> = ({ data }) => {
    if (!data) return null;

    const renderPointLabel = (p: Point, offsetX = 0, offsetY = 0) => {
        if (!p.label) return null;
        return (
            <text
                x={p.x + offsetX}
                y={p.y + offsetY}
                className="text-sm font-bold fill-gray-700"
                textAnchor="middle"
                dominantBaseline="middle"
            >
                {p.label}
            </text>
        );
    };

    const renderContent = () => {
        switch (data.type) {
            case 'angle':
                if (!data.angle) return null;
                const { vertex, start, end, label, showArc } = data.angle;

                // Calculate angles for arc
                const startAngle = Math.atan2(start.y - vertex.y, start.x - vertex.x);
                const endAngle = Math.atan2(end.y - vertex.y, end.x - vertex.x);

                // Draw arc if requested
                let arcPath = '';
                if (showArc) {
                    const radius = 30;
                    const largeArcFlag = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
                    const sweepFlag = endAngle > startAngle ? 1 : 0;
                    const startArcX = vertex.x + radius * Math.cos(startAngle);
                    const startArcY = vertex.y + radius * Math.sin(startAngle);
                    const endArcX = vertex.x + radius * Math.cos(endAngle);
                    const endArcY = vertex.y + radius * Math.sin(endAngle);
                    arcPath = `M ${startArcX} ${startArcY} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${endArcX} ${endArcY}`;
                }

                return (
                    <>
                        {/* Rays */}
                        <line x1={vertex.x} y1={vertex.y} x2={start.x} y2={start.y} stroke="black" strokeWidth="2" />
                        <line x1={vertex.x} y1={vertex.y} x2={end.x} y2={end.y} stroke="black" strokeWidth="2" />

                        {/* Points */}
                        <circle cx={vertex.x} cy={vertex.y} r="3" fill="black" />
                        <circle cx={start.x} cy={start.y} r="3" fill="black" />
                        <circle cx={end.x} cy={end.y} r="3" fill="black" />

                        {/* Labels */}
                        {renderPointLabel(vertex, -15, 15)}
                        {renderPointLabel(start, 15, 0)}
                        {renderPointLabel(end, 0, -15)}

                        {/* Arc */}
                        {showArc && <path d={arcPath} stroke="black" fill="none" />}

                        {/* Angle Label */}
                        {label && (
                            <text x={vertex.x + 40} y={vertex.y - 10} className="text-sm fill-gray-600">
                                {label}
                            </text>
                        )}
                    </>
                );

            case 'triangle':
            case 'square':
            case 'rectangle':
                if (!data.vertices || data.vertices.length < 3) return null;
                const pathData = data.vertices.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

                return (
                    <>
                        <path d={pathData} stroke="black" strokeWidth="2" fill="none" />
                        {data.vertices.map((p, i) => {
                            // Calculate label offset based on position relative to center
                            const centerX = data.vertices!.reduce((sum, v) => sum + v.x, 0) / data.vertices!.length;
                            const centerY = data.vertices!.reduce((sum, v) => sum + v.y, 0) / data.vertices!.length;
                            const dx = p.x - centerX;
                            const dy = p.y - centerY;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            const offsetX = (dx / dist) * 20;
                            const offsetY = (dy / dist) * 20;

                            return (
                                <g key={i}>
                                    <circle cx={p.x} cy={p.y} r="3" fill="black" />
                                    {renderPointLabel(p, offsetX, offsetY)}
                                </g>
                            );
                        })}
                        {/* Measurements could be added here if needed */}
                    </>
                );

            case 'circle':
                return (
                    <>
                        {data.circles?.map((c, i) => (
                            <g key={i}>
                                <circle cx={c.center.x} cy={c.center.y} r={c.radius} stroke="black" strokeWidth="2" fill="none" />
                                <circle cx={c.center.x} cy={c.center.y} r="3" fill="black" />
                                {renderPointLabel(c.center, 0, 15)}
                                {c.radiusLabel && (
                                    <text x={c.center.x + c.radius / 2} y={c.center.y - 5} className="text-xs fill-gray-600" textAnchor="middle">
                                        {c.radiusLabel}
                                    </text>
                                )}
                                {/* Draw radius line */}
                                <line x1={c.center.x} y1={c.center.y} x2={c.center.x + c.radius} y2={c.center.y} stroke="black" strokeWidth="1" strokeDasharray="4 4" />
                            </g>
                        ))}
                    </>
                );

            case 'line':
                return (
                    <>
                        {data.lines?.map((l, i) => (
                            <g key={i}>
                                <line x1={l.from.x} y1={l.from.y} x2={l.to.x} y2={l.to.y} stroke="black" strokeWidth="2" />
                                <circle cx={l.from.x} cy={l.from.y} r="3" fill="black" />
                                <circle cx={l.to.x} cy={l.to.y} r="3" fill="black" />
                                {renderPointLabel(l.from, 0, -15)}
                                {renderPointLabel(l.to, 0, -15)}
                                {l.label && (
                                    <text
                                        x={(l.from.x + l.to.x) / 2}
                                        y={(l.from.y + l.to.y) / 2 - 10}
                                        className="text-xs fill-gray-600"
                                        textAnchor="middle"
                                    >
                                        {l.label}
                                    </text>
                                )}
                            </g>
                        ))}
                    </>
                );

            default:
                return <text x="10" y="20" className="text-red-500">Unsupported geometry type</text>;
        }
    };

    return (
        <div className="flex justify-center p-4 bg-white rounded-lg border border-gray-200">
            <svg width="300" height="250" viewBox="0 0 300 250" className="overflow-visible">
                {renderContent()}
            </svg>
        </div>
    );
};

export default GeometryPreview;
