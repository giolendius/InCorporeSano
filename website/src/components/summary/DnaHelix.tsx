import { useEffect, useRef } from 'react'
import { SYSTEMS, SYSTEM_COLORS } from '../../data/systems'
import { prefersReducedMotion } from '../../lib/gsap'

/** Altezza di riferimento del disegno (mockup): tutte le misure sotto sono tarate su questa. */
const BOX_H = 250
const AMP = 52
const WAVE = 150
const RUNG_STEP = 17
const SEG = 3
const TILT = (-14 * Math.PI) / 180
const SHIFT_X = -40
const PERIOD = 6 // s per 2π
const BEAT = 0.833 // s, come --beat
const STATIC_PHASE = 0.6
const STRANDS = [
  { color: '#D7263D', offset: 0 },
  { color: '#FF7A3D', offset: Math.PI },
] as const
const RUNG_COLORS = SYSTEMS.map((s) => SYSTEM_COLORS[s.id])

const bandLength = (w: number) => (w >= 900 ? Math.min(w + 80, 1000) : 470)
/** −14° come da spec; sulle fasce lunghe (desktop) l'inclinazione si riduce per restare nel box. */
const tiltFor = (length: number, h: number) => Math.max(TILT, -Math.atan((h / 2 - (AMP * h) / BOX_H - 10) / (length / 2)))

/**
 * `h` è l'altezza reale della fascia: su schermi bassi è più corta di BOX_H, quindi tutto il
 * disegno (ampiezza, lunghezza d'onda, passo dei pioli, spessori) viene scalato di `k`.
 */
function draw(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, phase: number, beat: number) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  ctx.save()
  const k = h / BOX_H
  const amp = AMP * k
  const wave = WAVE * k
  const rungStep = RUNG_STEP * k
  const K = (Math.PI * 2) / wave
  const length = bandLength(w)
  const half = length / 2
  ctx.translate(w / 2 + SHIFT_X * k, h / 2)
  ctx.rotate(tiltFor(length, h))
  ctx.lineCap = 'round'

  // Filamenti: prima i tratti "dietro" (z < 0), poi i pioli, poi i tratti "davanti".
  const strandPass = (front: boolean) => {
    for (const s of STRANDS) {
      ctx.strokeStyle = s.color
      for (let x = -half; x < half; x += SEG) {
        const f = K * x + phase + s.offset
        const z = Math.cos(f)
        if ((z >= 0) !== front) continue
        ctx.globalAlpha = 0.45 + 0.55 * ((z + 1) / 2)
        ctx.lineWidth = (4 + 3.5 * z) * k
        ctx.beginPath()
        ctx.moveTo(x, amp * Math.sin(f))
        ctx.lineTo(x + SEG, amp * Math.sin(K * (x + SEG) + phase + s.offset))
        ctx.stroke()
      }
    }
  }

  strandPass(false)

  // Pioli: coppia di basi, metà col colore del sistema i e metà con i+1.
  ctx.lineWidth = 4 * k
  let j = 0
  for (let x = -half + rungStep / 2; x < half; x += rungStep, j++) {
    const f = K * x + phase
    const yA = amp * Math.sin(f)
    ctx.globalAlpha = Math.min(1, (0.25 + 0.75 * Math.abs(Math.sin(f))) * beat)
    ctx.strokeStyle = RUNG_COLORS[j % 4]
    ctx.beginPath()
    ctx.moveTo(x, yA)
    ctx.lineTo(x, 0)
    ctx.stroke()
    ctx.strokeStyle = RUNG_COLORS[(j + 1) % 4]
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, -yA)
    ctx.stroke()
  }

  strandPass(true)
  ctx.restore()
  ctx.globalAlpha = 1
}

/**
 * Elica di DNA dello screen 2 (Canvas 2D). I pioli nei 4 colori dei sistemi: il "codice" del corpo.
 * Ruota in continuo (2π / 6s), accelera fino a 3× con la velocità di scroll, pausa fuori viewport.
 */
export function DnaHelix() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const layer = canvas.closest<HTMLElement>('.screen2-layer')
    const reduced = prefersReducedMotion()

    let w = 0
    let h = BOX_H
    let dpr = 1
    let phase = STATIC_PHASE
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2.5)
      w = canvas.clientWidth
      h = canvas.clientHeight || BOX_H
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      draw(ctx, w, h, dpr, phase, 1)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    if (reduced) return () => ro.disconnect()

    let raf = 0
    let last = 0
    let lastScroll = window.scrollY
    let speed = 1
    let clock = 0

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0
      last = now
      const y = window.scrollY
      const v = Math.abs(y - lastScroll)
      lastScroll = y
      speed += (1 + Math.min(2, v / 20) - speed) * 0.08
      phase += dt * ((Math.PI * 2) / PERIOD) * speed
      clock += dt
      // Durante l'hero il layer è trasparente: niente draw.
      if (layer && parseFloat(layer.style.opacity || '1') < 0.01) return
      const t = clock % BEAT
      draw(ctx, w, h, dpr, phase, 1 + 0.15 * Math.exp(-t / 0.12))
    }

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !raf) {
        last = 0
        raf = requestAnimationFrame(loop)
      } else if (!entry.isIntersecting && raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
    })
    io.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
    }
  }, [])

  return <canvas ref={ref} className="dna__canvas" aria-hidden="true" />
}
