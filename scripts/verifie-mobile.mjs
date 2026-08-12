/**
 * Contrôle mobile : lance `dist/` en local et vérifie sur deux tailles d'écran
 * que rien ne scrolle, que le plateau tient en entier, et que l'app se relance
 * en mode avion.
 *
 *   npm run build && npm run verifie
 *
 * On peut aussi viser une URL déjà en ligne, sans rien builder :
 *
 *   npm run verifie https://hebi-snake.vercel.app
 *
 * Les captures atterrissent dans .captures/ (ignoré par git) — et il faut LES
 * REGARDER : un contrôle vert ne dit rien sur ce que ça donne à l'œil.
 */
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, devices } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const shots = resolve(root, '.captures')
const PORT = 4173
// Sans argument, on sert dist/ en local ; avec une URL, on contrôle la vraie prod.
const cible = process.argv[2]
const URL = cible ? (cible.endsWith('/') ? cible : cible + '/') : `http://localhost:${PORT}/`

const ECRANS = [
  { nom: 'iphone-se', ...devices['iPhone SE'] },
  { nom: 'iphone-15-pro-max', ...devices['iPhone 14 Pro Max'] },
]

let echecs = 0
const ko = (msg) => {
  echecs++
  console.log(`  ✗ ${msg}`)
}
const ok = (msg) => console.log(`  ✓ ${msg}`)
const verifie = (condition, msgOk, msgKo) => (condition ? ok(msgOk) : ko(msgKo))

async function attendServeur(url, essais = 60) {
  for (let i = 0; i < essais; i++) {
    try {
      const r = await fetch(url)
      if (r.ok) return
    } catch {
      /* pas encore debout */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`serveur injoignable sur ${url}`)
}

mkdirSync(shots, { recursive: true })

const serveur = cible
  ? null
  : spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
      cwd: root,
      stdio: 'ignore',
    })
console.log(`Cible : ${URL}`)

const navigateur = await chromium.launch()

try {
  await attendServeur(URL)

  for (const { nom, ...device } of ECRANS) {
    console.log(`\n▸ ${nom} (${device.viewport.width}×${device.viewport.height})`)
    const contexte = await navigateur.newContext({ ...device, serviceWorkers: 'allow' })
    const page = await contexte.newPage()

    const requetesReseau = []
    page.on('request', (r) => requetesReseau.push(r.url()))

    await page.goto(URL, { waitUntil: 'networkidle' })

    // 1. Rien ne doit dépasser : ni en hauteur, ni en largeur.
    const debord = await page.evaluate(() => {
      const e = document.documentElement
      return {
        vertical: e.scrollHeight - e.clientHeight,
        horizontal: e.scrollWidth - e.clientWidth,
      }
    })
    verifie(
      debord.vertical <= 1,
      'aucun scroll vertical',
      `la page dépasse de ${debord.vertical}px en hauteur`,
    )
    verifie(
      debord.horizontal <= 1,
      'aucun scroll horizontal',
      `la page dépasse de ${debord.horizontal}px en largeur`,
    )

    // 2. Le plateau, s'il est là, doit tenir entièrement dans la fenêtre.
    const plateau = await page.evaluate(() => {
      const el = document.querySelector('canvas')
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }
    })
    if (!plateau) {
      console.log('  · pas de <canvas> — placeholder ?')
    } else {
      const dedans =
        plateau.top >= -1 &&
        plateau.left >= -1 &&
        plateau.bottom <= device.viewport.height + 1 &&
        plateau.right <= device.viewport.width + 1
      verifie(dedans, 'plateau entièrement visible', `plateau rogné : ${JSON.stringify(plateau)}`)
    }

    await page.screenshot({ path: resolve(shots, `${nom}.png`) })

    // 3. Mode avion : le service worker doit tout resservir.
    await page.evaluate(() => navigator.serviceWorker.ready)
    await contexte.setOffline(true)
    try {
      await page.reload({ waitUntil: 'load' })
      const vivant = await page.evaluate(() => document.getElementById('root')?.children.length > 0)
      verifie(vivant, 'rechargement hors-ligne', 'écran vide hors-ligne')
    } catch (e) {
      ko(`rechargement hors-ligne impossible : ${e.message}`)
    }
    await contexte.setOffline(false)

    // 4. Aucune requête vers l'extérieur (Google Fonts en tête).
    const externes = requetesReseau.filter((u) => !u.startsWith(URL) && !u.startsWith('data:'))
    verifie(
      externes.length === 0,
      'aucune requête externe',
      `requêtes externes : ${[...new Set(externes)].join(', ')}`,
    )

    await contexte.close()
  }
} finally {
  await navigateur.close()
  serveur?.kill()
}

console.log(
  echecs === 0
    ? `\n✓ tout est bon — captures dans .captures/`
    : `\n✗ ${echecs} problème(s) — captures dans .captures/`,
)
process.exit(echecs === 0 ? 0 : 1)
