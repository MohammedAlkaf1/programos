/**
 * Joins class names, skipping anything falsy.
 *
 * It lives here rather than inside the component library because that library
 * is a client module. A server component that imported this from there would
 * be holding a client reference and would fail the moment it tried to call it
 * while rendering.
 */
export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}
