import { SYSTEM_MAP_BOXES, SYSTEM_MAP_EDGES } from '@/constants/systemMap';

const W = 780;
const H = 424;

/** What runs where, and — the part that matters — where the credentials live. */
export const SystemMap = () => {
  return (
    <figure className="my-8">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="The UI talks to a server-side route handler, which talks to the TrueForge harness. The harness holds every credential and reaches the ops MCP server, subagents, and the sandbox. The UI and the MCP server hold none."
      >
        <title>sentinel-agent system map</title>
        <defs>
          <marker
            id="sm-arrow"
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

        {SYSTEM_MAP_EDGES.map((e) => (
          <g key={`${e.x1}-${e.y1}`}>
            <line
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              stroke="var(--color-line-strong)"
              strokeWidth="1.2"
              markerEnd="url(#sm-arrow)"
            />
            {e.label ? (
              <text
                x={e.x1 + 8}
                y={(e.y1 + e.y2) / 2 + 3}
                fill="var(--color-dim)"
                fontSize="9"
                fontFamily="var(--font-mono)"
              >
                {e.label}
              </text>
            ) : null}
          </g>
        ))}

        {SYSTEM_MAP_BOXES.map((b) => (
          <g key={b.title}>
            <rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx="9"
              fill={b.fill ?? 'var(--color-surface)'}
              stroke={b.accent ?? 'var(--color-line)'}
              strokeWidth={b.accent ? 1.3 : 1}
            />
            <text
              x={b.x + 14}
              y={b.y + 22}
              fill={b.accent ?? 'var(--color-ink)'}
              fontSize="11.5"
              fontFamily="var(--font-mono)"
              fontWeight="500"
            >
              {b.title}
            </text>
            {b.sub.map((s, i) => (
              <text
                key={s}
                x={b.x + 14}
                y={b.y + 39 + i * 13}
                fill="var(--color-dim)"
                fontSize="9.5"
                fontFamily="var(--font-mono)"
              >
                {s}
              </text>
            ))}
          </g>
        ))}

        <text
          x={40}
          y={H - 32}
          fill="var(--color-gate)"
          fontSize="10"
          fontFamily="var(--font-mono)"
        >
          Every credential lives inside the harness box.
        </text>
        <text x={40} y={H - 16} fill="var(--color-dim)" fontSize="10" fontFamily="var(--font-mono)">
          The UI holds none. The MCP server holds none. The sandbox holds none — its tool calls are
          bridged back out.
        </text>
      </svg>
    </figure>
  );
};
