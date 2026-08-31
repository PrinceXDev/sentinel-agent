/**
 * Architecture diagram primitives.
 *
 * The rule this file exists to enforce is *progressive reveal*: a node appears
 * only when the narration reaches it, and an edge only once both of its ends
 * exist. A complete architecture diagram dumped on screen is unreadable, and a
 * viewer who cannot read it stops listening.
 *
 * Everything is laid out in a 1000×560 SVG space and scaled to fit, so a box can
 * be positioned once and never re-tuned for the frame.
 */
import { useCurrentFrame } from 'remotion';
import { COLORS, FONTS } from '../theme';
import { ease, fade } from '../lib/anim';

export const DIAGRAM_W = 1000;
export const DIAGRAM_H = 560;

export type NodeSpec = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string[];
  accent?: string;
  /** Frame, relative to the diagram, at which this node appears. */
  at: number;
  /** Fill tint, for the one box an act is about. */
  tint?: string;
};

export type EdgeSpec = {
  from: [number, number];
  to: [number, number];
  at: number;
  label?: string;
  accent?: string;
  /** Send a travelling pulse along this edge — data actually moving. */
  pulse?: boolean;
};

export const DiagramNode = ({ node }: { node: NodeSpec }) => {
  const frame = useCurrentFrame();
  const s = ease(frame, node.at);
  if (s <= 0.001) return null;
  const accent = node.accent ?? COLORS.line;

  return (
    <g opacity={s} transform={`translate(${node.x}, ${node.y}) scale(${0.96 + s * 0.04})`}>
      <rect
        width={node.w}
        height={node.h}
        rx={9}
        fill={node.tint ?? COLORS.surface}
        stroke={accent}
        strokeWidth={1.4}
      />
      <text
        x={node.w / 2}
        y={node.sub?.length ? 26 : node.h / 2 + 7}
        textAnchor="middle"
        fontFamily={FONTS.mono}
        fontSize={19}
        fill={node.accent ?? COLORS.ink}
        fontWeight={600}
      >
        {node.title}
      </text>
      {node.sub?.map((line, i) => (
        <text
          key={i}
          x={node.w / 2}
          y={46 + i * 19}
          textAnchor="middle"
          fontFamily={FONTS.mono}
          fontSize={14}
          fill={COLORS.dim}
        >
          {line}
        </text>
      ))}
    </g>
  );
};

export const DiagramEdge = ({ edge }: { edge: EdgeSpec }) => {
  const frame = useCurrentFrame();
  const s = ease(frame, edge.at);
  if (s <= 0.001) return null;

  const [x1, y1] = edge.from;
  const [x2, y2] = edge.to;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const accent = edge.accent ?? COLORS.lineStrong;

  // A travelling dot, restarting every 40 frames.
  const t = ((frame - edge.at) % 40) / 40;
  const px = x1 + (x2 - x1) * t;
  const py = y1 + (y2 - y1) * t;

  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x1 + (x2 - x1) * s}
        y2={y1 + (y2 - y1) * s}
        stroke={accent}
        strokeWidth={1.4}
        strokeDasharray={len}
        strokeDashoffset={0}
      />
      {edge.pulse && s > 0.98 ? (
        <circle cx={px} cy={py} r={3.4} fill={edge.accent ?? COLORS.steel} opacity={0.9} />
      ) : null}
      {edge.label ? (
        <text
          x={(x1 + x2) / 2}
          y={(y1 + y2) / 2 - 7}
          textAnchor="middle"
          fontFamily={FONTS.mono}
          fontSize={13}
          fill={COLORS.dim}
          opacity={fade(frame, edge.at + 6, edge.at + 16)}
        >
          {edge.label}
        </text>
      ) : null}
    </g>
  );
};

export const Diagram = ({
  nodes,
  edges,
  width = 1320,
}: {
  nodes: NodeSpec[];
  edges: EdgeSpec[];
  width?: number;
}) => (
  <svg
    width={width}
    height={(width * DIAGRAM_H) / DIAGRAM_W}
    viewBox={`0 0 ${DIAGRAM_W} ${DIAGRAM_H}`}
  >
    {edges.map((e, i) => (
      <DiagramEdge key={i} edge={e} />
    ))}
    {nodes.map((n) => (
      <DiagramNode key={n.id} node={n} />
    ))}
  </svg>
);

/**
 * One step of the agent pipeline, drawn as a chip in a horizontal chain.
 *
 * The pipeline is the clearest way to show where the human sits, so the step
 * that is the approval boundary is allowed the gate colour and nothing else is.
 */
export const PipelineStep = ({
  label,
  at,
  accent = COLORS.steel,
  active = false,
  wide = false,
}: {
  label: string;
  at: number;
  accent?: string;
  active?: boolean;
  wide?: boolean;
}) => {
  const frame = useCurrentFrame();
  const s = ease(frame, at);
  const pulse = active ? 0.72 + 0.28 * Math.sin((frame - at) / 7) : 1;

  return (
    <div
      style={{
        padding: wide ? '18px 34px' : '14px 22px',
        borderRadius: 10,
        border: `1px solid ${accent}`,
        background: active ? `${accent}1c` : COLORS.surface,
        fontFamily: FONTS.mono,
        fontSize: wide ? 26 : 21,
        letterSpacing: '0.06em',
        color: active ? accent : COLORS.ink,
        whiteSpace: 'nowrap',
        opacity: s * pulse,
        transform: `translateY(${(1 - s) * 14}px)`,
        boxShadow: active ? `0 0 40px ${accent}44` : 'none',
      }}
    >
      {label}
    </div>
  );
};

export const PipelineArrow = ({ at, accent = COLORS.lineStrong }: { at: number; accent?: string }) => {
  const frame = useCurrentFrame();
  const s = ease(frame, at);
  return (
    <div
      style={{
        width: 34 * s,
        height: 1,
        background: accent,
        opacity: s,
        flexShrink: 0,
      }}
    />
  );
};
