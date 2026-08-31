/**
 * A terminal that types.
 *
 * Used for the proof act, where the content is real output — the 298-test run
 * and the conformance report were produced by running the repository's own
 * commands, and the strings below are copied from that output rather than
 * written for the film.
 */
import { useCurrentFrame } from 'remotion';
import { COLORS, FONTS } from '../theme';
import { ease, fade, typed, caretOn } from '../lib/anim';

export type TermLine = {
  text: string;
  /** Frame, relative to the terminal, at which this line starts appearing. */
  at: number;
  color?: string;
  /** Type it character by character instead of revealing it whole. */
  type?: boolean;
  dim?: boolean;
  bold?: boolean;
};

export const Terminal = ({
  title = 'sentinel-agent',
  lines,
  width = 1180,
  fontSize = 26,
  delay = 0,
  style,
}: {
  title?: string;
  lines: TermLine[];
  width?: number;
  fontSize?: number;
  delay?: number;
  style?: React.CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const s = ease(frame, delay);

  return (
    <div
      style={{
        width,
        borderRadius: 14,
        overflow: 'hidden',
        border: `1px solid ${COLORS.line}`,
        background: COLORS.surface,
        boxShadow: '0 40px 110px -40px rgba(0,0,0,0.95)',
        opacity: s,
        transform: `translateY(${(1 - s) * 22}px)`,
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 20px',
          borderBottom: `1px solid ${COLORS.line}`,
          background: COLORS.raised,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{ width: 11, height: 11, borderRadius: '50%', background: COLORS.lineStrong }}
          />
        ))}
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: fontSize * 0.72,
            color: COLORS.dim,
            marginLeft: 8,
          }}
        >
          {title}
        </div>
      </div>

      <div
        style={{
          padding: '22px 26px 26px',
          fontFamily: FONTS.mono,
          fontSize,
          lineHeight: 1.62,
          color: COLORS.ink,
          whiteSpace: 'pre',
        }}
      >
        {lines.map((l, i) => {
          const local = frame - delay;
          if (local < l.at) return <div key={i} style={{ height: fontSize * 1.62 }} />;
          const shown = l.type ? typed(local, l.text, l.at, 46) : l.text;
          const done = !l.type || shown.length === l.text.length;
          return (
            <div
              key={i}
              style={{
                color: l.color ?? (l.dim ? COLORS.dim : COLORS.ink),
                fontWeight: l.bold ? 600 : 400,
                opacity: l.type ? 1 : fade(local, l.at, l.at + 6),
              }}
            >
              {shown}
              {l.type && !done && caretOn(local) ? (
                <span style={{ color: COLORS.steel }}>▋</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** A single shell prompt line, for a command shown on its own. */
export const Command = ({
  command,
  at = 0,
  fontSize = 40,
}: {
  command: string;
  at?: number;
  fontSize?: number;
}) => {
  const frame = useCurrentFrame();
  const shown = typed(frame, command, at, 30);
  return (
    <div
      style={{
        fontFamily: FONTS.mono,
        fontSize,
        color: COLORS.ink,
        display: 'flex',
        gap: 16,
        alignItems: 'baseline',
      }}
    >
      <span style={{ color: COLORS.steel }}>$</span>
      <span>
        {shown}
        {shown.length < command.length && caretOn(frame) ? (
          <span style={{ color: COLORS.steel }}>▋</span>
        ) : null}
      </span>
    </div>
  );
};
