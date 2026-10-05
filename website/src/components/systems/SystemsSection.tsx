import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type TouchEvent,
} from 'react'
import { flushSync } from 'react-dom'
import {
  DURATA_ALLINEAMENTO,
  DURATA_CAMBIO,
  PAUSA_DOPO_CAMBIO,
  SCROLL_PER_CAMBIARE_SISTEMA,
  SCROLL_PER_ENTRARE,
  SWIPE_PER_CAMBIARE_SISTEMA,
} from '../../config/navigation'
import { SYSTEMS } from '../../data/systems'
import { useLang, useSystems } from '../../i18n/LangContext'
import { gsap, prefersReducedMotion, ScrollTrigger, useGSAP } from '../../lib/gsap'
import { SystemPanel } from './SystemPanel'
import { SystemNav } from './SystemNav'

const N = SYSTEMS.length
/**
 * Diapositive del carosello: -1 è la Slide 2 (il riassunto), 0…3 sono i sistemi.
 * Ogni slide occupa esattamente uno schermo e un gesto ne vale una: non si resta mai a metà.
 */
const SUMMARY = -1
/** Sotto questo sforamento (px) non vale la pena sdoppiare la Slide 2 in due posizioni. */
const MIN_OVERFLOW = 24
/** Oltre questa pausa gli eventi contano come un gesto nuovo e l'accumulo riparte da zero. */
const GESTURE_GAP_MS = 400
/** Margine di uscita, in px: stacca abbastanza da non essere ripresi subito dal magnetismo. */
const EXIT_MARGIN = 28

export interface SystemsHandle {
  /** Ingresso dal simbolo dell'Asimmetria (screen 2): elemento condiviso simbolo → portale. */
  enterFrom: (index: number, iconEl: HTMLElement) => void
}

type ChangeMode = 'wipe' | 'instant'

interface ViewTransitionDoc {
  startViewTransition?: (cb: () => void) => { finished: Promise<void> }
}

/** Px di scroll equivalenti a un evento rotella, qualunque sia l'unità del browser. */
const wheelPx = (e: WheelEvent) =>
  e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY

/**
 * Il carosello delle diapositive: Slide 2 (il riassunto, che vive nella stage del tuffo) e i 4
 * pannelli dei sistemi, sovrapposti in una sezione alta un solo schermo.
 *
 * Quando una slide è in posizione lo scroll si blocca su di essa, e ogni gesto ne vale una sola:
 * la vista è sempre su una slide intera. La resistenza si regola in src/config/navigation.ts.
 */
export const SystemsSection = forwardRef<SystemsHandle>(function SystemsSection(_props, ref) {
  const section = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const panels = useRef<(HTMLDivElement | null)[]>([])
  const portals = useRef<(HTMLDivElement | null)[]>([])
  const navButtons = useRef<(HTMLButtonElement | null)[]>([])
  const running = useRef<gsap.core.Timeline | null>(null)

  const { t } = useLang()
  const systems = useSystems()
  const [active, setActive] = useState(0)
  const activeRef = useRef(0) // ultimo indice richiesto (anche prima del render)
  const shownRef = useRef(0) // indice effettivamente a video
  const modeRef = useRef<ChangeMode>('wipe')

  const slot = useRef<number | null>(null) // slide bloccata; null = scroll libero
  const sub = useRef(0) // posizione dentro la Slide 2: 0 = alto, 1 = fondo (solo se sborda)
  const locked = useRef(false) // lo scroll è nostro: i gesti muovono il carosello
  const busy = useRef(false) // spostamento tra pagine in corso
  const animating = useRef(false) // transizione tra due sistemi in corso
  const acc = useRef(0) // scroll accumulato nel gesto corrente
  const lastEvent = useRef(0)

  const change = (index: number, mode: ChangeMode = 'wipe') => {
    if (index === activeRef.current) return
    activeRef.current = index
    modeRef.current = mode
    setActive(index)
  }

  const sectionTop = () => {
    const el = section.current
    return el ? el.getBoundingClientRect().top + window.scrollY : 0
  }
  const sectionHeight = () => section.current?.offsetHeight ?? window.innerHeight

  /** Dove si ferma il riassunto: la fine del tuffo, cioè il punto in cui lo screen 2 è composto. */
  const summaryAnchor = () => {
    const dive = document.getElementById('dive')
    const top = dive ? dive.getBoundingClientRect().top + window.scrollY : 0
    return top + window.innerHeight
  }

  const setLockClasses = (scrollLocked: boolean, page: number | null) => {
    const c = document.documentElement.classList
    c.toggle('is-locked', scrollLocked)
    c.toggle('is-systems-locked', page !== null && page >= 0)
    // Slide 2 attiva: riabilito i click sul layer (i simboli dell'Asimmetria sono tappabili).
    c.toggle('is-slide2', page === SUMMARY)
  }

  // ---------- Slide 2: quanto sborda e come si raggiunge il suo fondo ----------
  /** Lo sforamento del contenuto della Slide 2 oltre il pannello, su finestre troppo basse. */
  const summaryOverflow = () => {
    const box = document.querySelector<HTMLElement>('.summary')
    return box ? Math.max(0, box.scrollHeight - box.clientHeight) : 0
  }
  const summaryHasBottom = () => summaryOverflow() > MIN_OVERFLOW
  /** Porta il contenuto della Slide 2 in alto (0) o al suo fondo (1), traslandolo. */
  const setSub = (next: 0 | 1, instant = false) => {
    const over = summaryOverflow()
    const target = over > MIN_OVERFLOW ? next : 0
    sub.current = target
    const inner = document.querySelector<HTMLElement>('.summary__inner')
    if (!inner) return
    gsap.to(inner, {
      y: target ? -over : 0,
      duration: instant || prefersReducedMotion() ? 0 : DURATA_ALLINEAMENTO,
      ease: 'power2.inOut',
      overwrite: true,
    })
  }

  /**
   * Porta la slide indicata a schermo pieno e blocca lo scroll su di essa.
   * Durante il movimento i gesti sono assorbiti (busy): la rotella non deve fare
   * tiro alla corda con l'animazione, altrimenti si vedono gli scatti.
   *
   * `atBottom` vale solo per la Slide 2: risalendo dal circolatorio si rientra dal suo fondo,
   * cioè dove si era rimasti.
   */
  const alignTo = (page: number, opts: { instant?: boolean; atBottom?: boolean } = {}) => {
    if (busy.current) return
    busy.current = true
    acc.current = 0
    locked.current = false
    // La stage torna in flusso: se restasse fissa, lo scorrimento non si vedrebbe.
    setLockClasses(true, null)
    const isSystem = page >= 0
    const replay = isSystem && page === activeRef.current // nessun wipe: rianimo il pannello
    if (isSystem) change(page)
    const quick = opts.instant || prefersReducedMotion()
    if (!isSystem) setSub(opts.atBottom ? 1 : 0, quick)
    gsap.to(window, {
      scrollTo: { y: isSystem ? sectionTop() : summaryAnchor(), autoKill: false },
      duration: quick ? 0 : DURATA_ALLINEAMENTO,
      ease: 'power2.inOut',
      overwrite: 'auto',
      onComplete: () => {
        busy.current = false
        slot.current = page
        locked.current = true
        setLockClasses(true, page)
        const panel = isSystem ? panels.current[page] : null
        if (replay && panel && !quick) contentIntro(gsap.timeline(), panel, null, page, 0)
      },
    })
  }

  /**
   * Esce dal carosello e restituisce lo scroll libero: in alto si riavvolge il tuffo a mano,
   * in basso si arriva sulla CTA.
   */
  const release = (dir: -1 | 1) => {
    if (busy.current) return
    busy.current = true
    locked.current = false
    slot.current = null
    setLockClasses(false, null)
    acc.current = 0
    const target = dir < 0 ? summaryAnchor() - EXIT_MARGIN : sectionTop() + sectionHeight() + EXIT_MARGIN
    const quick = prefersReducedMotion()
    gsap.to(window, {
      scrollTo: { y: Math.max(0, target), autoKill: false },
      duration: quick ? 0 : DURATA_ALLINEAMENTO,
      ease: 'power2.inOut',
      overwrite: 'auto',
      // Piccola pausa: il magnetismo non deve riprendermi subito.
      onComplete: () => gsap.delayedCall(0.2, () => (busy.current = false)),
    })
  }

  const settleDelay = () => (prefersReducedMotion() ? 0.25 : DURATA_CAMBIO + PAUSA_DOPO_CAMBIO)

  /** Un passo del carosello: una slide per gesto, in entrambi i versi. */
  const step = (dir: 1 | -1) => {
    if (busy.current || animating.current) return
    const cur = slot.current
    if (cur === null) return

    // Slide 2: se il contenuto sborda ha due posizioni, alto e fondo.
    if (cur === SUMMARY) {
      if (dir > 0) {
        if (sub.current === 0 && summaryHasBottom()) {
          animating.current = true
          setSub(1)
          gsap.delayedCall(settleDelay(), () => (animating.current = false))
          return
        }
        alignTo(0)
      } else if (sub.current === 1) {
        animating.current = true
        setSub(0)
        gsap.delayedCall(settleDelay(), () => (animating.current = false))
      } else {
        release(-1)
      }
      return
    }

    const next = cur + dir
    if (next > N - 1) {
      release(1)
      return
    }
    // Dal circolatorio verso l'alto si torna sulla Slide 2, dal suo fondo.
    if (next < 0) {
      alignTo(SUMMARY, { atBottom: true })
      return
    }
    // Tra due sistemi lo scroll non si muove: cambia solo il pannello (wipe).
    animating.current = true
    slot.current = next
    change(next)
    gsap.delayedCall(settleDelay(), () => (animating.current = false))
  }

  /** Salto diretto dalla nav a pill. */
  const goTo = (index: number) => {
    if (animating.current || busy.current) return
    const i = Math.max(0, Math.min(N - 1, index))
    if (slot.current === i) return
    if (slot.current === null || slot.current === SUMMARY) {
      alignTo(i)
      return
    }
    animating.current = true
    slot.current = i
    change(i)
    gsap.delayedCall(settleDelay(), () => (animating.current = false))
  }

  // ---------- Magnetismo: quando una slide è in posizione, la pagina si ferma lì ----------
  useGSAP(
    () => {
      ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: (self) => {
          if (locked.current || busy.current) return
          const el = section.current
          if (!el) return
          const vh = window.innerHeight
          const r = el.getBoundingClientRect()
          // Scendendo dal tuffo si atterra sulla Slide 2: ha la precedenza, altrimenti un
          // colpo di rotella ampio la scavalcherebbe andando diritto sul circolatorio.
          if (r.top > 0) {
            if (window.scrollY >= summaryAnchor() - 1) alignTo(SUMMARY)
            return
          }
          // I sistemi coprono lo schermo dall'alto: risalita dalla CTA o pagina ricaricata qui.
          const covered = Math.min(r.bottom, vh) - Math.max(r.top, 0)
          if (covered > vh * SCROLL_PER_ENTRARE) alignTo(self.direction < 0 ? N - 1 : activeRef.current)
        },
      })
    },
    { scope: stage },
  )

  // ---------- Gesti: rotella, dito, tastiera ----------
  useEffect(() => {
    const wheelStep = () => window.innerHeight * SCROLL_PER_CAMBIARE_SISTEMA
    const swipeStep = () => window.innerHeight * SWIPE_PER_CAMBIARE_SISTEMA

    const onWheel = (e: WheelEvent) => {
      if (!locked.current && !busy.current) return
      e.preventDefault()
      if (e.timeStamp - lastEvent.current > GESTURE_GAP_MS) acc.current = 0
      lastEvent.current = e.timeStamp
      if (animating.current || busy.current) return
      acc.current += wheelPx(e)
      if (Math.abs(acc.current) < wheelStep()) return
      const dir = acc.current > 0 ? 1 : -1
      acc.current = 0
      step(dir)
    }

    let dragFrom = 0
    let dragging = false
    const onTouchStart = (e: globalThis.TouchEvent) => {
      if ((!locked.current && !busy.current) || e.touches.length > 1) return
      dragFrom = e.touches[0].clientY
      dragging = true
    }
    const onTouchMove = (e: globalThis.TouchEvent) => {
      if ((!locked.current && !busy.current) || !dragging) return
      if (e.touches.length > 1) {
        dragging = false // due dita: lascio lo zoom al browser
        return
      }
      if (e.cancelable) e.preventDefault()
      if (animating.current || busy.current) return
      const dy = dragFrom - e.touches[0].clientY // > 0: dito verso l'alto = avanti
      if (Math.abs(dy) < swipeStep()) return
      dragFrom = e.touches[0].clientY
      step(dy > 0 ? 1 : -1)
    }
    const onTouchEnd = () => (dragging = false)

    const onKey = (e: KeyboardEvent) => {
      if (!locked.current) return
      if ((e.target as HTMLElement | null)?.closest('button, a, input, textarea, select')) return
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault()
        step(1)
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault()
        step(-1)
      } else if (e.key === 'End') {
        e.preventDefault()
        release(1)
      } else if (e.key === 'Home') {
        e.preventDefault()
        release(-1)
      }
    }

    /** Rete di sicurezza: se lo scroll scappa da fonti che non intercettiamo, riallinea. */
    const onScroll = () => {
      if (!locked.current || busy.current || slot.current === null) return
      const target = slot.current >= 0 ? sectionTop() : summaryAnchor()
      if (Math.abs(window.scrollY - target) > 2) window.scrollTo(0, target)
    }
    const onRefresh = () => {
      if (!locked.current || slot.current === null) return
      window.scrollTo(0, slot.current >= 0 ? sectionTop() : summaryAnchor())
      // Cambiando dimensioni lo sforamento della Slide 2 cambia: ricalcolo la traslazione.
      if (slot.current === SUMMARY) setSub(sub.current as 0 | 1, true)
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchcancel', onTouchEnd, { passive: true })
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, { passive: true })
    ScrollTrigger.addEventListener('refresh', onRefresh)

    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll)
      ScrollTrigger.removeEventListener('refresh', onRefresh)
      setLockClasses(false, null)
    }
  }, [])

  // Stato iniziale: solo il primo pannello visibile.
  useLayoutEffect(() => {
    panels.current.forEach((p, i) => {
      if (!p) return
      p.style.visibility = i === 0 ? 'visible' : 'hidden'
      p.style.zIndex = i === 0 ? '2' : '0'
    })
  }, [])

  // ---------- Cambio di sistema ----------
  useLayoutEffect(() => {
    const next = active
    const prev = shownRef.current
    if (next === prev) return
    shownRef.current = next

    running.current?.progress(1).kill()

    const els = panels.current
    const panel = els[next]
    const prevPanel = els[prev]
    if (!panel) return

    els.forEach((p, i) => {
      if (!p) return
      p.style.visibility = i === next || i === prev ? 'visible' : 'hidden'
      p.style.zIndex = i === next ? '2' : i === prev ? '1' : '0'
    })

    const hidePrev = () => {
      if (prevPanel && shownRef.current !== prev) prevPanel.style.visibility = 'hidden'
      gsap.set(panel, { clearProps: 'clipPath,opacity' })
    }
    const tl = gsap.timeline({ onComplete: hidePrev })
    running.current = tl

    if (modeRef.current === 'instant') {
      // La View Transition (o il FLIP) fa già il lavoro visivo: stato finale subito, poi solo i gettoni.
      const q = gsap.utils.selector(panel)
      gsap.set(q('.orbit-sym, .portal-pop'), { scale: 1 })
      gsap.set(q('.sys-title'), { x: 0, opacity: 1 })
      hidePrev()
      if (!prefersReducedMotion()) fillReserve(tl, panel, next, 0.35)
      return
    }

    if (prefersReducedMotion()) {
      tl.fromTo(panel, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'none' })
      return
    }

    const { x, y } = originOf(next)
    tl.fromTo(
      panel,
      { clipPath: `circle(0% at ${x}px ${y}px)` },
      { clipPath: `circle(150% at ${x}px ${y}px)`, duration: DURATA_CAMBIO, ease: 'wipe' },
      0,
    )
    contentIntro(tl, panel, prevPanel, next, 0)
  }, [active])

  /** Centro dell'icona della nav del sistema, relativo alla stage: origine del cerchio. */
  const originOf = (index: number) => {
    const btn = navButtons.current[index]
    const st = stage.current
    if (!btn || !st) return { x: window.innerWidth / 2, y: window.innerHeight }
    const b = btn.getBoundingClientRect()
    const s = st.getBoundingClientRect()
    return { x: b.left + b.width / 2 - s.left, y: b.top + b.height / 2 - s.top }
  }

  // ---------- Ingresso dal simbolo dell'Asimmetria (screen 2 → sistema) ----------
  useImperativeHandle(ref, () => ({
    enterFrom(index, iconEl) {
      const apply = () => {
        flushSync(() => change(index, 'instant'))
        busy.current = false
        window.scrollTo(0, sectionTop())
        slot.current = index
        locked.current = true
        setLockClasses(true, index)
        ScrollTrigger.update()
      }
      const doc = document as unknown as ViewTransitionDoc
      const reduced = prefersReducedMotion()

      if (doc.startViewTransition) {
        // Con reduced motion niente elemento condiviso: resta il crossfade di root (200ms via CSS).
        if (!reduced) iconEl.style.setProperty('view-transition-name', 'portal')
        const vt = doc.startViewTransition(() => {
          iconEl.style.removeProperty('view-transition-name')
          apply()
          if (!reduced) portals.current[index]?.style.setProperty('view-transition-name', 'portal')
        })
        vt.finished.finally(() => portals.current[index]?.style.removeProperty('view-transition-name'))
        return
      }

      if (reduced) {
        apply()
        return
      }
      flipFallback(index, iconEl, apply)
    },
  }))

  /** Fallback FLIP: un cerchio fantasma vola dal simbolo al portale mentre il fondo fa crossfade. */
  const flipFallback = (index: number, iconEl: HTMLElement, apply: () => void) => {
    const from = iconEl.getBoundingClientRect()
    apply()
    const portal = portals.current[index]
    const panel = panels.current[index]
    if (!portal || !panel) return
    const to = portal.getBoundingClientRect()

    const ghost = document.createElement('div')
    ghost.className = 'flip-ghost'
    ghost.dataset.system = SYSTEMS[index].id
    Object.assign(ghost.style, {
      left: `${from.left}px`,
      top: `${from.top}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
    })
    document.body.appendChild(ghost)

    gsap.set(portal, { opacity: 0 })
    gsap.fromTo(panel, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'none', clearProps: 'opacity' })
    gsap.to(ghost, {
      left: to.left,
      top: to.top,
      width: to.width,
      height: to.height,
      duration: 0.5,
      ease: 'wipe',
      onComplete: () => {
        gsap.to(portal, { opacity: 1, duration: 0.15, clearProps: 'opacity' })
        gsap.to(ghost, { opacity: 0, duration: 0.2, onComplete: () => ghost.remove() })
      },
    })
  }

  // ---------- Swipe orizzontale: un sistema per gesto ----------
  const touch = useRef<{ x: number; y: number } | null>(null)
  const onStageTouchStart = (e: TouchEvent) => {
    const p = e.touches[0]
    touch.current = { x: p.clientX, y: p.clientY }
  }
  const onStageTouchEnd = (e: TouchEvent) => {
    const start = touch.current
    touch.current = null
    if (!start) return
    const p = e.changedTouches[0]
    const dx = p.clientX - start.x
    const dy = p.clientY - start.y
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) step(dx < 0 ? 1 : -1)
  }

  return (
    <section id="sistemi" ref={section} className="systems-section" aria-label={t.systems.sectionLabel}>
      <div ref={stage} className="systems-stage" onTouchStart={onStageTouchStart} onTouchEnd={onStageTouchEnd}>
        {systems.map((s, i) => (
          <SystemPanel
            key={s.id}
            ref={(el) => (panels.current[i] = el)}
            portalRef={(el) => (portals.current[i] = el)}
            system={s}
            index={i}
            active={i === active}
          />
        ))}
        <SystemNav active={active} onSelect={goTo} buttonRefs={navButtons} />
      </div>
    </section>
  )
})

/**
 * Sequenza dopo il wipe: titolo da destra, portale con overshoot, simboli dell'orbita
 * (vecchi che collassano, nuovi con stagger), gettoni della Riserva.
 */
function contentIntro(
  tl: gsap.core.Timeline,
  panel: HTMLElement,
  prevPanel: HTMLElement | null | undefined,
  index: number,
  at: number,
) {
  const q = gsap.utils.selector(panel)
  if (prevPanel) {
    tl.to(prevPanel.querySelectorAll('.orbit-sym'), { scale: 0, duration: 0.25, stagger: 0.03, ease: 'power2.in' }, at)
  }
  tl.fromTo(q('.sys-title'), { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, ease: 'power2.out' }, at + 0.15)
    .fromTo(q('.portal-pop'), { scale: 0.8 }, { scale: 1, duration: 0.7, ease: 'back.out(2.2)' }, at + 0.1)
    .fromTo(q('.orbit-sym'), { scale: 0 }, { scale: 1, duration: 0.45, stagger: 0.07, ease: 'back.out(2)' }, at + 0.3)
  fillReserve(tl, panel, index, at + 0.4)
}

/** Gettoni: nel Digerente cadono nel box come dadi, negli altri si riempiono uno alla volta. */
function fillReserve(tl: gsap.core.Timeline, panel: HTMLElement, index: number, at: number) {
  const q = gsap.utils.selector(panel)
  if (SYSTEMS[index].id === 'dig') {
    tl.fromTo(
      q('.token'),
      { y: -30, opacity: 0 },
      {
        y: 0,
        opacity: (_i: number, el: Element) => (el.classList.contains('is-empty') ? 0.22 : 1),
        duration: 0.6,
        stagger: 0.06,
        ease: 'bounce.out',
      },
      at,
    )
  } else {
    tl.fromTo(q('.token:not(.is-empty)'), { opacity: 0.22 }, { opacity: 1, duration: 0.25, stagger: 0.12 }, at)
  }
}
