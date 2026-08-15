import { createHash } from 'node:crypto'

// 17×17 cases, moins les 3 du serpent de départ, à 10 points la bouchée :
// personne ne peut dépasser ça sans tricher.
export const SCORE_MAX = (17 * 17 - 3) * 10

export const TAILLE_CLASSEMENT = 20

/**
 * Deux pseudos qui se ressemblent à s'y méprendre sont le MÊME pseudo :
 * « Loukian », « loukian » et « LOUKIÁN » ne peuvent pas coexister.
 */
export function normaliserPseudo(pseudo) {
  return String(pseudo ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // enlève les accents
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

export function validerPseudo(pseudo) {
  const propre = String(pseudo ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (propre.length < 1) return { ok: false, erreur: 'Il faut un nom.' }
  if (propre.length > 12) return { ok: false, erreur: '12 caractères maximum.' }
  if (!/^[\p{L}\p{N} _-]+$/u.test(propre)) {
    return { ok: false, erreur: 'Lettres, chiffres, espace, - et _ seulement.' }
  }
  const norm = normaliserPseudo(propre)
  if (!norm) return { ok: false, erreur: 'Il faut un nom.' }
  return { ok: true, pseudo: propre, norm }
}

export function validerCode(code) {
  return /^\d{4}$/.test(String(code ?? '')) ? { ok: true } : { ok: false, erreur: 'Code à 4 chiffres.' }
}

/** Le score ne peut être qu'un multiple de 10, positif, et sous le plafond. */
export function validerScore(score) {
  const n = Number(score)
  if (!Number.isInteger(n) || n < 0 || n > SCORE_MAX || n % 10 !== 0) {
    return { ok: false, erreur: 'Score invalide.' }
  }
  return { ok: true, score: n }
}

/**
 * ⚠️ Le sel d'origine était en dur dans le code. Le dépôt étant devenu public,
 * n'importe qui pouvait recalculer les hachages et forcer un code de 4 chiffres
 * hors ligne, instantanément. Le vrai sel vit maintenant dans HEBI_SEL, une
 * variable d'environnement.
 *
 * On garde l'ancien uniquement pour VÉRIFIER : les comptes créés avant la
 * bascule continuent de marcher, et se ré-encodent tout seuls au premier usage
 * (voir `verifierAcces`). Personne ne perd son nom ni son record.
 */
const SEL_HISTORIQUE = 'hebi'

function selActuel() {
  return process.env.HEBI_SEL || SEL_HISTORIQUE
}

export function hacherCode(norm, code, sel = selActuel()) {
  return createHash('sha256').update(`${sel}:${norm}:${code}`).digest('hex')
}

/** Nombre d'échecs tolérés avant de fermer le compte un moment. */
export const ECHECS_TOLERES = 5
export const BLOCAGE_MINUTES = 15

/* ------------------------------------------------------------------
   Requêtes. Chacune reçoit `requete(text, params) -> rows`, ce qui
   permet de faire tourner exactement le même code sur Neon en prod et
   sur PGlite dans les tests.
   ------------------------------------------------------------------ */

export async function creerCompte(requete, { pseudo, norm, code }) {
  const lignes = await requete(
    `insert into joueurs (pseudo_norm, pseudo, code_hash)
     values ($1, $2, $3)
     on conflict (pseudo_norm) do nothing
     returning pseudo, record`,
    [norm, pseudo, hacherCode(norm, code)],
  )
  if (lignes.length === 0) return { ok: false, code: 409, erreur: 'Ce nom est déjà pris.' }
  return { ok: true, joueur: { pseudo: lignes[0].pseudo, record: lignes[0].record } }
}

/**
 * Le seul endroit qui décide si un couple nom/code est valable.
 *
 * Fait trois choses d'un coup : refuse un compte temporairement fermé, accepte
 * les codes encodés avec l'ancien sel en les ré-encodant au passage, et compte
 * les échecs pour fermer le compte avant qu'on ait pu essayer les 10 000 codes.
 */
export async function verifierAcces(requete, { norm, code }) {
  const lignes = await requete(
    `select pseudo, record, code_hash, echecs, bloque_jusqu_a > now() as bloque
       from joueurs where pseudo_norm = $1`,
    [norm],
  )
  if (lignes.length === 0) return { ok: false, code: 404, erreur: 'Nom inconnu.' }

  const joueur = lignes[0]
  if (joueur.bloque) {
    return { ok: false, code: 429, erreur: 'Trop d’essais. Réessaie dans un quart d’heure.' }
  }

  const attendu = hacherCode(norm, code)

  if (joueur.code_hash === attendu) {
    if (joueur.echecs > 0) {
      await requete(`update joueurs set echecs = 0 where pseudo_norm = $1`, [norm])
    }
    return { ok: true, joueur: { pseudo: joueur.pseudo, record: joueur.record } }
  }

  // Code d'avant la bascule de sel : on l'accepte une dernière fois, et on le
  // ré-encode immédiatement avec le nouveau sel.
  if (joueur.code_hash === hacherCode(norm, code, SEL_HISTORIQUE)) {
    await requete(`update joueurs set code_hash = $2, echecs = 0 where pseudo_norm = $1`, [
      norm,
      attendu,
    ])
    return { ok: true, joueur: { pseudo: joueur.pseudo, record: joueur.record }, migre: true }
  }

  const [{ echecs }] = await requete(
    `update joueurs
        set echecs         = echecs + 1,
            bloque_jusqu_a = case when echecs + 1 >= $2
                                  then now() + ($3 || ' minutes')::interval
                                  else bloque_jusqu_a end
      where pseudo_norm = $1
      returning echecs`,
    [norm, ECHECS_TOLERES, String(BLOCAGE_MINUTES)],
  )
  return {
    ok: false,
    code: 403,
    erreur: echecs >= ECHECS_TOLERES ? 'Trop d’essais. Compte fermé un quart d’heure.' : 'Mauvais code.',
  }
}

export async function retrouverCompte(requete, { norm, code }) {
  return verifierAcces(requete, { norm, code })
}

/**
 * On ne garde que le meilleur : renvoyer un score plus faible ne fait jamais
 * baisser le record. `greatest` rend l'appel rejouable sans risque, ce qui
 * compte parce que le client réémet les scores mis en attente hors-ligne.
 */
export async function enregistrerScore(requete, { norm, code, score }) {
  const acces = await verifierAcces(requete, { norm, code })
  if (!acces.ok) return acces

  const lignes = await requete(
    `update joueurs
        set record  = greatest(record, $2),
            parties = parties + 1,
            maj_le  = now()
      where pseudo_norm = $1
      returning pseudo, record`,
    [norm, score],
  )
  return { ok: true, joueur: { pseudo: lignes[0].pseudo, record: lignes[0].record } }
}

export async function lireClassement(requete, limite = TAILLE_CLASSEMENT) {
  // À égalité, c'est celui qui l'a fait en premier qui passe devant.
  return requete(
    `select pseudo, record
       from joueurs
      where record > 0
      order by record desc, maj_le asc
      limit $1`,
    [limite],
  )
}

export async function lireRang(requete, norm) {
  const lignes = await requete(
    `select count(*) + 1 as rang
       from joueurs
      where record > (select record from joueurs where pseudo_norm = $1)`,
    [norm],
  )
  return lignes.length ? Number(lignes[0].rang) : null
}
