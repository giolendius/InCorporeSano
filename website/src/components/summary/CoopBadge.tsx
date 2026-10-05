import type { CSSProperties } from 'react'
import { SYSTEM_COLORS, type SystemId } from '../../data/systems'

/** Nodi a rombo. Coordinate nel box 72×72 del disegno, usate anche in percentuale. */
const NODES: { id: SystemId; x: number; y: number }[] = [
  { id: 'circ', x: 36, y: 12 },
  { id: 'dig', x: 60, y: 36 },
  { id: 'imm', x: 36, y: 60 },
  { id: 'ner', x: 12, y: 36 },
]

const LINES = NODES.flatMap((a, i) => NODES.slice(i + 1).map((b) => ({ a, b })))
const LOOP = 'M36 12 L60 36 L36 60 L12 36 Z'
const PULSE_S = 2.4
/** Il badge si rimpicciolisce sugli schermi bassi: i nodi vanno in percentuale per seguirlo. */
const pct = (v: number) => `${(v / 72) * 100}%`

/** Badge "Cooperazione": i 4 sistemi collegati tra loro attorno al corpo, che batte al centro. */
export function CoopBadge() {
  return (
    <div className="badge coop" aria-hidden="true">
      <svg className="coop__lines" viewBox="0 0 72 72">
        {LINES.map(({ a, b }) => (
          <line key={`${a.id}-${b.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
        ))}
        <path className="coop__pulse-glow" d={LOOP} pathLength={100} />
        <path className="coop__pulse" d={LOOP} pathLength={100} />
      </svg>
      {NODES.map((n, k) => (
        <span
          key={n.id}
          className="coop__node"
          style={
            {
              left: pct(n.x),
              top: pct(n.y),
              '--c': SYSTEM_COLORS[n.id],
              '--flash-delay': `${(k * PULSE_S) / NODES.length}s`,
            } as CSSProperties
          }
        />
      ))}
      <span
        className="coop__node coop__node--core"
        style={{ left: '50%', top: '50%', '--c': '#D7263D' } as CSSProperties}
      />
    </div>
  )
}
