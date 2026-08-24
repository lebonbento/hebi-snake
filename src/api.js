/**
 * Le classement est la SEULE chose qui a besoin du réseau. Tout ici doit
 * échouer en silence : une coupure ne doit jamais empêcher de jouer.
 *
 * Les parties faites hors-ligne sont mises de côté et réémises plus tard, TOUTES
 * et dans l'ordre : le tableau garde chaque score, plus seulement le record.
 * Chacune porte un identifiant tiré à sa fin, ce qui permet de la réémettre sans
 * risquer de l'inscrire deux fois.
 *
 * ── Plusieurs joueurs sur le même téléphone ──
 * Un téléphone de famille sert à deux enfants. On garde donc une LISTE de
 * joueurs, pas un seul compte : chacun a son nom, son code (retenu une fois
 * pour toutes sur cet appareil), son record et sa file d'attente. Basculer de
 * l'un à l'autre est un tap, sans retaper le code — sur CE téléphone-là, la
 * confiance est déjà faite. Le code reste exigé pour ajouter un joueur.
 */

const CLE = 'hebi-joueurs'
const CLE_ANCIENNE = 'hebi-compte' // avant les profils : un seul compte
const CLE_BEST = 'hebi-best' // record de l'invité (et ancien record unique)
const CLE_FILE_ANCIENNE = 'hebi-file' // file d'attente d'avant les profils

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

/** Deux noms qui se ressemblent sont le même joueur — même règle que le serveur. */
export function norme(pseudo) {
  return String(pseudo ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

const vide = () => ({ actif: null, joueurs: [] })

/**
 * L'état complet des joueurs de cet appareil.
 * Migre au passage l'unique compte d'avant, record compris : personne ne doit
 * perdre son nom parce qu'on a ajouté les profils.
 */
function etat() {
  const e = lire(CLE, null)
  if (e && Array.isArray(e.joueurs)) return e

  const ancien = lire(CLE_ANCIENNE, null)
  if (ancien && ancien.pseudo && ancien.code) {
    const record = parseInt(localStorage.getItem(CLE_BEST) || '0', 10) || 0
    // Les parties faites dans le métro juste avant la mise à jour restent dues
    // à leur auteur — toutes, l'ancienne file était déjà une liste de scores.
    const file = lire(CLE_FILE_ANCIENNE, [])
      .filter((s) => Number.isFinite(s) && s > 0)
      .map((s) => ({ id: idPartie(), score: s }))
    const migre = {
      actif: norme(ancien.pseudo),
      joueurs: [{ pseudo: ancien.pseudo, code: ancien.code, record, file }],
    }
    ecrire(CLE, migre)
    try {
      localStorage.removeItem(CLE_ANCIENNE)
      localStorage.removeItem(CLE_FILE_ANCIENNE)
      // Ce record appartenait à ce joueur-là : il part avec lui, sinon le
      // prochain à jouer sans nom hériterait d'un record qui n'est pas le sien.
      localStorage.removeItem(CLE_BEST)
    } catch {
      /* rien à faire */
    }
    return migre
  }
  return vide()
}

function sauver(e) {
  ecrire(CLE, e)
  return e
}

function trouver(e, pseudo) {
  const n = norme(pseudo)
  return e.joueurs.find((j) => norme(j.pseudo) === n) || null
}

/** La liste des joueurs connus de cet appareil — sans les codes. */
export function listeJoueurs() {
  const e = etat()
  return e.joueurs.map((j) => ({
    pseudo: j.pseudo,
    record: j.record || 0,
    actif: norme(j.pseudo) === e.actif,
  }))
}

/** Le joueur actif, code compris. C'est lui qui signe les scores envoyés. */
export function lireCompte() {
  const e = etat()
  if (!e.actif) return null
  const j = e.joueurs.find((x) => norme(x.pseudo) === e.actif)
  return j ? { pseudo: j.pseudo, code: j.code } : null
}

/** Bascule sur un joueur déjà enregistré ici. Renvoie son record local. */
export function choisirJoueur(pseudo) {
  const e = etat()
  const j = trouver(e, pseudo)
  if (!j) return null
  e.actif = norme(j.pseudo)
  sauver(e)
  return { pseudo: j.pseudo, record: j.record || 0 }
}

/** Personne : on joue sans nom, avec le record « invité ». */
export function jouerSansNom() {
  const e = etat()
  e.actif = null
  sauver(e)
}

/** Retire un joueur de CET appareil. Son compte et ses scores restent en ligne. */
export function retirerJoueur(pseudo) {
  const e = etat()
  const n = norme(pseudo)
  e.joueurs = e.joueurs.filter((j) => norme(j.pseudo) !== n)
  if (e.actif === n) e.actif = null
  sauver(e)
}

/** Le record local du joueur actif — ou celui de l'invité s'il n'y en a pas. */
export function recordLocal() {
  const e = etat()
  if (!e.actif) return parseInt(localStorage.getItem(CLE_BEST) || '0', 10) || 0
  const j = e.joueurs.find((x) => norme(x.pseudo) === e.actif)
  return j ? j.record || 0 : 0
}

/**
 * Note un score au bon endroit : le record suit le joueur, pas le téléphone.
 * Renvoie le record après coup.
 */
export function noterRecord(score) {
  const e = etat()
  if (!e.actif) {
    const best = parseInt(localStorage.getItem(CLE_BEST) || '0', 10) || 0
    if (score > best) {
      try {
        localStorage.setItem(CLE_BEST, String(score))
      } catch {
        /* rien à faire */
      }
      return score
    }
    return best
  }
  const j = e.joueurs.find((x) => norme(x.pseudo) === e.actif)
  if (!j) return 0
  if (score > (j.record || 0)) {
    j.record = score
    sauver(e)
  }
  return j.record || 0
}

/** Enregistre (ou met à jour) un joueur sur cet appareil et le rend actif. */
function retenir(joueur, code) {
  const e = etat()
  const existant = trouver(e, joueur.pseudo)
  if (existant) {
    existant.pseudo = joueur.pseudo
    existant.code = code
    existant.record = Math.max(existant.record || 0, joueur.record || 0)
  } else {
    e.joueurs.push({ pseudo: joueur.pseudo, code, record: joueur.record || 0, file: [] })
  }
  e.actif = norme(joueur.pseudo)
  sauver(e)
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
  retenir(joueur, code)
  return joueur
}

/** Retrouve un compte existant sur un nouvel appareil. */
export async function retrouverCompte(pseudo, code) {
  const joueur = await appel('/api/compte', {
    method: 'POST',
    body: JSON.stringify({ action: 'retrouver', pseudo, code }),
  })
  retenir(joueur, code)
  return joueur
}

export async function lireClassement() {
  return appel('/api/classement')
}

/** Nombre de parties gardées de côté au maximum : au-delà, on oublie les vieilles. */
const MAX_FILE = 20

/** Un identifiant tiré une fois par partie : c'est lui qui empêche les doublons. */
function idPartie() {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

/**
 * La file d'attente d'un joueur, sous sa forme actuelle : une LISTE de parties.
 * Avant, c'était un seul nombre — le meilleur score en attente — parce que le
 * serveur ne gardait que le record. Maintenant que chaque partie compte, on les
 * garde toutes. Les anciennes files sont converties à la volée.
 */
function fileDe(joueur) {
  if (Array.isArray(joueur.file)) return joueur.file.filter((x) => x && Number.isFinite(x.score))
  const ancien = Number(joueur.attente || 0)
  return ancien > 0 ? [{ id: idPartie(), score: ancien }] : []
}

/**
 * Vide la file, dans l'ordre. Ce qui ne passe pas reste de côté ; ce que le
 * serveur REFUSE (4xx) est jeté, réessayer n'y changerait rien.
 * Renvoie le dernier joueur à jour, ou null si rien n'est passé.
 */
async function envoyerFile(e, moi, file) {
  let dernier = null
  while (file.length) {
    const partie = file[0]
    try {
      const joueur = await appel('/api/score', {
        method: 'POST',
        body: JSON.stringify({
          pseudo: moi.pseudo,
          code: moi.code,
          score: partie.score,
          partie: partie.id,
        }),
      })
      file.shift()
      dernier = joueur
      moi.record = Math.max(moi.record || 0, joueur.record || 0)
    } catch (err) {
      // 429 (trop d'essais) est temporaire : celui-là on le garde pour plus tard.
      if (err.statut >= 400 && err.statut < 500 && err.statut !== 429) {
        file.shift()
        continue
      }
      break
    }
  }
  moi.file = file
  delete moi.attente
  sauver(e)
  return dernier
}

/**
 * Envoie une partie. Si ça ne passe pas, elle est mise en attente SUR LE
 * JOUEUR concerné et retentée quand c'est lui qui joue — sinon le score du
 * petit frère partirait au nom du grand.
 * Renvoie le joueur à jour, ou null si l'envoi n'a pas abouti.
 */
export async function envoyerScore(score) {
  const e = etat()
  if (!e.actif) return null
  const moi = e.joueurs.find((x) => norme(x.pseudo) === e.actif)
  if (!moi) return null

  const file = fileDe(moi)
  if (Number.isFinite(score) && score > 0) file.push({ id: idPartie(), score })
  if (file.length > MAX_FILE) file.splice(0, file.length - MAX_FILE)

  return envoyerFile(e, moi, file)
}

/** Le joueur actif a-t-il des parties en attente d'être envoyées ? */
export function scoreEnAttente() {
  const e = etat()
  if (!e.actif) return false
  const moi = e.joueurs.find((x) => norme(x.pseudo) === e.actif)
  return !!(moi && fileDe(moi).length > 0)
}

/** Vide la file du joueur actif, si le réseau est revenu. */
export async function viderFile() {
  const e = etat()
  if (!e.actif) return null
  const moi = e.joueurs.find((x) => norme(x.pseudo) === e.actif)
  if (!moi) return null
  const file = fileDe(moi)
  if (!file.length) return null
  return envoyerFile(e, moi, file)
}
