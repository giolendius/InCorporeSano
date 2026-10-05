import { Fragment, useRef } from 'react'
import { useLang } from '../../i18n/LangContext'
import { gsap, MOTION_OK, useGSAP } from '../../lib/gsap'

/**
 * Frase-dilemma. Legata allo scroll: le parole si accendono una alla volta, le due evidenziazioni
 * per ultime con un flash di glow, e la linea verticale cresce insieme al testo.
 * Senza animazioni resta testo pieno.
 */
export function Dilemma() {
  const root = useRef<HTMLQuoteElement>(null)
  const { lang, t } = useLang()
  const segments = t.summary.dilemma

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MOTION_OK, () => {
        const q = gsap.utils.selector(root)
        const plain = q('.dw:not(.dw--hl)')
        const highlights = q('.dilemma__hl')
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          /* Agganciata allo stesso scroll del tuffo (.dive-stage): così la frase è accesa
             esattamente quando lo screen 2 è composto, su qualunque altezza di schermo.
             Legarla alla propria posizione non basta: dopo lo screen 2 scatta il magnetismo
             dei sistemi e non resterebbe scroll per finire di accenderla. */
          scrollTrigger: {
            trigger: '.dive-stage',
            start: 'top top',
            end: () => `+=${window.innerHeight}`,
            scrub: 0.3,
            refreshPriority: -1,
          },
        })
        // Ultimo 18% del tuffo: la frase si accende riga dopo riga mentre lo screen 2 si compone.
        tl.fromTo(q('.dilemma__line'), { scaleY: 0 }, { scaleY: 1, duration: 0.17 }, 0.82)
          .fromTo(plain, { opacity: 0.2 }, { opacity: 1, duration: 0.02, stagger: 0.011 }, 0.82)
          .fromTo(q('.dw--hl'), { opacity: 0.2 }, { opacity: 1, duration: 0.015, stagger: 0.005 }, 0.945)
          .call(
            () => {
              highlights.forEach((el) => {
                el.classList.remove('is-flash')
                void (el as HTMLElement).offsetWidth // riavvia l'animazione
                el.classList.add('is-flash')
              })
            },
            undefined,
            0.995,
          )
      })
      return () => mm.revert()
    },
    // Le parole cambiano con la lingua: timeline ricostruita sui nuovi span.
    { scope: root, dependencies: [lang], revertOnUpdate: true },
  )

  return (
    <blockquote ref={root} className="dilemma">
      <span className="dilemma__line" aria-hidden="true" />
      <p key={lang}>
        {segments.map((seg, i) => {
          const words = seg.text.trim().split(' ')
          const lead = i > 0 && !seg.text.startsWith(',') ? ' ' : ''
          const content = words.map((w, k) => (
            <Fragment key={k}>
              {k > 0 && ' '}
              <span className={`dw ${seg.tone ? 'dw--hl' : ''}`}>{w}</span>
            </Fragment>
          ))
          return (
            <Fragment key={i}>
              {lead}
              {seg.tone ? <strong className={`dilemma__hl dilemma__hl--${seg.tone}`}>{content}</strong> : content}
            </Fragment>
          )
        })}
      </p>
    </blockquote>
  )
}
