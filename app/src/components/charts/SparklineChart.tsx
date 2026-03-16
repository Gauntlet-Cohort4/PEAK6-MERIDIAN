'use client';

/**
 * @module SparklineChart
 * Lightweight SVG sparkline chart with area fill gradient and draw-in animation.
 * No external charting library required — pure SVG.
 */

import React, { useId, useMemo } from 'react';

interface SparklineChartProps {
  readonly data: readonly { time: number; value: number }[];
  readonly width?: number;
  readonly height?: number;
  readonly className?: string;
  readonly color?: string;
  readonly fillColor?: string;
  readonly showLastDot?: boolean;
}

/** Green for price-up, red for price-down. */
const COLOR_UP = '#00d26a';
const COLOR_DOWN = '#ff3b69';

/** Padding inside the SVG viewBox so the line doesn't clip edges. */
const PADDING = 2;

function SparklineChartInner({
  data,
  width = 200,
  height = 60,
  className,
  color,
  fillColor,
  showLastDot = false,
}: SparklineChartProps): React.ReactElement | null {
  const instanceId = useId();
  const gradientId = `sparkline-gradient-${instanceId}`;

  const { polylinePoints, areaPoints, resolvedColor, resolvedFill, lastPoint } =
    useMemo(() => {
      if (data.length < 2) {
        return {
          polylinePoints: '',
          areaPoints: '',
          resolvedColor: color ?? COLOR_UP,
          resolvedFill: fillColor ?? color ?? COLOR_UP,
          lastPoint: null,
        };
      }

      const firstValue = data[0].value;
      const lastValue = data[data.length - 1].value;
      const autoColor = lastValue >= firstValue ? COLOR_UP : COLOR_DOWN;
      const lineColor = color ?? autoColor;
      const areaFill = fillColor ?? lineColor;

      // Compute value bounds
      const values = data.map((d) => d.value);
      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);
      const range = maxVal - minVal || 1;

      const drawWidth = width - PADDING * 2;
      const drawHeight = height - PADDING * 2;

      // Map data to SVG coordinates
      const coords = data.map((point, i) => {
        const x = PADDING + (i / (data.length - 1)) * drawWidth;
        const y = PADDING + drawHeight - ((point.value - minVal) / range) * drawHeight;
        return { x, y };
      });

      const polyline = coords.map((c) => `${c.x},${c.y}`).join(' ');

      // Area: line path + close along bottom
      const firstCoord = coords[0];
      const lastCoord = coords[coords.length - 1];
      const area =
        polyline +
        ` ${lastCoord.x},${height - PADDING} ${firstCoord.x},${height - PADDING}`;

      return {
        polylinePoints: polyline,
        areaPoints: area,
        resolvedColor: lineColor,
        resolvedFill: areaFill,
        lastPoint: lastCoord,
      };
    }, [data, width, height, color, fillColor]);

  if (data.length < 2) {
    return null;
  }

  // Approximate total path length for stroke animation
  const approxPathLength = width * 2;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
      className={className}
      role="img"
      aria-label="Price sparkline chart"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={resolvedFill} stopOpacity={0.3} />
          <stop offset="100%" stopColor={resolvedFill} stopOpacity={0.02} />
        </linearGradient>

        <style>{`
          @keyframes sparkline-draw-${CSS.escape(instanceId)} {
            from {
              stroke-dashoffset: ${approxPathLength};
            }
            to {
              stroke-dashoffset: 0;
            }
          }
          @keyframes sparkline-pulse-${CSS.escape(instanceId)} {
            0%, 100% { r: 3; opacity: 1; }
            50% { r: 5; opacity: 0.6; }
          }
        `}</style>
      </defs>

      {/* Area fill */}
      <polygon points={areaPoints} fill={`url(#${gradientId})`} />

      {/* Line */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={resolvedColor}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={approxPathLength}
        strokeDashoffset={0}
        style={{
          animation: `sparkline-draw-${CSS.escape(instanceId)} 1s ease-out forwards`,
        }}
      />

      {/* Pulsing dot at last data point */}
      {showLastDot && lastPoint && (
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={3}
          fill={resolvedColor}
          style={{
            animation: `sparkline-pulse-${CSS.escape(instanceId)} 2s ease-in-out infinite`,
          }}
        />
      )}
    </svg>
  );
}

export const SparklineChart = React.memo(SparklineChartInner);
export default SparklineChart;
