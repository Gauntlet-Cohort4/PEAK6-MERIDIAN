/**
 * @module adapters/phoenix-interop
 * Bridge between Phoenix V1 SDK (@solana/web3.js PublicKey) and
 * Solana Kit (@solana/kit address strings).
 *
 * This is the ONLY file that imports @solana/web3.js types.
 * All debug logging is guarded by DEBUG_FLAGS.PHOENIX_INTEROP.
 */

import { MeridianError, MeridianErrorCode } from '@meridian/shared/errors';
import { debugLog } from '@meridian/shared/debug';

/**
 * Placeholder type for @solana/web3.js PublicKey.
 * TODO: Replace with actual PublicKey import once @solana/web3.js is installed.
 *
 * import { PublicKey } from '@solana/web3.js';
 */
type PublicKeyLike = {
  readonly toBase58: () => string;
  readonly toBytes: () => Uint8Array;
};

/**
 * Validate that a string looks like a valid Solana base58 address.
 * Real validation would use base58 decoding; this is a structural check.
 */
function isValidBase58Address(address: string): boolean {
  if (address.length < 32 || address.length > 44) {
    return false;
  }
  // Base58 character set
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(address);
}

/**
 * Convert a Solana Kit address string to a @solana/web3.js PublicKey.
 *
 * TODO: Replace with actual PublicKey construction when @solana/web3.js
 * is available:
 *   return new PublicKey(address);
 *
 * @param address - Base58-encoded Solana address string
 * @returns A PublicKey-like object (stub until web3.js is installed)
 */
export function kitAddressToPublicKey(address: string): PublicKeyLike {
  debugLog('PHOENIX_INTEROP', 'phoenix-interop', 'kitAddressToPublicKey', 'Converting address', {
    address,
  });

  if (!isValidBase58Address(address)) {
    throw new MeridianError(
      MeridianErrorCode.PHOENIX_INTEROP_ERROR,
      `Invalid Solana address: ${address}`,
      undefined,
      { address },
    );
  }

  // Stub: return an object that mimics PublicKey interface
  // TODO: return new PublicKey(address);
  return Object.freeze({
    toBase58: () => address,
    toBytes: () => new TextEncoder().encode(address).slice(0, 32),
  });
}

/**
 * Convert a @solana/web3.js PublicKey back to a Solana Kit address string.
 *
 * TODO: Replace with actual PublicKey.toBase58() when @solana/web3.js
 * is available:
 *   return pubkey.toBase58();
 *
 * @param pubkey - A PublicKey-like object
 * @returns Base58-encoded Solana address string
 */
export function publicKeyToKitAddress(pubkey: PublicKeyLike): string {
  debugLog('PHOENIX_INTEROP', 'phoenix-interop', 'publicKeyToKitAddress', 'Converting pubkey', {});

  if (!pubkey || typeof pubkey.toBase58 !== 'function') {
    throw new MeridianError(
      MeridianErrorCode.PHOENIX_INTEROP_ERROR,
      'Invalid PublicKey object: missing toBase58 method',
    );
  }

  const address = pubkey.toBase58();

  debugLog(
    'PHOENIX_INTEROP',
    'phoenix-interop',
    'publicKeyToKitAddress',
    'Converted pubkey to address',
    { address },
  );

  return address;
}

/**
 * Convert a batch of Kit addresses to PublicKeys.
 * Returns a new array; does not mutate the input.
 */
export function batchKitToPublicKey(addresses: readonly string[]): readonly PublicKeyLike[] {
  return Object.freeze(addresses.map(kitAddressToPublicKey));
}

/**
 * Convert a batch of PublicKeys to Kit addresses.
 * Returns a new array; does not mutate the input.
 */
export function batchPublicKeyToKit(pubkeys: readonly PublicKeyLike[]): readonly string[] {
  return Object.freeze(pubkeys.map(publicKeyToKitAddress));
}
