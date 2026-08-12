const px = "'Press Start 2P', monospace"

/**
 * Le tableau des scores, comme sur les bornes : rang, nom, points.
 * La ligne du joueur est mise en avant.
 */
export default function Classement({ lignes, moi, chargement, erreur, onFermer }) {
  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-[#0a0a10]/97 backdrop-blur-sm"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 pt-4 pb-2">
        <span style={{ fontFamily: px, fontSize: 11, color: '#fbbf24', letterSpacing: 1 }}>
          MEILLEURS SCORES
        </span>
        <button
          onClick={onFermer}
          aria-label="Fermer le classement"
          className="flex h-8 w-8 items-center justify-center rounded-full text-lg active:scale-95"
          style={{ background: '#1c1c2a', border: '1px solid #2d2d3f', color: '#9aa1b8' }}
        >
          ✕
        </button>
      </div>

      {/* La liste est la seule chose qui défile : le plateau, lui, ne bouge pas. */}
      <div className="mx-auto min-h-0 w-full max-w-md flex-1 overflow-y-auto px-4 pb-4">
        {chargement && (
          <p className="pt-8 text-center text-xs" style={{ color: '#6b7189' }}>
            …
          </p>
        )}

        {!chargement && erreur && (
          <p className="pt-8 text-center text-xs leading-relaxed" style={{ color: '#6b7189' }}>
            Classement injoignable.
            <br />
            Le jeu, lui, marche toujours.
          </p>
        )}

        {!chargement && !erreur && lignes.length === 0 && (
          <p className="pt-8 text-center text-xs leading-relaxed" style={{ color: '#6b7189' }}>
            Personne au tableau.
            <br />À toi de l’ouvrir.
          </p>
        )}

        {!chargement &&
          !erreur &&
          lignes.map((ligne, i) => {
            const cestMoi = moi && ligne.pseudo === moi
            return (
              <div
                key={`${ligne.pseudo}-${i}`}
                className="flex items-center gap-3 rounded-lg px-2 py-2"
                style={{ background: cestMoi ? 'rgba(220,38,38,.16)' : 'transparent' }}
              >
                <span
                  className="w-7 shrink-0 text-right"
                  style={{ fontFamily: px, fontSize: 9, color: i < 3 ? '#fbbf24' : '#5c6178' }}
                >
                  {i + 1}
                </span>
                <span
                  className="min-w-0 flex-1 truncate uppercase"
                  style={{
                    fontFamily: px,
                    fontSize: 10,
                    color: cestMoi ? '#fff' : '#c7cddb',
                  }}
                >
                  {ligne.pseudo}
                </span>
                <span
                  className="shrink-0"
                  style={{ fontFamily: px, fontSize: 10, color: '#a7f3d0' }}
                >
                  {ligne.record}
                </span>
              </div>
            )
          })}
      </div>
    </div>
  )
}
