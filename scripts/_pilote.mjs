/**
 * Pilote automatique : repère ce qu'il y a à manger et va le chercher.
 * Sert aux tests de bout en bout.
 *
 * Deux pièges appris à la dure :
 * — Lire le plateau coûte un balayage du canvas. En lisant tous les pixels à
 *   chaque pas, le serpent avance de deux ou trois cases entre deux lectures.
 *   On échantillonne donc un pixel sur neuf.
 * — Un balayage en créneau avec une marge de sécurité n'atteint jamais ce qui
 *   est posé près des bords. D'où la poursuite directe.
 */
export const CASES = 17

/**
 * Lit le plateau : la tête du serpent, et les cases qui contiennent quelque
 * chose à manger (nourriture ou objet rare).
 *
 * La tête a une couleur unique (#bbf7d0). Le corps est vert (g nettement
 * au-dessus de r). Tout ce qui est clair SANS être vert est donc une cible :
 * les emoji, les kanji cyan, les étoiles.
 */
export const lirePlateau = (page) =>
  page.evaluate((n) => {
    const cv = document.querySelector('canvas')
    if (!cv) return null
    const ctx = cv.getContext('2d')
    const w = cv.width
    const h = cv.height
    const d = ctx.getImageData(0, 0, w, h).data
    const cell = w / n

    let sx = 0
    let sy = 0
    let sc = 0
    const cases = new Map()

    for (let y = 6; y < h - 6; y += 3) {
      for (let x = 6; x < w - 6; x += 3) {
        const i = (y * w + x) * 4
        const r = d[i]
        const g = d[i + 1]
        const b = d[i + 2]

        if (Math.abs(r - 187) < 14 && Math.abs(g - 247) < 14 && Math.abs(b - 208) < 14) {
          sx += x
          sy += y
          sc++
          continue
        }
        const clair = Math.max(r, g, b) > 110
        const vert = g > r + 20 && g > b + 10
        if (!clair || vert) continue

        const k = `${Math.floor(x / cell)},${Math.floor(y / cell)}`
        cases.set(k, (cases.get(k) || 0) + 1)
      }
    }

    const cibles = [...cases.entries()]
      .filter(([, c]) => c >= 4)
      .map(([k, c]) => {
        const [x, y] = k.split(',').map(Number)
        return { x, y, poids: c }
      })

    return {
      tete: sc ? { x: Math.floor(sx / sc / cell), y: Math.floor(sy / sc / cell) } : null,
      cibles,
    }
  }, CASES)

export const score = (page) =>
  page.evaluate(() => Number(document.body.innerText.match(/SCORE\s+(\d+)/)?.[1] ?? 0))

export const estMort = (page) => page.evaluate(() => /GAME OVER/.test(document.body.innerText))

const TOUCHES = {
  droite: 'ArrowRight',
  gauche: 'ArrowLeft',
  haut: 'ArrowUp',
  bas: 'ArrowDown',
}
const OPPOSE = { droite: 'gauche', gauche: 'droite', haut: 'bas', bas: 'haut' }

/**
 * Poursuit la cible la plus proche jusqu'à ce que `arret` renvoie true, que le
 * serpent meure, ou que les pas soient épuisés.
 */
export async function poursuis(page, { pas = 220, arret = null, aChaquePas = null } = {}) {
  let sens = 'droite'

  for (let i = 0; i < pas; i++) {
    if (await estMort(page)) return { mort: true, pas: i }
    if (arret && (await arret(page))) return { mort: false, pas: i }

    const etat = await lirePlateau(page)
    if (!etat?.tete) return { mort: true, pas: i }

    const { tete, cibles } = etat
    if (cibles.length) {
      // La plus proche, en distance de Manhattan.
      const cible = cibles.reduce((a, c) =>
        Math.abs(c.x - tete.x) + Math.abs(c.y - tete.y) <
        Math.abs(a.x - tete.x) + Math.abs(a.y - tete.y)
          ? c
          : a,
      )
      const dx = cible.x - tete.x
      const dy = cible.y - tete.y

      // On vise d'abord l'axe où il reste le plus de chemin, et on n'essaie
      // jamais un demi-tour : le jeu le refuserait et on perdrait le tour.
      const voulus = []
      if (Math.abs(dx) >= Math.abs(dy)) {
        if (dx) voulus.push(dx > 0 ? 'droite' : 'gauche')
        if (dy) voulus.push(dy > 0 ? 'bas' : 'haut')
      } else {
        if (dy) voulus.push(dy > 0 ? 'bas' : 'haut')
        if (dx) voulus.push(dx > 0 ? 'droite' : 'gauche')
      }
      const choix = voulus.find((v) => v !== OPPOSE[sens] && v !== sens)
      if (choix) {
        await page.keyboard.press(TOUCHES[choix])
        sens = choix
      }
    }

    await page.waitForTimeout(175)
    if (aChaquePas) await aChaquePas(page)
  }
  return { mort: false, pas }
}
