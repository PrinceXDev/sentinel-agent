/**
 * Render a harness timestamp in the viewer's own timezone.
 *
 * Every timestamp arriving from the harness or the estate is UTC.
 * `toISOString().slice(11, 19)` renders that UTC value verbatim — which reads as
 * flatly wrong to an operator glancing between the screen and their own clock
 * during a live incident, the one moment several of these panels exist to serve.
 *
 * This used to be three separate local `clock()` functions (in `Timeline.tsx`,
 * `IncidentBrief.tsx`, `AuditTrail.tsx`), all with the same UTC bug — fixing one
 * and grepping for `toISOString().slice` to find the others missed two of them,
 * because backslash-escaped parentheses mean a capture *group* in POSIX basic
 * regex, not literal characters, so the search silently matched nothing. One
 * shared function means there is exactly one place left to get this wrong.
 */
export function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--:--';
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
