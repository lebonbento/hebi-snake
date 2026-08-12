import { useEffect, useState } from 'react'

const DISMISSED_KEY = 'hebi-install-dismissed'

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // Safari iOS n'implémente toujours pas display-mode: standalone.
    window.navigator.standalone === true
  )
}

function isIOS() {
  const ua = navigator.userAgent
  // Un iPad récent se présente comme un Mac : le tactile le trahit.
  return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Encart d'installation, en bas de l'écran.
 * — Android / Chrome : vrai bouton, via l'événement beforeinstallprompt.
 * — iOS : Safari n'expose aucune API, on ne peut qu'expliquer le geste.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null)
  const [showIOSHint, setShowIOSHint] = useState(false)

  useEffect(() => {
    if (isStandalone() || wasDismissed()) return

    const onBeforeInstall = (e) => {
      // Sans ça, Chrome affiche sa propre bannière au lieu de nous laisser choisir.
      e.preventDefault()
      setDeferred(e)
    }
    const onInstalled = () => {
      setDeferred(null)
      setShowIOSHint(false)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    // Laisser le jeu s'installer à l'écran avant de proposer quoi que ce soit.
    const t = isIOS() ? setTimeout(() => setShowIOSHint(true), 4000) : null

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
      if (t) clearTimeout(t)
    }
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      /* navigation privée : tant pis, l'encart reviendra */
    }
    setDeferred(null)
    setShowIOSHint(false)
  }

  const install = async () => {
    if (!deferred) return
    deferred.prompt()
    await deferred.userChoice
    // L'événement n'est utilisable qu'une fois.
    setDeferred(null)
  }

  if (!deferred && !showIOSHint) return null

  return (
    // z-30 : le classement et la saisie du nom doivent passer PAR-DESSUS.
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center p-3"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
    >
      <div className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-white/10 bg-[#14141d]/95 px-4 py-3 shadow-2xl backdrop-blur">
        <span className="text-2xl leading-none">🍙</span>

        {deferred ? (
          <>
            <p className="flex-1 text-sm text-white/80">Installer HEBI sur ton écran d'accueil.</p>
            <button
              onClick={install}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-bold text-white active:scale-95"
            >
              Installer
            </button>
          </>
        ) : (
          <p className="flex-1 text-sm leading-snug text-white/80">
            Pour installer&nbsp;: <span className="font-bold text-white">Partager</span> puis{' '}
            <span className="font-bold text-white">Sur l'écran d'accueil</span>.
          </p>
        )}

        <button
          onClick={dismiss}
          aria-label="Fermer"
          className="text-lg text-white/40 active:text-white/80"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
