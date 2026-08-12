/**
 * Fait tourner la logique du classement sur un vrai Postgres (PGlite, en
 * mémoire) — pas un mock. Les contraintes, la clé primaire et le `greatest`
 * sont donc réellement exercés.
 *
 *   npm run test-classement
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import {
  SCORE_MAX,
  creerCompte,
  enregistrerScore,
  lireClassement,
  lireRang,
  normaliserPseudo,
  retrouverCompte,
  validerPseudo,
  validerScore,
} from '../api/_lib/logique.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

let echecs = 0
const verifie = (condition, libelle, detail = '') => {
  if (condition) {
    console.log(`  ✓ ${libelle}`)
  } else {
    echecs++
    console.log(`  ✗ ${libelle}${detail ? ` — ${detail}` : ''}`)
  }
}

const db = new PGlite()
const requete = async (text, params) => (await db.query(text, params)).rows

await db.exec(readFileSync(resolve(root, 'api/_lib/schema.sql'), 'utf8'))

console.log('\n▸ validation des entrées')
verifie(!validerPseudo('').ok, 'un nom vide est refusé')
verifie(!validerPseudo('a'.repeat(13)).ok, 'plus de 12 caractères est refusé')
verifie(!validerPseudo('<script>').ok, 'les caractères exotiques sont refusés')
verifie(validerPseudo('Jean-Luc_7').ok, 'tiret, souligné et chiffres passent')
verifie(validerPseudo('Loukian').ok, 'un nom normal passe')
verifie(!validerScore(15).ok, 'un score non multiple de 10 est refusé')
verifie(!validerScore(-10).ok, 'un score négatif est refusé')
verifie(!validerScore(SCORE_MAX + 10).ok, `au-dessus de ${SCORE_MAX} est refusé`)
verifie(validerScore(2860).ok, 'le score maximum théorique passe')
verifie(
  normaliserPseudo('Loukián ') === normaliserPseudo('loukian'),
  'accents et casse donnent le même nom',
)

console.log('\n▸ création de compte')
const a = await creerCompte(requete, { pseudo: 'Loukian', norm: 'LOUKIAN', code: '1234' })
verifie(a.ok, 'création acceptée')
verifie(a.joueur?.record === 0, 'record initial à zéro')

const doublon = await creerCompte(requete, { pseudo: 'loukian', norm: 'LOUKIAN', code: '9999' })
verifie(!doublon.ok && doublon.code === 409, 'le MÊME nom en minuscules est refusé (409)')

const p = validerPseudo('Loukián')
const doublonAccent = await creerCompte(requete, { pseudo: p.pseudo, norm: p.norm, code: '5555' })
verifie(!doublonAccent.ok && doublonAccent.code === 409, 'le même nom accentué est refusé (409)')

console.log('\n▸ retrouver son compte')
verifie((await retrouverCompte(requete, { norm: 'LOUKIAN', code: '1234' })).ok, 'bon code : accepté')
const mauvais = await retrouverCompte(requete, { norm: 'LOUKIAN', code: '0000' })
verifie(!mauvais.ok && mauvais.code === 403, 'mauvais code : refusé (403)')
const inconnu = await retrouverCompte(requete, { norm: 'PERSONNE', code: '1234' })
verifie(!inconnu.ok && inconnu.code === 404, 'nom inconnu : 404')

console.log('\n▸ enregistrement des scores')
await enregistrerScore(requete, { norm: 'LOUKIAN', code: '1234', score: 120 })
const apresBaisse = await enregistrerScore(requete, { norm: 'LOUKIAN', code: '1234', score: 30 })
verifie(apresBaisse.joueur.record === 120, 'un score plus faible ne fait pas baisser le record')
const rejoue = await enregistrerScore(requete, { norm: 'LOUKIAN', code: '1234', score: 120 })
verifie(rejoue.joueur.record === 120, 'réémettre le même score est sans effet (file hors-ligne)')
const vol = await enregistrerScore(requete, { norm: 'LOUKIAN', code: '0000', score: 9999 })
verifie(!vol.ok && vol.code === 403, "on ne peut pas écrire le score d'un autre sans son code")

const partiesLignes = await requete('select parties from joueurs where pseudo_norm = $1', [
  'LOUKIAN',
])
verifie(partiesLignes[0].parties === 3, 'le compteur de parties suit les 3 envois valides')

console.log('\n▸ le plafond est tenu par la BASE, pas seulement par le code')
let refuseParLaBase = false
try {
  await requete('update joueurs set record = $1 where pseudo_norm = $2', [999999, 'LOUKIAN'])
} catch {
  refuseParLaBase = true
}
verifie(refuseParLaBase, 'la contrainte record_plausible rejette un score aberrant')

console.log('\n▸ classement')
await creerCompte(requete, { pseudo: 'Nolan', norm: 'NOLAN', code: '2222' })
await enregistrerScore(requete, { norm: 'NOLAN', code: '2222', score: 300 })
await creerCompte(requete, { pseudo: 'Flo', norm: 'FLO', code: '3333' })
await enregistrerScore(requete, { norm: 'FLO', code: '3333', score: 200 })
await creerCompte(requete, { pseudo: 'Fantome', norm: 'FANTOME', code: '4444' })

const classement = await lireClassement(requete)
verifie(classement.length === 3, 'les joueurs à 0 point n’apparaissent pas', `${classement.length}`)
verifie(classement[0].pseudo === 'Nolan', 'le meilleur est en tête')
verifie(
  classement.map((l) => l.pseudo).join(' > ') === 'Nolan > Flo > Loukian',
  'ordre décroissant',
  classement.map((l) => `${l.pseudo}:${l.record}`).join(' '),
)
verifie(Number(classement[0].record) === 300, 'le record mondial est la première ligne')
verifie((await lireRang(requete, 'NOLAN')) === 1, 'rang de Nolan = 1')
verifie((await lireRang(requete, 'LOUKIAN')) === 3, 'rang de Loukian = 3')

console.log('\n▸ égalité')
await enregistrerScore(requete, { norm: 'FLO', code: '3333', score: 300 })
const exAequo = await lireClassement(requete)
verifie(
  exAequo[0].pseudo === 'Nolan' && exAequo[1].pseudo === 'Flo',
  'à égalité, celui qui y est arrivé en premier reste devant',
  exAequo.map((l) => `${l.pseudo}:${l.record}`).join(' '),
)
verifie((await lireRang(requete, 'FLO')) === 1, 'les ex aequo partagent le rang 1')

await db.close()

console.log(echecs === 0 ? '\n✓ classement : tout est bon' : `\n✗ ${echecs} échec(s)`)
process.exit(echecs === 0 ? 0 : 1)
