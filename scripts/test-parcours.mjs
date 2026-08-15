/**
 * Parcours complet, vu du joueur : jouer → marquer → mourir →
 * « ENTREZ VOTRE NOM » → figurer au classement.
 *
 *   npm run build && npm run test-parcours
 *
 * Le script démarre son propre serveur, avec une base vierge : deux exécutions
 * de suite donnent le même résultat.
 */
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, devices } from 'playwright'
import { poursuis, score as scoreDe } from './_pilote.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4181
const URL = `http://localhost:${PORT}/`

let echecs = 0
const verifie = (ok, libelle, detail = '') => {
  if (ok) console.log(`  ✓ ${libelle}`)
  else {
    echecs++
    console.log(`  ✗ ${libelle}${detail ? ` — ${detail}` : ''}`)
  }
}

const serveur = spawn('node', ['scripts/serveur-local.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore',
})

for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(URL)).ok) break
  } catch {
    /* pas encore prêt */
  }
  await new Promise((r) => setTimeout(r, 250))
}

const nav = await chromium.launch()
const ctx = await nav.newContext({ ...devices['iPhone 14 Pro Max'] })
const page = await ctx.newPage()

try {
  await page.goto(URL, { waitUntil: 'networkidle' })

  const score = () => scoreDe(page)
  const texte = () => page.evaluate(() => document.body.innerText)

  console.log('\n▸ le tableau est vide au départ')
  await page.getByRole('button', { name: 'Classement' }).click()
  await page.waitForTimeout(500)
  verifie(/Personne au tableau/.test(await texte()), 'le classement annonce qu’il est vide')
  await page.getByRole('button', { name: 'Fermer le classement' }).click()

  console.log('\n▸ on joue jusqu’à marquer')
  await page.getByText('JOUER').click()
  await page.waitForTimeout(300)

  // Le pilote repère ce qu'il y a à manger et fonce dessus.
  await poursuis(page, { pas: 220, arret: async (p) => (await scoreDe(p)) >= 30 })

  const marque = await score()
  verifie(marque > 0, 'le serpent a mangé', `score ${marque}`)

  console.log('\n▸ on meurt, et la borne demande le nom')
  // On fonce dans un mur : quelle que soit la direction, l'un des deux le trouve.
  await page.keyboard.press('ArrowUp')
  await page.waitForTimeout(3000)
  if (!/NOUVEAU RECORD|GAME OVER/.test(await texte())) {
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(3000)
  }
  verifie(/NOUVEAU RECORD/.test(await texte()), '« NOUVEAU RECORD » s’affiche')

  console.log('\n▸ saisie du nom')
  await page.getByPlaceholder('TON NOM').fill('Loukian')
  await page.getByPlaceholder('CODE 4 CHIFFRES').fill('1234')
  verifie(
    (await page.getByPlaceholder('TON NOM').inputValue()) === 'Loukian',
    'le jeu n’intercepte pas les lettres tapées dans le champ',
  )
  await page.getByRole('button', { name: 'VALIDER' }).click()
  await page.waitForTimeout(1000)

  const apres = await texte()
  verifie(/LOUKIAN/.test(apres), 'le pseudo apparaît dans l’en-tête')
  const mondial = Number(apres.match(/MONDIAL\s+(\d+)/)?.[1] ?? 0)
  verifie(mondial === marque, 'la tuile MONDIAL affiche le score', `${mondial} vs ${marque}`)
  const record = Number(apres.match(/RECORD\s+(\d+)/)?.[1] ?? 0)
  verifie(record === marque, 'la tuile RECORD affiche le score', `${record} vs ${marque}`)

  console.log('\n▸ le nom est pris')
  const doublon = await page.evaluate(async () => {
    const r = await fetch('/api/compte', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'creer', pseudo: 'loukian', code: '9999' }),
    })
    return { statut: r.status, ...(await r.json()) }
  })
  verifie(doublon.statut === 409, 'le même nom est refusé à un autre joueur (409)', doublon.erreur)

  console.log('\n▸ le classement affiche la ligne')
  await page.getByRole('button', { name: 'Classement' }).click()
  await page.waitForTimeout(700)
  const tableau = await texte()
  verifie(/LOUKIAN/.test(tableau), 'le joueur figure au tableau')
  verifie(new RegExp(`\\b${marque}\\b`).test(tableau), 'avec son score')
  await page.screenshot({ path: resolve(root, '.captures/classement.png') })
} finally {
  await nav.close()
  serveur.kill()
}

console.log(echecs === 0 ? '\n✓ parcours : tout est bon' : `\n✗ ${echecs} échec(s)`)
process.exit(echecs === 0 ? 0 : 1)
