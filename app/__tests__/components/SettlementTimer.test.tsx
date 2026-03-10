import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettlementTimer } from '../../src/components/shared/SettlementTimer';

describe('SettlementTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders timer element', () => {
    vi.setSystemTime(new Date('2026-03-11T17:00:00Z'));
    render(<SettlementTimer />);
    expect(screen.getByTestId('settlement-timer')).toBeInTheDocument();
  });

  it('shows Trading badge during market hours', () => {
    // Wednesday 2026-03-11 12:00 PM ET = 17:00 UTC (EDT)
    vi.setSystemTime(new Date('2026-03-11T17:00:00Z'));
    render(<SettlementTimer />);
    expect(screen.getByText('Trading')).toBeInTheDocument();
  });

  it('shows Settling badge during settlement window', () => {
    // 4:05 PM ET = 20:05 UTC
    vi.setSystemTime(new Date('2026-03-11T20:05:00Z'));
    render(<SettlementTimer />);
    expect(screen.getByText('Settling')).toBeInTheDocument();
  });

  it('shows Closed badge on weekends', () => {
    // Saturday
    vi.setSystemTime(new Date('2026-03-14T17:00:00Z'));
    render(<SettlementTimer />);
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });
});
