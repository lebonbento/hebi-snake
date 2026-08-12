import { json, refuse, requete } from './_lib/db.js'
import { lireClassement } from './_lib/logique.js'

/**
 * GET /api/classement
 *   -> { classement: [{ pseudo, record }], mondial }
 *
 * Le record mondial est simplement la première ligne : pas besoin d'une
 * seconde requête.
 */
export default async function handler(req, res) {
  if (refuse(req, res, 'GET')) return

  try {
    const lignes = await lireClassement(requete)
    return json(res, 200, {
      classement: lignes.map((l) => ({ pseudo: l.pseudo, record: Number(l.record) })),
      mondial: lignes.length ? Number(lignes[0].record) : 0,
    })
  } catch (e) {
    console.error('classement:', e)
    return json(res, 500, { erreur: 'Le classement ne répond pas.' })
  }
}
