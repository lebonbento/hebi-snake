import { corpsJson, json, refuse, requete } from './_lib/db.js'
import {
  enregistrerScore,
  lireRang,
  validerCode,
  validerPseudo,
  validerScore,
} from './_lib/logique.js'

/**
 * POST /api/score
 *   { pseudo, code, score, partie }
 *
 * `partie` est la clé d'idempotence de CETTE partie-là : chaque partie laisse
 * désormais sa ligne au tableau, donc réémettre une partie mise en attente
 * pendant une coupure réseau doit l'inscrire UNE fois, pas deux.
 */
export default async function handler(req, res) {
  if (refuse(req, res, 'POST')) return

  const { pseudo, code, score, partie } = corpsJson(req)

  const p = validerPseudo(pseudo)
  if (!p.ok) return json(res, 400, { erreur: p.erreur })

  const c = validerCode(code)
  if (!c.ok) return json(res, 400, { erreur: c.erreur })

  const s = validerScore(score)
  if (!s.ok) return json(res, 400, { erreur: s.erreur })

  try {
    const resultat = await enregistrerScore(requete, {
      norm: p.norm,
      code,
      score: s.score,
      partie,
    })
    if (!resultat.ok) return json(res, resultat.code, { erreur: resultat.erreur })

    const rang = await lireRang(requete, p.norm)
    return json(res, 200, { ...resultat.joueur, rang })
  } catch (e) {
    console.error('score:', e)
    return json(res, 500, { erreur: 'Le classement ne répond pas.' })
  }
}
