import { useEffect, useLayoutEffect, useRef } from 'react'
import { CORSA_RIASSUNTO } from './config/navigation'
import { ScrollTrigger } from './lib/gsap'
import { LangProvider } from './i18n/LangContext'
import { Dive } from './components/Dive'
import { SystemsSection, type SystemsHandle } from './components/systems/SystemsSection'
import { FinalCta } from './components/FinalCta'
import { LangSwitch } from './components/LangSwitch'

export default function App() {
  const systems = useRef<SystemsHandle>(null)

  // La corsa libera sullo screen 2 e' configurata in navigation.ts: la passo al CSS.
  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--corsa-riassunto', `${CORSA_RIASSUNTO * 100}svh`)
  }, [])

  // Font e immagini cambiano le altezze: ricalcola pin e trigger quando sono pronti.
  useEffect(() => {
    document.fonts?.ready.then(() => ScrollTrigger.refresh())
    const onLoad = () => ScrollTrigger.refresh()
    window.addEventListener('load', onLoad)
    return () => window.removeEventListener('load', onLoad)
  }, [])

  return (
    <LangProvider>
      <main>
        <Dive onSelectSystem={(i, icon) => systems.current?.enterFrom(i, icon)} />
        <SystemsSection ref={systems} />
        <FinalCta />
      </main>
      <LangSwitch />
    </LangProvider>
  )
}
