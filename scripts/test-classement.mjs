/**
 * Fait tourner la logique du classement sur un vrai Postgres (PGlite, en
 * mémoire) — pas un mock. Les contraintes, les clés et l'anti-doublon des
 * parties réémises sont donc réellement exercés.
 *
 *   npm run test-classement
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import {
  ECHECS_TOLERES,
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
await enregistrerScore(requete, { norm: 'LOUKIAN', code: '1234', score: 120, partie: 'p1' })
const apresBaisse = await enregistrerScore(requete, {
  norm: 'LOUKIAN',
  code: '1234',
  score: 30,
  partie: 'p2',
})
verifie(apresBaisse.joueur.record === 120, 'un score plus faible ne fait pas baisser le record')
verifie(apresBaisse.inscrite === true, 'mais il est bel et bien inscrit au tableau')
const vol = await enregistrerScore(requete, { norm: 'LOUKIAN', code: '0000', score: 9999 })
verifie(!vol.ok && vol.code === 403, "on ne peut pas écrire le score d'un autre sans son code")

const sesScores = await requete('select score from scores where pseudo_norm = $1 order by score', [
  'LOUKIAN',
])
verifie(
  sesScores.map((l) => l.score).join(',') === '30,120',
  'les DEUX parties du même joueur sont gardées',
  sesScores.map((l) => l.score).join(','),
)

console.log('\n▸ réémettre une partie ne l’inscrit pas deux fois')
const rejoue = await enregistrerScore(requete, {
  norm: 'LOUKIAN',
  code: '1234',
  score: 120,
  partie: 'p1',
})
verifie(rejoue.ok && rejoue.inscrite === false, 'même clé de partie : rien de nouveau')

const sansCle = await enregistrerScore(requete, { norm: 'LOUKIAN', code: '1234', score: 120 })
verifie(
  sansCle.inscrite === false,
  'sans clé (vieux client), le même score à la minute près est ignoré',
)

const autrePartie = await enregistrerScore(requete, {
  norm: 'LOUKIAN',
  code: '1234',
  score: 120,
  partie: 'p3',
})
verifie(autrePartie.inscrite === true, 'mais une VRAIE nouvelle partie au même score passe')
await requete(`delete from scores where partie_id = 'p3'`)

const partiesLignes = await requete('select parties from joueurs where pseudo_norm = $1', [
  'LOUKIAN',
])
verifie(
  partiesLignes[0].parties === 3,
  'le compteur de parties ne compte pas les renvois',
  String(partiesLignes[0].parties),
)

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
await enregistrerScore(requete, { norm: 'NOLAN', code: '2222', score: 300, partie: 'n1' })
await creerCompte(requete, { pseudo: 'Flo', norm: 'FLO', code: '3333' })
await enregistrerScore(requete, { norm: 'FLO', code: '3333', score: 200, partie: 'f1' })
await creerCompte(requete, { pseudo: 'Fantome', norm: 'FANTOME', code: '4444' })
await enregistrerScore(requete, { norm: 'FANTOME', code: '4444', score: 0, partie: 'z1' })

const classement = await lireClassement(requete)
verifie(
  classement.length === 4,
  'une ligne par PARTIE, et la partie à 0 point n’y est pas',
  `${classement.length}`,
)
verifie(classement[0].pseudo === 'Nolan', 'le meilleur est en tête')
verifie(
  classement.map((l) => `${l.pseudo}:${l.record}`).join(' > ') ===
    'Nolan:300 > Flo:200 > Loukian:120 > Loukian:30',
  'un même joueur peut occuper plusieurs lignes',
  classement.map((l) => `${l.pseudo}:${l.record}`).join(' '),
)
verifie(Number(classement[0].record) === 300, 'le record mondial est la première ligne')
verifie((await lireRang(requete, 'NOLAN')) === 1, 'rang de Nolan = 1')
verifie((await lireRang(requete, 'LOUKIAN')) === 3, 'le rang, c’est celui de son MEILLEUR score')

console.log('\n▸ trois fois le même joueur en tête')
await enregistrerScore(requete, { norm: 'NOLAN', code: '2222', score: 290, partie: 'n2' })
await enregistrerScore(requete, { norm: 'NOLAN', code: '2222', score: 280, partie: 'n3' })
const podium = await lireClassement(requete)
verifie(
  podium.slice(0, 3).every((l) => l.pseudo === 'Nolan'),
  'les trois meilleurs scores sont à lui, et le tableau les montre tous les trois',
  podium.map((l) => `${l.pseudo}:${l.record}`).join(' '),
)
verifie((await lireRang(requete, 'FLO')) === 4, 'Flo est donc 4ᵉ', String(await lireRang(requete, 'FLO')))

console.log('\n▸ égalité')
await enregistrerScore(requete, { norm: 'FLO', code: '3333', score: 300, partie: 'f2' })
const exAequo = await lireClassement(requete)
verifie(
  exAequo[0].pseudo === 'Nolan' && exAequo[1].pseudo === 'Flo',
  'à égalité, celui qui y est arrivé en premier reste devant',
  exAequo.map((l) => `${l.pseudo}:${l.record}`).join(' '),
)
verifie((await lireRang(requete, 'FLO')) === 1, 'les ex aequo partagent le rang 1')

console.log('\n▸ un score aberrant est refusé par la BASE, même dans l’historique')
let historiqueBorne = false
try {
  await requete('insert into scores (pseudo_norm, score) values ($1, $2)', ['FLO', 999999])
} catch {
  historiqueBorne = true
}
verifie(historiqueBorne, 'la contrainte score_plausible tient aussi sur les parties')

console.log('\n▸ bascule du sel : personne ne perd son compte')
// Un compte créé AVANT la bascule, donc haché avec le sel historique.
delete process.env.HEBI_SEL
await creerCompte(requete, { pseudo: 'Ancien', norm: 'ANCIEN', code: '7777' })
await enregistrerScore(requete, { norm: 'ANCIEN', code: '7777', score: 500, partie: 'a1' })
const [avant] = await requete('select code_hash from joueurs where pseudo_norm = $1', ['ANCIEN'])

// On bascule sur un vrai sel secret.
process.env.HEBI_SEL = 'un-sel-secret-de-test'

const migration = await retrouverCompte(requete, { norm: 'ANCIEN', code: '7777' })
verifie(migration.ok, 'l’ancien code ouvre toujours le compte après la bascule')
verifie(migration.migre === true, 'et il est signalé comme ré-encodé')
verifie(migration.joueur?.record === 500, 'le record est intact', String(migration.joueur?.record))

const [apres] = await requete('select code_hash from joueurs where pseudo_norm = $1', ['ANCIEN'])
verifie(apres.code_hash !== avant.code_hash, 'le hachage stocké a bien changé')

const suivante = await retrouverCompte(requete, { norm: 'ANCIEN', code: '7777' })
verifie(suivante.ok && !suivante.migre, 'la fois d’après, plus besoin de l’ancien sel')
verifie(
  !(await retrouverCompte(requete, { norm: 'ANCIEN', code: '1111' })).ok,
  'un mauvais code reste refusé après la bascule',
)

console.log('\n▸ on ne peut plus essayer les 10 000 codes')
await creerCompte(requete, { pseudo: 'Cible', norm: 'CIBLE', code: '1234' })
let dernier
for (let i = 0; i < ECHECS_TOLERES; i++) {
  dernier = await retrouverCompte(requete, { norm: 'CIBLE', code: '0000' })
}
verifie(dernier.code === 403, `les ${ECHECS_TOLERES} premiers essais sont de simples refus`)

const apresBlocage = await retrouverCompte(requete, { norm: 'CIBLE', code: '0000' })
verifie(apresBlocage.code === 429, 'au-delà, le compte se ferme (429)', String(apresBlocage.code))

const memeAvecLeBon = await retrouverCompte(requete, { norm: 'CIBLE', code: '1234' })
verifie(memeAvecLeBon.code === 429, 'et même le bon code est refusé pendant le blocage')

const scoreBloque = await enregistrerScore(requete, { norm: 'CIBLE', code: '1234', score: 100 })
verifie(scoreBloque.code === 429, 'un compte bloqué ne peut pas non plus écrire de score')

// On rembobine l'horloge pour vérifier que le blocage se lève tout seul.
await requete(`update joueurs set bloque_jusqu_a = now() - interval '1 minute' where pseudo_norm = $1`, [
  'CIBLE',
])
const apresAttente = await retrouverCompte(requete, { norm: 'CIBLE', code: '1234' })
verifie(apresAttente.ok, 'le blocage se lève tout seul, sans intervention')

console.log('\n▸ reprise des records d’avant la table des scores')
// Un compte comme il en existe en production : un record, aucune partie.
await requete(
  `insert into joueurs (pseudo_norm, pseudo, code_hash, record) values ($1, $2, $3, $4)`,
  ['ANCETRE', 'Ancetre', 'peu-importe', 450],
)
await db.exec(readFileSync(resolve(root, 'api/_lib/schema.sql'), 'utf8'))
const repris = await requete('select score from scores where pseudo_norm = $1', ['ANCETRE'])
verifie(repris.length === 1 && repris[0].score === 450, 'son record entre au tableau')

// Le schéma se relance à chaque déploiement : il ne doit pas dupliquer.
await db.exec(readFileSync(resolve(root, 'api/_lib/schema.sql'), 'utf8'))
const deuxFois = await requete('select count(*)::int as n from scores where pseudo_norm = $1', [
  'ANCETRE',
])
verifie(deuxFois[0].n === 1, 'relancer la migration ne le duplique pas', String(deuxFois[0].n))

await db.close()

console.log(echecs === 0 ? '\n✓ classement : tout est bon' : `\n✗ ${echecs} échec(s)`)
process.exit(echecs === 0 ? 0 : 1)
