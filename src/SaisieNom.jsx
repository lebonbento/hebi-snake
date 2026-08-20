import { useEffect, useRef, useState } from 'react'
import { creerCompte, retrouverCompte } from './api.js'

const px = "'Press Start 2P', monospace"

/**
 * L'écran de borne d'arcade : « ENTREZ VOTRE NOM ».
 *
 * Le code à 4 chiffres n'est pas un mot de passe, c'est ce qui permet de
 * retrouver son nom sur un autre appareil — et d'empêcher quelqu'un d'écrire
 * des scores sous un nom qui n'est pas le sien.
 *
 * Deux usages, le même écran : à la fin d'une partie qui entre au tableau
 * (`score` renseigné), et depuis « QUI JOUE ? » pour ajouter un deuxième
 * joueur à ce téléphone (`score` absent).
 */
export default function SaisieNom({ score, rang, onFini, onAnnule }) {
  const ajout = score == null
  const [mode, setMode] = useState('nouveau') // nouveau | retour
  const [pseudo, setPseudo] = useState('')
  const [code, setCode] = useState('')
  const [erreur, setErreur] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const champNom = useRef(null)

  useEffect(() => {
    // Sur mobile le focus automatique ouvre le clavier, ce qui est exactement
    // ce qu'on veut ici : le joueur vient de finir sa partie.
    champNom.current?.focus()
  }, [])

  const valider = async (e) => {
    e.preventDefault()
    if (envoi) return
    setErreur(null)

    if (!pseudo.trim()) return setErreur('Il faut un nom.')
    if (!/^\d{4}$/.test(code)) return setErreur('Le code fait 4 chiffres.')

    setEnvoi(true)
    try {
      const joueur =
        mode === 'retour' ? await retrouverCompte(pseudo, code) : await creerCompte(pseudo, code)
      onFini(joueur)
    } catch (err) {
      if (err.statut === 409) {
        setErreur('Ce nom est déjà pris. Si c’est le tien, passe par « J’ai déjà un nom ».')
      } else {
        setErreur(err.message)
      }
      setEnvoi(false)
    }
  }

  return (
    <form
      onSubmit={valider}
      className="flex w-full max-w-xs flex-col items-center gap-4 text-center"
    >
      <div style={{ fontFamily: px, fontSize: 11, color: '#fbbf24', lineHeight: 1.6 }}>
        {mode === 'retour' ? 'TON NOM' : ajout ? 'NOUVEAU JOUEUR' : 'NOUVEAU RECORD'}
      </div>

      {mode === 'nouveau' && ajout && (
        <p className="text-xs leading-snug" style={{ color: '#9aa1b8' }}>
          Choisis un nom et un code à 4 chiffres.
          <br />
          Tu pourras changer de joueur d’un tap.
        </p>
      )}

      {mode === 'nouveau' && !ajout && (
        <p className="text-xs" style={{ color: '#9aa1b8' }}>
          {rang ? `${score} points — ${rang}ᵉ au classement.` : `${score} points.`}
          <br />
          Entre ton nom pour y figurer.
        </p>
      )}

      <input
        ref={champNom}
        value={pseudo}
        onChange={(e) => setPseudo(e.target.value.slice(0, 12))}
        placeholder="TON NOM"
        maxLength={12}
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="w-full rounded-xl px-3 py-3 text-center uppercase"
        style={{
          fontFamily: px,
          fontSize: 12,
          background: '#0f0f18',
          border: '1px solid #2d2d3f',
          color: '#a7f3d0',
        }}
      />

      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
        placeholder="CODE 4 CHIFFRES"
        inputMode="numeric"
        autoComplete="off"
        className="w-full rounded-xl px-3 py-3 text-center"
        style={{
          fontFamily: px,
          fontSize: 12,
          letterSpacing: 4,
          background: '#0f0f18',
          border: '1px solid #2d2d3f',
          color: '#f1f5f9',
        }}
      />

      <p className="text-xs leading-snug" style={{ color: '#6b7189' }}>
        Retiens ce code : c’est lui qui te rendra ton nom sur un autre téléphone.
      </p>

      {erreur && (
        <p className="text-xs leading-snug" style={{ color: '#f87171' }}>
          {erreur}
        </p>
      )}

      <button
        type="submit"
        disabled={envoi}
        className="w-full rounded-full px-6 py-3 active:scale-95 transition disabled:opacity-50"
        style={{
          fontFamily: px,
          fontSize: 11,
          background: '#dc2626',
          color: '#fff',
          letterSpacing: 1,
        }}
      >
        {envoi ? '…' : mode === 'retour' ? 'RETROUVER' : 'VALIDER'}
      </button>

      <div className="flex flex-col gap-2 text-xs" style={{ color: '#7c8299' }}>
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'retour' ? 'nouveau' : 'retour')
            setErreur(null)
          }}
          className="underline active:text-white"
        >
          {mode === 'retour' ? 'Créer un nouveau nom' : 'J’ai déjà un nom'}
        </button>
        <button type="button" onClick={onAnnule} className="active:text-white">
          {ajout ? 'Annuler' : 'Plus tard'}
        </button>
      </div>
    </form>
  )
}
