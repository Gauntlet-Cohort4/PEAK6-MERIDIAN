import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettlementTimer } from '../../src/components/shared/SettlementTimer';

describe('SettlementTimer - Extended Coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the settlement-timer element', () => {
    vi.setSystemTime(new Date('2026-03-11T17:00:00Z'));
    render(<SettlementTimer />);
    expect(screen.getByTestId('settlement-timer')).toBeInTheDocument();
  });

  it('displays Trading badge during market hours (Wednesday noon ET)', () => {
    // Wednesday 2026-03-11 12:00 PM ET = 17:00 UTC (EDT)
    vi.setSystemTime(new Date('2026-03-11T17:00:00Z'));
    render(<SettlementTimer />);
    expect(screen.getByText('Trading')).toBeInTheDocument();
  });

  it('displays countdown to settlement during trading', () => {
    vi.setSystemTime(new Date('2026-03-11T17:00:00Z'));
    render(<SettlementTimer />);
    expect(screen.getByText(/Settlement in/)).toBeInTheDocument();
  });

  it('displays Settling badge during settlement window (4:05 PM ET)', () => {
    // 4:05 PM ET = 20:05 UTC
    vi.setSystemTime(new Date('2026-03-11T20:05:00Z'));
    render(<SettlementTimer />);
    expect(screen.getByText('Settling')).toBeInTheDocument();
    expect(screen.getByText('Settlement in progress...')).toBeInTheDocument();
  });

  it('displays Closed badge on Saturday', () => {
    vi.setSystemTime(new Date('2026-03-14T17:00:00Z'));
    render(<SettlementTimer />);
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });

  it('displays Closed badge on Sunday', () => {
    vi.setSystemTime(new Date('2026-03-15T12:00:00Z'));
    render(<SettlementTimer />);
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });

  it('shows Closed before market open on a weekday', () => {
    // 8:00 AM ET = 13:00 UTC (before 9:30 AM open)
    vi.setSystemTime(new Date('2026-03-11T13:00:00Z'));
    render(<SettlementTimer />);
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });

  it('shows Closed after settlement window ends', () => {
    // 4:15 PM ET = 20:15 UTC (after 4:10 PM settle end)
    vi.setSystemTime(new Date('2026-03-11T20:15:00Z'));
    render(<SettlementTimer />);
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });

  it('includes "Market Closed" text when closed', () => {
    vi.setSystemTime(new Date('2026-03-14T17:00:00Z'));
    render(<SettlementTimer />);
    expect(screen.getByText(/Market Closed/)).toBeInTheDocument();
  });
});
