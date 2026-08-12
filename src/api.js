/**
 * Le classement est la SEULE chose qui a besoin du réseau. Tout ici doit
 * échouer en silence : une coupure ne doit jamais empêcher de jouer.
 *
 * Les scores faits hors-ligne sont mis de côté et réémis plus tard. Le serveur
 * ne garde que le meilleur, donc réémettre deux fois la même partie est sans
 * conséquence.
 */

const CLE_COMPTE = 'hebi-compte'
const CLE_FILE = 'hebi-file'

function lire(cle, defaut) {
  try {
    const brut = localStorage.getItem(cle)
    return brut ? JSON.parse(brut) : defaut
  } catch {
    return defaut
  }
}

function ecrire(cle, valeur) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur))
  } catch {
    /* navigation privée ou quota plein : on continue sans persister */
  }
}

export function lireCompte() {
  const c = lire(CLE_COMPTE, null)
  return c && c.pseudo && c.code ? c : null
}

export function oublierCompte() {
  try {
    localStorage.removeItem(CLE_COMPTE)
  } catch {
    /* rien à faire */
  }
}

async function appel(chemin, options) {
  const reponse = await fetch(chemin, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  let corps = {}
  try {
    corps = await reponse.json()
  } catch {
    /* réponse vide ou HTML : on garde un objet vide */
  }
  if (!reponse.ok) {
    const erreur = new Error(corps.erreur || 'Le classement ne répond pas.')
    erreur.statut = reponse.status
    throw erreur
  }
  return corps
}

/** Crée un compte. Lève une erreur avec statut 409 si le nom est déjà pris. */
export async function creerCompte(pseudo, code) {
  const joueur = await appel('/api/compte', {
    method: 'POST',
    body: JSON.stringify({ action: 'creer', pseudo, code }),
  })
  ecrire(CLE_COMPTE, { pseudo: joueur.pseudo, code })
  return joueur
}

/** Retrouve un compte existant sur un nouvel appareil. */
export async function retrouverCompte(pseudo, code) {
  const joueur = await appel('/api/compte', {
    method: 'POST',
    body: JSON.stringify({ action: 'retrouver', pseudo, code }),
  })
  ecrire(CLE_COMPTE, { pseudo: joueur.pseudo, code })
  return joueur
}

export async function lireClassement() {
  return appel('/api/classement')
}

/**
 * Envoie un score. Si ça ne passe pas, le score est mis en file et retenté au
 * prochain envoi ou au prochain retour du réseau.
 * Renvoie le joueur à jour, ou null si l'envoi n'a pas abouti.
 */
export async function envoyerScore(score) {
  const compte = lireCompte()
  if (!compte) return null

  const file = lire(CLE_FILE, [])
  // On ne garde que le meilleur en attente : inutile de rejouer 40 parties.
  const aEnvoyer = Math.max(score, ...file, 0)

  try {
    const joueur = await appel('/api/score', {
      method: 'POST',
      body: JSON.stringify({ ...compte, score: aEnvoyer }),
    })
    ecrire(CLE_FILE, [])
    return joueur
  } catch (e) {
    // 4xx = le serveur a compris et refuse : réessayer n'y changera rien.
    if (e.statut >= 400 && e.statut < 500) return null
    ecrire(CLE_FILE, [aEnvoyer])
    return null
  }
}

/** Y a-t-il un score en attente d'être envoyé ? */
export function scoreEnAttente() {
  return lire(CLE_FILE, []).length > 0
}

/** Vide la file, si le réseau est revenu. */
export async function viderFile() {
  const file = lire(CLE_FILE, [])
  if (!file.length || !lireCompte()) return null
  return envoyerScore(Math.max(...file))
}
