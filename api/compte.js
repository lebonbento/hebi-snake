import { corpsJson, json, refuse, requete } from './_lib/db.js'
import { creerCompte, retrouverCompte, validerCode, validerPseudo } from './_lib/logique.js'

/**
 * POST /api/compte
 *   { action: 'creer' | 'retrouver', pseudo, code }
 *
 * « creer » échoue en 409 si le nom est déjà pris — c'est là que se joue
 * l'unicité des pseudos, garantie par la clé primaire, pas par un select
 * préalable qui laisserait passer deux inscriptions simultanées.
 */
export default async function handler(req, res) {
  if (refuse(req, res, 'POST')) return

  const { action, pseudo, code } = corpsJson(req)

  const p = validerPseudo(pseudo)
  if (!p.ok) return json(res, 400, { erreur: p.erreur })

  const c = validerCode(code)
  if (!c.ok) return json(res, 400, { erreur: c.erreur })

  try {
    const resultat =
      action === 'retrouver'
        ? await retrouverCompte(requete, { norm: p.norm, code })
        : await creerCompte(requete, { pseudo: p.pseudo, norm: p.norm, code })

    if (!resultat.ok) return json(res, resultat.code, { erreur: resultat.erreur })
    return json(res, action === 'retrouver' ? 200 : 201, resultat.joueur)
  } catch (e) {
    console.error('compte:', e)
    return json(res, 500, { erreur: 'Le classement ne répond pas.' })
  }
}
