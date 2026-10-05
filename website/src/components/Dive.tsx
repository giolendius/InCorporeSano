import { useCallback, useRef, type CSSProperties } from 'react'
import { gsap, MOTION_OK, REDUCED, ScrollTrigger, useGSAP } from '../lib/gsap'
import { useParallax } from '../hooks/useParallax'
import { Hero } from './hero/Hero'
import { DnaHelix } from './summary/DnaHelix'
import { Summary } from './summary/Summary'

interface Props {
  onSelectSystem: (index: number, iconEl: HTMLElement) => void
}

/**
 * Slide 1 → Slide 2, "tuffo nel vaso": la stage è pinnata per 100vh e la timeline è legata allo
 * scroll (scrub). Se l'utente si ferma, l'effetto si ferma.
 *
 * La Slide 2 è un pannello a schermo pieno dentro la stage (`.screen2-layer`), gemello dei pannelli
 * dei sistemi: il tuffo ci atterra sopra in dissolvenza e il blocco del carosello la tiene lì intera.
 */
export function Dive({ onSelectSystem }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const trigger = useRef<ScrollTrigger | null>(null)

  const parallaxRange = useCallback(() => window.innerHeight, [])
  useParallax(stage, parallaxRange)

  useGSAP(
    () => {
      const q = gsap.utils.selector(root)
      const mm = gsap.matchMedia()
      const pinEnd = () => `+=${window.innerHeight}`

      mm.add(MOTION_OK, () => {
        // Sequenza d'ingresso
        gsap
          .timeline({ defaults: { ease: 'power3.out' } })
          .from(q('.hero-bg'), { opacity: 0, duration: 0.8 })
          .from(q('.hero-enter-chars'), { y: 60, opacity: 0, duration: 1.1 }, 0.15)
          .from(q('.hero-cells, .hero-viruses'), { opacity: 0, duration: 1 }, 0.3)
          .from(q('.hero-enter-logo'), { y: -20, scale: 0.92, opacity: 0, duration: 0.9 }, 0.45)
          .fromTo(
            q('.hero-ecg path'),
            { strokeDasharray: 1, strokeDashoffset: 1 },
            { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' },
            0.85,
          )
          .from(q('.hero-copy > *'), { y: 16, opacity: 0, stagger: 0.12, duration: 0.6 }, 1.1)

        // Tuffo (progress 0 → 1 della timeline = 100vh di scroll)
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: stage.current,
            start: 'top top',
            end: pinEnd,
            pin: true,
            scrub: 0.4,
            invalidateOnRefresh: true,
          },
        })
        trigger.current = tl.scrollTrigger ?? null

        tl.fromTo(q('.hero-chars'), { scale: 1 }, { scale: 2.6, duration: 1 }, 0)
          .fromTo(
            q('.hero-logo, .hero-ecg'),
            { y: 0, opacity: 1, filter: 'blur(0px)' },
            { y: -40, opacity: 0, filter: 'blur(8px)', duration: 0.3 },
            0,
          )
          .fromTo(q('.hero-copy'), { y: 0, opacity: 1 }, { y: 30, opacity: 0, duration: 0.25 }, 0)
          .fromTo(q('.hero-viruses'), { scale: 1, opacity: 1 }, { scale: 1.5, opacity: 0, duration: 0.6 }, 0)
          .fromTo(
            q('.vignette'),
            { '--vig-w': '95%', '--vig-h': '80%' },
            { '--vig-w': '34%', '--vig-h': '26%', duration: 0.6 },
            0,
          )
          // Atterraggio sulla Slide 2: crossfade del fondo, l'elica si disegna da sinistra,
          // poi kicker, headline e card. Tutto dentro il tuffo: a fine pin la slide è completa.
          .fromTo(q('.screen2-layer'), { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.6)
          .fromTo(q('.dna'), { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.3 }, 0.7)
          .fromTo(
            q('.reveal-line'),
            { opacity: 0, y: 14 },
            { opacity: 1, y: 0, duration: 0.07, stagger: 0.04 },
            0.85,
          )
          .fromTo(
            q('.reveal-card'),
            { opacity: 0, y: 16 },
            { opacity: 1, y: 0, duration: 0.06, stagger: 0.035 },
            0.89,
          )

        return () => {
          trigger.current = null
        }
      })

      // Reduced motion: stessa struttura, ma crossfade da 200ms invece dello scrub.
      mm.add(REDUCED, () => {
        gsap.set(q('.screen2-layer, .reveal-line, .reveal-card'), { opacity: 0 })
        let inScreen2 = false
        trigger.current = ScrollTrigger.create({
          trigger: stage.current,
          start: 'top top',
          end: pinEnd,
          pin: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const on = self.progress > 0.5
            if (on === inScreen2) return
            inScreen2 = on
            gsap.to(q('.screen2-layer, .reveal-line, .reveal-card'), { opacity: on ? 1 : 0, duration: 0.2 })
            gsap.to(q('.hero-logo, .hero-ecg, .hero-copy'), { opacity: on ? 0 : 1, duration: 0.2 })
          },
        })
        return () => {
          trigger.current = null
        }
      })

      return () => mm.revert()
    },
    { scope: root },
  )

  const discover = () => {
    const st = trigger.current
    if (!st) return
    const reduced = window.matchMedia(REDUCED).matches
    gsap.to(window, { scrollTo: st.end, duration: reduced ? 0 : 1.6, ease: 'power2.inOut' })
  }

  return (
    <div id="dive" ref={root}>
      <div ref={stage} className="dive-stage">
        <Hero onDiscover={discover} />
        <div className="layer screen2-layer" style={{ opacity: 0 }}>
          <div className="screen2-bg" />
          <span
            className="rbc"
            style={{ right: -18, top: '7%', width: 46, height: 42, '--blur': '5px', '--op': 0.7 } as CSSProperties}
          />
          <span
            className="rbc"
            style={{ left: '62%', top: '35%', width: 26, height: 24, '--blur': '2.5px', '--op': 0.75 } as CSSProperties}
          />
          <div className="dna">
            <DnaHelix />
          </div>
          <Summary onSelectSystem={onSelectSystem} />
        </div>
      </div>
    </div>
  )
}
