import { useEffect, useRef } from 'react'
import { ScrollTrigger } from './lib/gsap'
import { LangProvider } from './i18n/LangContext'
import { Dive } from './components/Dive'
import { SystemsSection, type SystemsHandle } from './components/systems/SystemsSection'
import { FinalCta } from './components/FinalCta'
import { LangSwitch } from './components/LangSwitch'

export default function App() {
  const systems = useRef<SystemsHandle>(null)

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
