/**
 * Un joueur, PLUSIEURS lignes au tableau — vu des routes HTTP, pas de la
 * logique : c'est `api/score.js` qui doit transmettre la clé de partie, et
 * `api/classement.js` qui doit rendre une ligne par partie.
 *
 *   npm run build && npm run test-scores
 *
 * Le script démarre son propre serveur sur une base vierge : deux exécutions
 * de suite donnent le même résultat.
 */
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4182
const URL = `http://localhost:${PORT}`

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
    if ((await fetch(`${URL}/api/classement`)).ok) break
  } catch {
    /* pas encore prêt */
  }
  await new Promise((r) => setTimeout(r, 250))
}

const poste = async (chemin, corps) => {
  const r = await fetch(`${URL}${chemin}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  })
  return { statut: r.status, corps: await r.json() }
}
const classement = async () => (await fetch(`${URL}/api/classement`)).json()

try {
  console.log('\n▸ deux joueurs, plusieurs parties chacun')
  await poste('/api/compte', { action: 'creer', pseudo: 'Loukian', code: '1234' })
  await poste('/api/compte', { action: 'creer', pseudo: 'Nolan', code: '2222' })

  for (const [i, score] of [150, 90, 220].entries()) {
    await poste('/api/score', { pseudo: 'Loukian', code: '1234', score, partie: `L${i}` })
  }
  const dernier = await poste('/api/score', {
    pseudo: 'Nolan',
    code: '2222',
    score: 120,
    partie: 'N0',
  })
  verifie(dernier.statut === 200, 'le serveur accepte la partie', String(dernier.statut))

  const t1 = await classement()
  verifie(
    t1.classement.map((l) => `${l.pseudo}:${l.record}`).join(' > ') ===
      'Loukian:220 > Loukian:150 > Nolan:120 > Loukian:90',
    'les 3 parties de Loukian figurent au tableau, mêlées à celle de Nolan',
    t1.classement.map((l) => `${l.pseudo}:${l.record}`).join(' '),
  )
  verifie(t1.mondial === 220, 'le mondial est le meilleur score, pas le meilleur joueur')
  verifie(dernier.corps.record === 120, 'le record personnel reste le MEILLEUR de ses parties')
  verifie(dernier.corps.rang === 3, 'le rang est la ligne du joueur au tableau', String(dernier.corps.rang))

  console.log('\n▸ la file d’attente hors-ligne réémet sans doubler')
  await poste('/api/score', { pseudo: 'Loukian', code: '1234', score: 220, partie: 'L2' })
  const t2 = await classement()
  verifie(
    t2.classement.length === t1.classement.length,
    'la même partie renvoyée n’ajoute pas de ligne',
    `${t1.classement.length} → ${t2.classement.length}`,
  )

  console.log('\n▸ mais rejouer le même score reste possible')
  await poste('/api/score', { pseudo: 'Loukian', code: '1234', score: 220, partie: 'L3' })
  const t3 = await classement()
  verifie(
    t3.classement.filter((l) => l.record === 220).length === 2,
    'deux parties à 220 tiennent chacune leur place',
    t3.classement.map((l) => l.record).join(' '),
  )
} finally {
  serveur.kill()
}

console.log(echecs === 0 ? '\n✓ plusieurs scores : tout est bon' : `\n✗ ${echecs} échec(s)`)
process.exit(echecs === 0 ? 0 : 1)
