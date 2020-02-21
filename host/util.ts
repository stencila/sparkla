/**
 * Get the minimum of two number, both of which may
 * be undefined.
 */
export function optionalMin(a?: number, b?: number): number | undefined {
  if (a === undefined && b === undefined) return undefined
  if (a === undefined) return b
  if (b === undefined) return a
  return Math.min(a, b)
}
