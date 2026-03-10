/**
 * Tests for Phoenix interop adapter.
 */

import { describe, it, expect } from 'vitest';
import {
  kitAddressToPublicKey,
  publicKeyToKitAddress,
  batchKitToPublicKey,
  batchPublicKeyToKit,
} from '../../src/lib/adapters/phoenix-interop';
import { MeridianError } from '@meridian/shared/errors';

// A valid-looking base58 Solana address (44 chars, valid base58 chars)
const VALID_ADDRESS = '11111111111111111111111111111111';
const VALID_ADDRESS_2 = '22222222222222222222222222222222';

describe('kitAddressToPublicKey', () => {
  it('should convert a valid address to a PublicKey-like object', () => {
    const pk = kitAddressToPublicKey(VALID_ADDRESS);

    expect(pk.toBase58()).toBe(VALID_ADDRESS);
    expect(pk.toBytes().length).toBeGreaterThan(0);
  });

  it('should return a frozen object', () => {
    const pk = kitAddressToPublicKey(VALID_ADDRESS);
    expect(Object.isFrozen(pk)).toBe(true);
  });

  it('should throw on invalid address (too short)', () => {
    expect(() => kitAddressToPublicKey('abc')).toThrow(MeridianError);
  });

  it('should throw on invalid base58 characters', () => {
    // 'O' is not in base58
    expect(() => kitAddressToPublicKey('OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO')).toThrow(MeridianError);
  });

  it('should throw on empty string', () => {
    expect(() => kitAddressToPublicKey('')).toThrow(MeridianError);
  });
});

describe('publicKeyToKitAddress', () => {
  it('should convert a PublicKey-like object to an address string', () => {
    const pk = kitAddressToPublicKey(VALID_ADDRESS);
    const address = publicKeyToKitAddress(pk);

    expect(address).toBe(VALID_ADDRESS);
  });

  it('should throw on null-like input', () => {
    // @ts-expect-error testing invalid input
    expect(() => publicKeyToKitAddress(null)).toThrow(MeridianError);
  });

  it('should throw on object without toBase58', () => {
    // @ts-expect-error testing invalid input
    expect(() => publicKeyToKitAddress({ toString: () => 'bad' })).toThrow(MeridianError);
  });
});

describe('batchKitToPublicKey', () => {
  it('should convert multiple addresses', () => {
    const pks = batchKitToPublicKey([VALID_ADDRESS, VALID_ADDRESS_2]);

    expect(pks).toHaveLength(2);
    expect(pks[0]?.toBase58()).toBe(VALID_ADDRESS);
    expect(pks[1]?.toBase58()).toBe(VALID_ADDRESS_2);
  });

  it('should return a frozen array', () => {
    const pks = batchKitToPublicKey([VALID_ADDRESS]);
    expect(Object.isFrozen(pks)).toBe(true);
  });

  it('should handle empty array', () => {
    const pks = batchKitToPublicKey([]);
    expect(pks).toHaveLength(0);
  });
});

describe('batchPublicKeyToKit', () => {
  it('should convert multiple pubkeys to addresses', () => {
    const pks = batchKitToPublicKey([VALID_ADDRESS, VALID_ADDRESS_2]);
    const addresses = batchPublicKeyToKit(pks);

    expect(addresses).toEqual([VALID_ADDRESS, VALID_ADDRESS_2]);
  });

  it('should return a frozen array', () => {
    const pks = batchKitToPublicKey([VALID_ADDRESS]);
    const addresses = batchPublicKeyToKit(pks);
    expect(Object.isFrozen(addresses)).toBe(true);
  });
});
