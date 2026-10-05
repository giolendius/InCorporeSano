import { useLang } from '../../i18n/LangContext'
import { AsymmetryBadge } from './AsymmetryBadge'
import { CoopBadge } from './CoopBadge'
import { Dilemma } from './Dilemma'
import { PillarCard } from './PillarCard'

interface Props {
  onSelectSystem: (index: number, iconEl: HTMLElement) => void
}

/**
 * Contenuto della Slide 2, dentro il pannello a schermo pieno (`.screen2-layer`).
 * Kicker, headline e card (`.reveal-line` / `.reveal-card`) le accende la timeline del tuffo,
 * così a fine tuffo la slide è completa e non serve scorrere.
 * `.summary__inner` è il blocco che il carosello trasla, se su finestre molto basse sborda.
 */
export function Summary({ onSelectSystem }: Props) {
  const { t } = useLang()
  const s = t.summary
  return (
    <section id="il-gioco" className="summary" aria-labelledby="summary-title">
      <div className="summary__inner">
        <p className="reveal-line summary__kicker font-extrabold text-brace">{s.kicker}</p>
        <h2 id="summary-title" className="summary__headline font-cinzel font-bold text-osso">
          <span className="reveal-line block">{s.headline[0]}</span>
          <span className="reveal-line block">{s.headline[1]}</span>
        </h2>

        <div className="summary__pillars">
          <PillarCard badge={<CoopBadge />} title={s.coop.title} text={s.coop.text} />
          <PillarCard badge={<AsymmetryBadge onSelect={onSelectSystem} />} title={s.asym.title} text={s.asym.text} />
        </div>

        <Dilemma />
      </div>
    </section>
  )
}
