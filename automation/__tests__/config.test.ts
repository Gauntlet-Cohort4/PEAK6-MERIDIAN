/**
 * Tests for automation config loading and validation.
 */

import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';

/** Minimal valid environment for config loading. */
function validEnv(): Record<string, string> {
  return {
    SOLANA_RPC_URL: 'https://api.mainnet-beta.solana.com',
    FINNHUB_API_KEY: 'test-finnhub-key',
    ADMIN_KEYPAIR_PATH: '/path/to/keypair.json',
    PROGRAM_ID: 'MeridianProgram111111111111111111111111111',
  };
}

describe('loadConfig', () => {
  it('should load config with all required vars', () => {
    const config = loadConfig(validEnv());

    expect(config.solanaRpcUrl).toBe('https://api.mainnet-beta.solana.com');
    expect(config.finnhubApiKey).toBe('test-finnhub-key');
    expect(config.adminKeypairPath).toBe('/path/to/keypair.json');
    expect(config.programId).toBe('MeridianProgram111111111111111111111111111');
  });

  it('should apply default values for optional vars', () => {
    const config = loadConfig(validEnv());

    expect(config.pythHermesUrl).toBe('https://hermes.pyth.network');
    expect(config.pythBenchmarksUrl).toBe('https://benchmarks.pyth.network');
    expect(config.demoMode).toBe(false);
    expect(config.cronMorningSchedule).toBe('0 8 * * 1-5');
    expect(config.cronSettlementSchedule).toBe('5 16 * * 1-5');
  });

  it('should parse DEMO_MODE=true', () => {
    const env = { ...validEnv(), DEMO_MODE: 'true' };
    const config = loadConfig(env);
    expect(config.demoMode).toBe(true);
  });

  it('should parse DEMO_MODE=1', () => {
    const env = { ...validEnv(), DEMO_MODE: '1' };
    const config = loadConfig(env);
    expect(config.demoMode).toBe(true);
  });

  it('should treat DEMO_MODE=false as false', () => {
    const env = { ...validEnv(), DEMO_MODE: 'false' };
    const config = loadConfig(env);
    expect(config.demoMode).toBe(false);
  });

  it('should override default Pyth URLs when provided', () => {
    const env = {
      ...validEnv(),
      PYTH_HERMES_URL: 'https://custom-hermes.example.com',
      PYTH_BENCHMARKS_URL: 'https://custom-benchmarks.example.com',
    };
    const config = loadConfig(env);
    expect(config.pythHermesUrl).toBe('https://custom-hermes.example.com');
    expect(config.pythBenchmarksUrl).toBe('https://custom-benchmarks.example.com');
  });

  it('should override cron schedules when provided', () => {
    const env = {
      ...validEnv(),
      CRON_MORNING_SCHEDULE: '30 7 * * 1-5',
      CRON_SETTLEMENT_SCHEDULE: '0 17 * * 1-5',
    };
    const config = loadConfig(env);
    expect(config.cronMorningSchedule).toBe('30 7 * * 1-5');
    expect(config.cronSettlementSchedule).toBe('0 17 * * 1-5');
  });

  it('should throw when SOLANA_RPC_URL is missing', () => {
    const env = { ...validEnv() };
    delete (env as Record<string, string | undefined>)['SOLANA_RPC_URL'];
    expect(() => loadConfig(env)).toThrow('Configuration validation failed');
  });

  it('should throw when FINNHUB_API_KEY is missing', () => {
    const env = { ...validEnv() };
    delete (env as Record<string, string | undefined>)['FINNHUB_API_KEY'];
    expect(() => loadConfig(env)).toThrow('Configuration validation failed');
  });

  it('should throw when ADMIN_KEYPAIR_PATH is missing', () => {
    const env = { ...validEnv() };
    delete (env as Record<string, string | undefined>)['ADMIN_KEYPAIR_PATH'];
    expect(() => loadConfig(env)).toThrow('Configuration validation failed');
  });

  it('should throw when PROGRAM_ID is missing', () => {
    const env = { ...validEnv() };
    delete (env as Record<string, string | undefined>)['PROGRAM_ID'];
    expect(() => loadConfig(env)).toThrow('Configuration validation failed');
  });

  it('should return a frozen config object', () => {
    const config = loadConfig(validEnv());
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('should throw when PYTH_HERMES_URL is not a valid URL', () => {
    const env = { ...validEnv(), PYTH_HERMES_URL: 'not-a-url' };
    expect(() => loadConfig(env)).toThrow('Configuration validation failed');
  });
});
