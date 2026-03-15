/**
 * Centralized demo-mode check.
 *
 * Every file that needs to know whether the app is in demo mode should
 * import this constant rather than re-deriving it from process.env.
 */
export const IS_DEMO_MODE: boolean =
  process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
