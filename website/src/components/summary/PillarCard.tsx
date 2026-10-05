import type { ReactNode } from 'react'

interface Props {
  badge: ReactNode
  title: string
  text: string
}

/** Card di uno dei due pilastri del gioco: badge a sinistra, testo a destra. */
export function PillarCard({ badge, title, text }: Props) {
  return (
    <article className="pillar reveal-card">
      {badge}
      <div className="min-w-0">
        <h3 className="pillar__title font-cinzel font-bold leading-tight text-osso">{title}</h3>
        <p className="pillar__text leading-[1.4] text-[#DCCFC2]">{text}</p>
      </div>
    </article>
  )
}
