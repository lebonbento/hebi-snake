/**
 * Deux enfants, un seul téléphone.
 *
 *   npm run build && npm run test-joueurs
 *
 * Ce que le test prouve, dans un vrai navigateur et sur un vrai Postgres :
 *   1. l'unique compte d'AVANT la mise à jour est repris, record compris ;
 *   2. on ajoute un deuxième joueur sans perdre le premier ;
 *   3. le record affiché suit le NOM, pas l'appareil ;
 *   4. la bascule ne redemande pas le code, et survit à un rechargement ;
 *   5. retirer un joueur ne touche ni son compte ni ses scores en ligne ;
 *   6. le mode silence est retenu.
 *
 * Le script démarre son propre serveur, base vierge : reproductible.
 */
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, devices } from 'playwright'
import { poursuis, score as scoreDe } from './_pilote.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4182
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

/** Crée un compte et lui pose un score, côté serveur : on prépare le terrain. */
async function inscrire(pseudo, code, score) {
  const envoi = (corps) =>
    fetch(`${URL}api/${corps.score === undefined ? 'compte' : 'score'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    })
  await envoi({ action: 'creer', pseudo, code })
  if (score) await envoi({ pseudo, code, score })
}

const texte = () => page.evaluate(() => document.body.innerText)
const tuile = async (nom) => Number((await texte()).match(new RegExp(`${nom}\\s+(\\d+)`))?.[1] ?? -1)

try {
  await inscrire('Loukian', '1111', 200)
  await inscrire('Nolan', '2222', 50)

  console.log('\n▸ le compte d’avant les profils est repris tel quel')
  await page.goto(URL, { waitUntil: 'networkidle' })
  // On rejoue exactement ce qu'un joueur de la version précédente avait en poche.
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('hebi-compte', JSON.stringify({ pseudo: 'Loukian', code: '1111' }))
    localStorage.setItem('hebi-best', '200')
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  verifie(/LOUKIAN/.test(await texte()), 'il retrouve son nom sans rien retaper')
  verifie((await tuile('RECORD')) === 200, 'et son record', `${await tuile('RECORD')}`)

  console.log('\n▸ le petit frère s’ajoute au téléphone')
  await page.getByTitle('Changer de joueur').click()
  await page.getByRole('button', { name: '+ AJOUTER UN JOUEUR' }).click()
  await page.getByRole('button', { name: 'J’ai déjà un nom' }).click()
  await page.getByPlaceholder('TON NOM').fill('Nolan')
  await page.getByPlaceholder('CODE 4 CHIFFRES').fill('2222')
  await page.getByRole('button', { name: 'RETROUVER' }).click()
  await page.waitForTimeout(900)
  verifie(/NOLAN/.test(await texte()), 'c’est lui qui joue maintenant')
  verifie((await tuile('RECORD')) === 50, 'le record affiché est le SIEN', `${await tuile('RECORD')}`)

  console.log('\n▸ on rebascule sur le grand, d’un tap, sans code')
  await page.getByTitle('Changer de joueur').click()
  const panneau = await texte()
  verifie(/LOUKIAN/.test(panneau) && /NOLAN/.test(panneau), 'les deux noms sont listés')
  // ⚠️ les noms sont mis en capitales par le CSS : le nom accessible, lui,
  // garde la casse tapée. Chercher « LOUKIAN » ne trouve rien.
  await page.getByRole('button', { name: /^loukian /i }).click()
  await page.waitForTimeout(900)
  verifie(/LOUKIAN/.test(await texte()), 'retour au grand sans retaper les 4 chiffres')
  verifie((await tuile('RECORD')) === 200, 'son record revient avec lui', `${await tuile('RECORD')}`)

  console.log('\n▸ ça survit à la fermeture de l’app')
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  verifie(/LOUKIAN/.test(await texte()), 'le joueur actif est retenu')

  console.log('\n▸ « jouer sans nom »')
  await page.getByTitle('Changer de joueur').click()
  await page.getByRole('button', { name: 'Jouer sans nom' }).click()
  await page.waitForTimeout(500)
  verifie(/qui joue \?/i.test(await texte()), 'l’en-tête redemande qui joue')
  verifie((await tuile('RECORD')) === 0, 'le record de l’invité repart de zéro')

  console.log('\n▸ retirer un joueur de ce téléphone')
  await page.getByTitle('Choisir un joueur').click()
  await page.getByRole('button', { name: /Retirer Nolan/i }).click()
  await page.getByRole('button', { name: 'RETIRER', exact: true }).click()
  await page.waitForTimeout(300)
  verifie(!/NOLAN/.test(await texte()), 'il disparaît de la liste')
  const enLigne = await page.evaluate(async () => {
    const r = await fetch('/api/compte', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'retrouver', pseudo: 'Nolan', code: '2222' }),
    })
    return { statut: r.status, ...(await r.json()) }
  })
  verifie(enLigne.statut === 200 && enLigne.record === 50, 'son compte et son score sont intacts')

  console.log('\n▸ mode silence')
  await page.getByRole('button', { name: 'Fermer' }).click()
  await page.getByRole('button', { name: 'Passer en mode silence' }).click()
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  verifie(
    await page.getByRole('button', { name: 'Sortir du mode silence' }).isVisible(),
    'il est encore là après un rechargement',
  )
  console.log('\n▸ à la fin d’une partie, le jeu demande à QUI va le score')
  await inscrire('Mandy', '3333') // compte neuf, aucun score en ligne
  await page.getByTitle('Choisir un joueur').click()
  await page.getByRole('button', { name: '+ AJOUTER UN JOUEUR' }).click()
  await page.getByRole('button', { name: 'J’ai déjà un nom' }).click()
  await page.getByPlaceholder('TON NOM').fill('Mandy')
  await page.getByPlaceholder('CODE 4 CHIFFRES').fill('3333')
  await page.getByRole('button', { name: 'RETROUVER' }).click()
  await page.waitForTimeout(900)
  // …puis on repose le téléphone sur la table : plus personne n'est désigné.
  await page.getByTitle('Changer de joueur').click()
  await page.getByRole('button', { name: 'Jouer sans nom' }).click()
  await page.waitForTimeout(400)

  await page.getByText('JOUER').click()
  await page.waitForTimeout(300)
  await poursuis(page, { pas: 220, arret: async (p) => (await scoreDe(p)) >= 30 })
  const marque = await scoreDe(page)
  verifie(marque > 0, 'le serpent a mangé', `score ${marque}`)

  await page.keyboard.press('ArrowUp')
  await page.waitForTimeout(3000)
  if (!/C.EST QUI/.test(await texte())) {
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(3000)
  }
  verifie(/C.EST QUI/.test(await texte()), 'le jeu demande « c’est qui ? » au lieu de deviner')
  verifie(
    new RegExp(`${marque} points`).test(await texte()),
    'le score en jeu est rappelé',
  )

  await page.getByRole('button', { name: /^mandy /i }).click()
  await page.waitForTimeout(1200)
  verifie(/MANDY/.test(await texte()), 'le score est attribué à celle qui se désigne')
  await page.getByRole('button', { name: 'Classement' }).click()
  await page.waitForTimeout(800)
  const tableau = await texte()
  verifie(
    new RegExp(`MANDY\\s+${marque}`).test(tableau),
    'et il figure au classement sous SON nom',
    tableau.replace(/\n/g, ' · ').slice(0, 120),
  )
} finally {
  await nav.close()
  serveur.kill()
}

console.log(echecs === 0 ? '\n✓ joueurs : tout est bon' : `\n✗ ${echecs} échec(s)`)
process.exit(echecs === 0 ? 0 : 1)
