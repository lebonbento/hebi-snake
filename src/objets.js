/**
 * Les règles des objets rares, isolées du rendu.
 *
 * Tout ce qui est ici est pur : mêmes entrées, mêmes sorties, aucun canvas et
 * aucun état. C'est ce qui permet de les vérifier sans lancer le jeu.
 */
import { kanjiAuHasard } from './kanji.js'

/* ── vitesse ──
   Avant : départ à 160 ms, −4 ms par bouchée, plancher à 65. Le plancher
   tombait dès la 24e bouchée, donc au-delà de 240 points toute la partie se
   jouait à fond. On part plus calmement et on accélère moins vite. */
export const BASE_SPEED = 175
export const MIN_SPEED = 80
export const ACCEL = 2.5

/* ── objets rares ── */
export const OBJET_VIE = 7000 // ms de présence
export const OBJET_CLIGNOTE = 2800 // ms de clignotement avant de s'éteindre
export const OBJET_CHANCE = 0.28 // probabilité d'apparition par bouchée
export const TORTUE_RECUL = 6 // bouchées d'accélération rendues
export const BONUS_POINTS = 50
export const KANJI_POINTS = 20

/** La vitesse ne dépend que du nombre de bouchées ; la tortue en retire. */
export function vitessePour(bouchees) {
  return Math.max(MIN_SPEED, BASE_SPEED - bouchees * ACCEL)
}

/** À partir de combien de bouchées le serpent est-il à fond ? */
export function boucheesAvantPlafond() {
  return Math.ceil((BASE_SPEED - MIN_SPEED) / ACCEL)
}

/** Un tirage entre 0 et 1 décide du type. La tortue est la plus fréquente. */
export function choisirType(tirage) {
  if (tirage < 0.4) return 'tortue'
  if (tirage < 0.72) return 'bonus'
  return 'kanji'
}

export function creerObjet(type, x, y, maintenant) {
  if (type === 'kanji') {
    const k = kanjiAuHasard()
    return { type, x, y, icon: k.c, fr: k.fr, ne_a: maintenant }
  }
  return { type, x, y, icon: type === 'tortue' ? '🐢' : '⭐', ne_a: maintenant }
}

export function estExpire(objet, maintenant) {
  return !objet || maintenant - objet.ne_a > OBJET_VIE
}

/**
 * Opacité de l'objet : pleine au début, puis un clignotement qui s'emballe à
 * mesure qu'il ne reste plus de temps.
 */
export function opacite(objet, maintenant) {
  const reste = OBJET_VIE - (maintenant - objet.ne_a)
  if (reste >= OBJET_CLIGNOTE) return 1
  if (reste <= 0) return 0
  const nervosite = 90 + 150 * (reste / OBJET_CLIGNOTE)
  return Math.max(0, 0.15 + 0.85 * (0.5 + 0.5 * Math.sin(maintenant / nervosite)))
}

/**
 * Ce que rapporte un objet. Renvoie les points gagnés, le nouveau compteur de
 * bouchées (la tortue le fait reculer) et le texte qui monte à l'écran.
 */
export function effet(objet, bouchees) {
  if (objet.type === 'tortue') {
    return {
      points: 0,
      bouchees: Math.max(0, bouchees - TORTUE_RECUL),
      texte: 'ralenti',
    }
  }
  if (objet.type === 'bonus') {
    return { points: BONUS_POINTS, bouchees, texte: `+${BONUS_POINTS}` }
  }
  return { points: KANJI_POINTS, bouchees, texte: objet.fr }
}
