/**
 * @module idl
 * Typed Anchor IDL export for the Meridian program.
 *
 * We import the JSON directly (resolveJsonModule is enabled in tsconfig)
 * and re-export with the Anchor IDL type for full type-safety.
 */

import type { Idl } from '@coral-xyz/anchor';
import MeridianIDLJson from './meridian.json';

/** The raw Meridian IDL object, cast to Anchor's Idl type. */
export const MeridianIDL: Idl = MeridianIDLJson as unknown as Idl;

/** The on-chain program address from the IDL metadata. */
export const MERIDIAN_PROGRAM_ID: string = MeridianIDLJson.address;
