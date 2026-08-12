/**
 * ⚠️ PLACEHOLDER — à remplacer par le prototype `hebi-snake.jsx`.
 *
 * Ce fichier n'existe que pour que le squelette (polices, PWA, safe-areas,
 * service worker) soit testable avant l'arrivée du vrai jeu. Il sera écrasé
 * intégralement, avec deux seules adaptations sur le prototype :
 *   1. window.storage → localStorage, clé `hebi-best`
 *   2. suppression de l'@import Google Fonts (les polices sont dans index.css)
 */
export default function HebiSnake() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-32 w-32 items-center justify-center rounded-full bg-red-600 text-6xl">
        蛇
      </div>
      <h1 className="font-pixel text-xl tracking-widest text-white">HEBI</h1>
      <p className="max-w-xs text-sm text-white/50">
        Squelette PWA en place. Le jeu arrive dès réception du prototype.
      </p>
    </div>
  )
}
