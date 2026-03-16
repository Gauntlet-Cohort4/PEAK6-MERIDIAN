'use client';

/**
 * @module PriceChart
 * Full-featured intraday price chart using lightweight-charts.
 * Dark theme matching HyperLiquid aesthetics.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type AreaSeriesPartialOptions,
  type UTCTimestamp,
} from 'lightweight-charts';
import { usePriceHistory } from '@/hooks/usePriceHistory';
import type { SupportedTicker } from '@meridian/shared/constants';

interface PriceChartProps {
  readonly ticker: SupportedTicker;
  readonly strikePrice?: number;
  readonly height?: number;
  readonly className?: string;
}

/** Converts a millisecond timestamp to a UTCTimestamp (seconds). */
const toUTCTimestamp = (ms: number): UTCTimestamp =>
  Math.floor(ms / 1000) as UTCTimestamp;

/** Dark theme colors matching HyperLiquid. */
const THEME = {
  background: '#0a0e17',
  text: '#848e9c',
  grid: '#1a1e2e',
  crosshair: '#484c56',
  strikeLine: '#f0b90b',
  greenLine: '#00d26a',
  greenTopFill: 'rgba(0, 210, 106, 0.28)',
  greenBottomFill: 'rgba(0, 210, 106, 0.02)',
  redLine: '#ff3b69',
  redTopFill: 'rgba(255, 59, 105, 0.28)',
  redBottomFill: 'rgba(255, 59, 105, 0.02)',
} as const;

/**
 * Formats a unix timestamp (ms) to HH:MM for the time scale.
 */
function formatTime(timestampMs: number): string {
  const date = new Date(timestampMs);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function PriceChartInner({
  ticker,
  strikePrice,
  height = 400,
  className,
}: PriceChartProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const { prices, isLoading } = usePriceHistory(ticker);

  const destroyChart = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }
  }, []);

  // Create and update chart
  useEffect(() => {
    const container = containerRef.current;
    if (!container || prices.length === 0) return;

    // Destroy existing chart before recreating
    destroyChart();

    const lastPrice = prices[prices.length - 1]?.value ?? 0;
    const isAboveStrike =
      strikePrice == null || lastPrice >= strikePrice;

    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: THEME.background },
        textColor: THEME.text,
        fontFamily: "'Inter', 'SF Pro', system-ui, sans-serif",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: THEME.grid },
        horzLines: { color: THEME.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: THEME.crosshair, labelBackgroundColor: THEME.crosshair },
        horzLine: { color: THEME.crosshair, labelBackgroundColor: THEME.crosshair },
      },
      timeScale: {
        borderColor: THEME.grid,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: number) => formatTime(time * 1000),
      },
      rightPriceScale: {
        borderColor: THEME.grid,
      },
      handleScroll: { vertTouchDrag: false },
    });

    chartRef.current = chart;

    // Area series with color based on strike comparison
    const areaOptions: AreaSeriesPartialOptions = {
      lineColor: isAboveStrike ? THEME.greenLine : THEME.redLine,
      topColor: isAboveStrike ? THEME.greenTopFill : THEME.redTopFill,
      bottomColor: isAboveStrike ? THEME.greenBottomFill : THEME.redBottomFill,
      lineWidth: 2,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: isAboveStrike ? THEME.greenLine : THEME.redLine,
      crosshairMarkerBackgroundColor: THEME.background,
    };

    const series = chart.addAreaSeries(areaOptions);
    seriesRef.current = series;

    // Convert price points to lightweight-charts format (time in seconds)
    const chartData = prices.map((point) => ({
      time: toUTCTimestamp(point.time),
      value: point.value,
    }));

    // If strike price exists, add invisible anchor points so the price scale
    // always includes the strike in the visible range
    if (strikePrice != null && chartData.length > 0) {
      const dataMin = Math.min(...chartData.map((d) => d.value));
      const dataMax = Math.max(...chartData.map((d) => d.value));
      const rangeIncludesStrike = strikePrice >= dataMin && strikePrice <= dataMax;

      if (!rangeIncludesStrike) {
        // Add a transparent line series at the strike price to force scale
        const anchorSeries = chart.addLineSeries({
          color: 'rgba(0,0,0,0)',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          visible: false,
        });
        anchorSeries.setData([
          { time: chartData[0].time, value: strikePrice },
          { time: chartData[chartData.length - 1].time, value: strikePrice },
        ]);
      }
    }

    series.setData(chartData);

    // Strike price horizontal line
    if (strikePrice != null) {
      series.createPriceLine({
        price: strikePrice,
        color: THEME.strikeLine,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `Strike $${strikePrice}`,
      });
    }

    // Fit content to view
    chart.timeScale().fitContent();

    // ResizeObserver for responsive behavior
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && chartRef.current) {
        const { width: newWidth } = entry.contentRect;
        chartRef.current.applyOptions({ width: newWidth });
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      destroyChart();
    };
  }, [prices, strikePrice, height, destroyChart]);

  return (
    <div className={className} style={{ position: 'relative' }}>
      {isLoading && prices.length === 0 && (
        <div
          style={{
            width: '100%',
            height: `${height}px`,
            background: THEME.background,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            {/* Skeleton bars */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end' }}>
              {Array.from({ length: 12 }, (_, i) => (
                <div
                  key={i}
                  style={{
                    width: '8px',
                    height: `${20 + Math.sin(i * 0.8) * 15 + 10}px`,
                    background: THEME.grid,
                    borderRadius: '2px',
                    animation: `skeleton-pulse 1.5s ease-in-out ${i * 0.1}s infinite`,
                  }}
                />
              ))}
            </div>
            <span style={{ color: THEME.text, fontSize: '13px' }}>
              Loading chart data...
            </span>
            <style>{`
              @keyframes skeleton-pulse {
                0%, 100% { opacity: 0.4; }
                50% { opacity: 0.8; }
              }
            `}</style>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          display: isLoading && prices.length === 0 ? 'none' : 'block',
        }}
      />
    </div>
  );
}

export const PriceChart = React.memo(PriceChartInner);
export default PriceChart;
