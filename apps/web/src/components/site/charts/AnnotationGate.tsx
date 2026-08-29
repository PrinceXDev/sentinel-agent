import { ANNOTATION_GATE_LANES } from '@/constants/annotationGate';

const W = 780;
const H = 268;

const STEP_W = 136;
const GAP = 18;
const BOX_H = 52;
const X0 = 8;

const stepX = (i: number) => X0 + i * (STEP_W + GAP);

/**
 * The failure mode the whole project is built around, drawn as two lanes.
 *
 * Both lanes are the same tool doing the same thing to the same production
 * system. The only difference is four lines of annotation metadata — and that
 * difference is the entire safety model.
 */
export const AnnotationGate = () => {
  return (
    <figure className="my-8">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Two lanes. An annotated destructive tool derives the @destructive tag, matches the approval policy, and pauses for a human. An identical tool that publishes no annotations matches no tag at all, is therefore absent from the policy, and executes with no prompt."
      >
        <title>How a missing annotation disables the approval gate</title>
        <defs>
          <marker
            id="ag-arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0,1 L7,4 L0,7 Z" fill="var(--color-line-strong)" />
          </marker>
        </defs>

        {ANNOTATION_GATE_LANES.map((lane) => (
          <g key={lane.title}>
            <text
              x={X0}
              y={lane.y - 12}
              fill={lane.accent}
              fontSize="10"
              fontFamily="var(--font-mono)"
              letterSpacing="1.4"
            >
              {lane.title.toUpperCase()}
            </text>

            {lane.steps.map((step, i) => (
              <g key={step.top}>
                <rect
                  x={stepX(i)}
                  y={lane.y}
                  width={STEP_W}
                  height={BOX_H}
                  rx="7"
                  fill="var(--color-surface)"
                  stroke={i === 1 ? lane.accent : 'var(--color-line)'}
                  strokeWidth={i === 1 ? 1.3 : 1}
                />
                <text
                  x={stepX(i) + STEP_W / 2}
                  y={lane.y + 22}
                  textAnchor="middle"
                  fill={i === 1 ? lane.accent : 'var(--color-ink)'}
                  fontSize="10.5"
                  fontFamily="var(--font-mono)"
                >
                  {step.top}
                </text>
                <text
                  x={stepX(i) + STEP_W / 2}
                  y={lane.y + 38}
                  textAnchor="middle"
                  fill="var(--color-dim)"
                  fontSize="9"
                  fontFamily="var(--font-mono)"
                >
                  {step.bottom}
                </text>
                {i < lane.steps.length ? (
                  <line
                    x1={stepX(i) + STEP_W + 2}
                    x2={stepX(i) + STEP_W + GAP - 4}
                    y1={lane.y + BOX_H / 2}
                    y2={lane.y + BOX_H / 2}
                    stroke="var(--color-line-strong)"
                    strokeWidth="1.2"
                    markerEnd="url(#ag-arrow)"
                  />
                ) : null}
              </g>
            ))}

            <rect
              x={stepX(4)}
              y={lane.y}
              width={STEP_W}
              height={BOX_H}
              rx="7"
              fill={`color-mix(in oklab, ${lane.outcome.color} 16%, transparent)`}
              stroke={lane.outcome.color}
              strokeWidth="1.3"
            />
            <text
              x={stepX(4) + STEP_W / 2}
              y={lane.y + 22}
              textAnchor="middle"
              fill={lane.outcome.color}
              fontSize="13"
              fontWeight="600"
              fontFamily="var(--font-mono)"
            >
              {lane.outcome.label}
            </text>
            <text
              x={stepX(4) + STEP_W / 2}
              y={lane.y + 38}
              textAnchor="middle"
              fill="var(--color-dim)"
              fontSize="9"
              fontFamily="var(--font-mono)"
            >
              {lane.outcome.sub}
            </text>
          </g>
        ))}

        <text
          x={X0}
          y={H - 8}
          fill="var(--color-dim)"
          fontSize="10.5"
          fontFamily="var(--font-mono)"
        >
          Same tool. Same production system. The difference is four lines of metadata.
        </text>
      </svg>
    </figure>
  );
};
