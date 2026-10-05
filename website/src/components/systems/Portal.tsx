import { forwardRef } from 'react'
import type { SystemDef } from '../../data/systems'
import { useLang } from '../../i18n/LangContext'
import { SystemIcon } from '../icons/SystemIcon'
import { Picture } from '../Picture'
import { Orbit } from './Orbit'

/**
 * Portale circolare con il personaggio: simbolo gigante al 18% dietro, orbita tratteggiata,
 * effetto firma del sistema. Il ref punta al cerchio (target della View Transition dal tile).
 */
export const Portal = forwardRef<HTMLDivElement, { system: SystemDef }>(function Portal({ system }, ref) {
  const { id } = system
  const { t } = useLang()
  return (
    <div className="portal-area">
      <SystemIcon system={id} className="portal-giant" strokeWidth={0.9} size="104%" />

      <svg className="orbit-ring" viewBox="0 0 330 330" aria-hidden="true">
        <circle className="orbit-ring__path" cx="165" cy="165" r="164.5" />
      </svg>

      {id === 'imm' && <div className="shockwave" aria-hidden="true" />}

      <div className="portal-pop">
        <div ref={ref} className="portal">
          <Picture
            name={`portrait-${id}`}
            widths={[236, 472]}
            sizes="236px"
            alt={t.systems.portraitAlt(system.fullName)}
          />
        </div>
      </div>

      <Orbit system={id} />
    </div>
  )
})
