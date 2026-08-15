import { neon } from '@neondatabase/serverless'

let sql = null
let implementation = null

/**
 * Branche une autre base que Neon. Sert au serveur de développement, qui fait
 * tourner ces mêmes routes sur un Postgres local (PGlite) : le code testé est
 * alors exactement celui qui partira en production.
 */
export function utiliserBase(fn) {
  implementation = fn
}

/**
 * `requete(text, params)` renvoie directement les lignes.
 * Même signature que PGlite : les tests font tourner le vrai code sur un vrai
 * Postgres, sans Neon et sans réseau.
 */
export function requete(text, params) {
  if (implementation) return implementation(text, params)
  if (!sql) {
    // L'intégration Neon de Vercel pose DATABASE_URL ; les anciennes posaient
    // POSTGRES_URL. On accepte les deux plutôt que d'échouer sur un nom.
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
    if (!url) throw new Error('DATABASE_URL manquante')
    sql = neon(url)
  }
  return sql.query(text, params)
}

export function baseConfiguree() {
  return Boolean(implementation || process.env.DATABASE_URL || process.env.POSTGRES_URL)
}

/**
 * Sans HEBI_SEL, les codes seraient hachés avec le sel historique, qui est écrit
 * en clair dans un dépôt public. Un déploiement mal configuré ne doit donc PAS
 * servir le classement en mode dégradé : il doit refuser. Échouer fermé.
 */
export function selConfigure() {
  return Boolean(process.env.HEBI_SEL)
}

/* ------------------------------------------------------------------
   Petits utilitaires HTTP communs aux trois routes
   ------------------------------------------------------------------ */

export function json(res, code, corps) {
  res.status(code)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  // Le classement change à chaque partie : rien à mettre en cache.
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(corps))
}

export function corpsJson(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  return req.body
}

/** Renvoie true si la requête a été traitée (mauvaise méthode ou base absente). */
export function refuse(req, res, methode) {
  if (req.method !== methode) {
    json(res, 405, { erreur: 'Méthode non autorisée.' })
    return true
  }
  if (!baseConfiguree() || !selConfigure()) {
    json(res, 503, { erreur: 'Classement indisponible.' })
    return true
  }
  return false
}
