import { describe, it, expect } from 'vitest';
import { MeridianError, MeridianErrorCode, isMeridianError } from '../errors.js';

describe('MeridianError', () => {
  it('should create an error with code and message', () => {
    const err = new MeridianError(
      MeridianErrorCode.ORACLE_PRICE_STALE,
      'Price is too old',
    );
    expect(err.code).toBe(MeridianErrorCode.ORACLE_PRICE_STALE);
    expect(err.message).toBe('Price is too old');
    expect(err.name).toBe('MeridianError');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(MeridianError);
  });

  it('should carry optional cause and context', () => {
    const cause = new Error('underlying issue');
    const context = { feedId: 'abc', age: 500 };
    const err = new MeridianError(
      MeridianErrorCode.NETWORK_ERROR,
      'Connection failed',
      cause,
      context,
    );
    expect(err.cause).toBe(cause);
    expect(err.context).toEqual(context);
  });

  it('should serialize to JSON correctly', () => {
    const cause = new Error('root cause');
    const err = new MeridianError(
      MeridianErrorCode.RPC_ERROR,
      'RPC unavailable',
      cause,
      { endpoint: 'https://example.com' },
    );
    const json = err.toJSON();
    expect(json['name']).toBe('MeridianError');
    expect(json['code']).toBe('RPC_ERROR');
    expect(json['message']).toBe('RPC unavailable');
    expect(json['cause']).toBe('root cause');
    expect(json['context']).toEqual({ endpoint: 'https://example.com' });
  });

  it('should serialize non-Error cause as-is', () => {
    const err = new MeridianError(
      MeridianErrorCode.DEMO_MODE_ERROR,
      'demo',
      'string cause',
    );
    const json = err.toJSON();
    expect(json['cause']).toBe('string cause');
  });
});

describe('isMeridianError', () => {
  it('should return true for MeridianError instances', () => {
    const err = new MeridianError(MeridianErrorCode.PROGRAM_PAUSED, 'paused');
    expect(isMeridianError(err)).toBe(true);
  });

  it('should return false for plain Error', () => {
    expect(isMeridianError(new Error('nope'))).toBe(false);
  });

  it('should return false for non-error values', () => {
    expect(isMeridianError(null)).toBe(false);
    expect(isMeridianError('string')).toBe(false);
    expect(isMeridianError(42)).toBe(false);
  });
});

describe('MeridianErrorCode', () => {
  it('should contain all expected error codes', () => {
    const codes = Object.values(MeridianErrorCode);
    expect(codes).toContain('MARKET_ALREADY_SETTLED');
    expect(codes).toContain('ORACLE_PRICE_STALE');
    expect(codes).toContain('PHOENIX_INTEROP_ERROR');
    expect(codes).toContain('FINNHUB_API_ERROR');
    expect(codes.length).toBe(15);
  });
});
