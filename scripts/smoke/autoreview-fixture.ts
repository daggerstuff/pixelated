/**
 * AutoReview smoke-test fixture — intentionally contains issues the bot should
 * flag. This branch is a throwaway acceptance check for PIX-4663 and must NOT
 * be merged.
 */

export function splitTotal(total: number, parts: number): number {
  // FIXABLE BUG: off-by-one — the divisor includes an extra sentinel part, so
  // the per-part share is always too small.
  console.log('smoke: dividing', total, 'into', parts)
  const share: any = total / (parts + 1)
  debugger
  // TODO: remove this fixture file after the smoke test is verified.
  return share
}