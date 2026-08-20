import { useState } from 'react'
import { choisirJoueur, jouerSansNom, listeJoueurs, retirerJoueur } from './api.js'

const px = "'Press Start 2P', monospace"

/**
 * « QUI JOUE ? » — le sélecteur de joueur d'un téléphone de famille.
 *
 * Un tap suffit pour passer de l'un à l'autre : le code des joueurs déjà
 * ajoutés est retenu sur cet appareil. Le code n'est redemandé que pour
 * AJOUTER un joueur, c'est-à-dire pour prouver une fois que ce nom est bien
 * le sien.
 *
 * `titre` permet de réutiliser l'écran à la fin d'une partie (« 320 POINTS —
 * C'EST QUI ? ») sans en écrire un deuxième.
 */
export default function Joueurs({ titre = 'QUI JOUE ?', sousTitre, onChoisi, onAjouter, onFermer }) {
  const [joueurs, setJoueurs] = useState(() => listeJoueurs())
  const [aRetirer, setARetirer] = useState(null) // pseudo en attente de confirmation

  const basculer = (pseudo) => {
    const j = choisirJoueur(pseudo)
    if (j) onChoisi(j)
  }

  const invite = () => {
    jouerSansNom()
    onChoisi(null)
  }

  const retirer = (pseudo) => {
    retirerJoueur(pseudo)
    setJoueurs(listeJoueurs())
    setARetirer(null)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#0a0a10]/97 backdrop-blur-sm"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 pt-4 pb-2">
        <span style={{ fontFamily: px, fontSize: 11, color: '#fbbf24', letterSpacing: 1 }}>
          {titre}
        </span>
        <button
          onClick={onFermer}
          aria-label="Fermer"
          className="flex h-8 w-8 items-center justify-center rounded-full text-lg active:scale-95"
          style={{ background: '#1c1c2a', border: '1px solid #2d2d3f', color: '#9aa1b8' }}
        >
          ✕
        </button>
      </div>

      <div className="mx-auto min-h-0 w-full max-w-md flex-1 overflow-y-auto px-4 pb-6">
        {sousTitre && (
          <p className="pb-3 text-xs leading-snug" style={{ color: '#9aa1b8' }}>
            {sousTitre}
          </p>
        )}

        {joueurs.map((j) => (
          <div key={j.pseudo} className="mb-2">
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-3"
              style={{
                background: j.actif ? 'rgba(220,38,38,.16)' : '#12121c',
                border: `1px solid ${j.actif ? '#dc2626' : '#2d2d3f'}`,
              }}
            >
              <button
                onClick={() => basculer(j.pseudo)}
                className="flex min-w-0 flex-1 items-baseline gap-2 text-left active:opacity-60"
              >
                <span
                  className="min-w-0 flex-1 truncate uppercase"
                  style={{ fontFamily: px, fontSize: 11, color: j.actif ? '#fff' : '#c7cddb' }}
                >
                  {j.pseudo}
                </span>
                <span style={{ fontFamily: px, fontSize: 9, color: '#a7f3d0' }}>{j.record}</span>
              </button>
              <button
                onClick={() => setARetirer(aRetirer === j.pseudo ? null : j.pseudo)}
                aria-label={`Retirer ${j.pseudo} de ce téléphone`}
                className="shrink-0 px-1 text-sm active:opacity-60"
                style={{ color: '#5c6178' }}
              >
                ✕
              </button>
            </div>

            {aRetirer === j.pseudo && (
              <div
                className="mt-1 rounded-xl px-3 py-3 text-xs leading-snug"
                style={{ background: '#12121c', border: '1px solid #2d2d3f', color: '#9aa1b8' }}
              >
                Retirer {j.pseudo} de ce téléphone ? Le nom et les scores restent au
                classement : il suffira du code à 4 chiffres pour revenir.
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => retirer(j.pseudo)}
                    className="rounded-full px-4 py-2 active:scale-95"
                    style={{ fontFamily: px, fontSize: 9, background: '#dc2626', color: '#fff' }}
                  >
                    RETIRER
                  </button>
                  <button
                    onClick={() => setARetirer(null)}
                    className="rounded-full px-4 py-2 active:scale-95"
                    style={{ fontFamily: px, fontSize: 9, background: '#1c1c2a', color: '#9aa1b8' }}
                  >
                    NON
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {joueurs.length === 0 && (
          <p className="pb-3 text-xs leading-snug" style={{ color: '#6b7189' }}>
            Personne d’enregistré sur ce téléphone.
          </p>
        )}

        <button
          onClick={onAjouter}
          className="mt-2 w-full rounded-xl px-3 py-3 active:scale-95 transition"
          style={{
            fontFamily: px,
            fontSize: 10,
            background: '#12121c',
            border: '1px dashed #3a3a52',
            color: '#a7f3d0',
          }}
        >
          + AJOUTER UN JOUEUR
        </button>

        {joueurs.some((j) => j.actif) && (
          <button
            onClick={invite}
            className="mt-4 w-full text-center text-xs underline active:text-white"
            style={{ color: '#7c8299' }}
          >
            Jouer sans nom
          </button>
        )}

        <p className="mt-5 text-center text-xs leading-snug" style={{ color: '#5c6178' }}>
          Chacun garde son record et sa place au classement.
        </p>
      </div>
    </div>
  )
}
