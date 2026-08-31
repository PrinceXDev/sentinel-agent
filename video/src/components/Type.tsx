/**
 * Typography.
 *
 * One hierarchy — eyebrow, hero, headline, lead, body — used everywhere, so the
 * viewer learns in the first fifteen seconds what each size means and never has
 * to re-read the screen to work out what is important.
 *
 * On-screen text is kept short on purpose. Nobody should have to pause the film.
 */
import { useCurrentFrame } from 'remotion';
import { COLORS, FONTS, TYPE } from '../theme';
import { rise, ease, fade } from '../lib/anim';

type TextProps = {
  children: React.ReactNode;
  delay?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  style?: React.CSSProperties;
};

export const Eyebrow = ({ children, delay = 0, color = COLORS.dim, style }: TextProps) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        fontFamily: FONTS.mono,
        fontSize: TYPE.eyebrow,
        letterSpacing: '0.24em',
        textTransform: 'uppercase',
        color,
        ...rise(frame, delay, 16),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Hero = ({ children, delay = 0, color = COLORS.ink, align = 'center', style }: TextProps) => {
  const frame = useCurrentFrame();
  const s = ease(frame, delay);
  return (
    <div
      style={{
        fontFamily: FONTS.sans,
        fontSize: TYPE.hero,
        fontWeight: 600,
        lineHeight: 1.02,
        letterSpacing: '-0.035em',
        color,
        textAlign: align,
        opacity: s,
        filter: `blur(${(1 - s) * 16}px)`,
        transform: `translateY(${(1 - s) * 30}px) scale(${0.985 + s * 0.015})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Headline = ({ children, delay = 0, color = COLORS.ink, align = 'center', style }: TextProps) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        fontFamily: FONTS.sans,
        fontSize: TYPE.headline,
        fontWeight: 600,
        lineHeight: 1.08,
        letterSpacing: '-0.028em',
        color,
        textAlign: align,
        ...rise(frame, delay, 26),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Title = ({ children, delay = 0, color = COLORS.ink, align = 'center', style }: TextProps) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        fontFamily: FONTS.sans,
        fontSize: TYPE.title,
        fontWeight: 600,
        lineHeight: 1.14,
        letterSpacing: '-0.02em',
        color,
        textAlign: align,
        ...rise(frame, delay, 22),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Lead = ({ children, delay = 0, color = COLORS.muted, align = 'center', style }: TextProps) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        fontFamily: FONTS.sans,
        fontSize: TYPE.lead,
        fontWeight: 400,
        lineHeight: 1.38,
        color,
        textAlign: align,
        ...rise(frame, delay, 18),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Body = ({ children, delay = 0, color = COLORS.muted, align = 'center', style }: TextProps) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        fontFamily: FONTS.sans,
        fontSize: TYPE.body,
        lineHeight: 1.5,
        color,
        textAlign: align,
        ...rise(frame, delay, 14),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Mono = ({ children, delay = 0, color = COLORS.steel, align = 'center', style }: TextProps) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        fontFamily: FONTS.mono,
        fontSize: TYPE.small,
        letterSpacing: '0.01em',
        color,
        textAlign: align,
        ...rise(frame, delay, 12),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/**
 * A headline revealed word by word.
 *
 * Reserved for the film's few load-bearing sentences — the ones the whole
 * project rests on. Everywhere else, a single rise is enough.
 */
export const WordReveal = ({
  text,
  delay = 0,
  per = 3.2,
  size = TYPE.headline,
  color = COLORS.ink,
  weight = 600,
  align = 'center',
  style,
}: {
  text: string;
  delay?: number;
  per?: number;
  size?: number;
  color?: string;
  weight?: number;
  align?: 'left' | 'center';
  style?: React.CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const words = text.split(' ');
  return (
    <div
      style={{
        fontFamily: FONTS.sans,
        fontSize: size,
        fontWeight: weight,
        lineHeight: 1.1,
        letterSpacing: '-0.028em',
        color,
        display: 'flex',
        flexWrap: 'wrap',
        gap: `0 ${size * 0.26}px`,
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        ...style,
      }}
    >
      {words.map((w, i) => {
        const s = ease(frame, delay + i * per);
        return (
          <span
            key={`${w}-${i}`}
            style={{
              display: 'inline-block',
              opacity: s,
              filter: `blur(${(1 - s) * 10}px)`,
              transform: `translateY(${(1 - s) * 22}px)`,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

/** A thin rule that draws itself. Used to separate an idea from its detail. */
export const Rule = ({
  delay = 0,
  width = 220,
  color = COLORS.lineStrong,
}: {
  delay?: number;
  width?: number;
  color?: string;
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        height: 1,
        width: width * ease(frame, delay),
        background: color,
        opacity: fade(frame, delay, delay + 8),
      }}
    />
  );
};
