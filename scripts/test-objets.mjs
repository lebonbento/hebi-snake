/**
 * Les règles des objets rares et de la vitesse, vérifiées sans lancer le jeu.
 *
 *   npm run test-objets
 */
import { KANJI } from '../src/kanji.js'
import {
  BASE_SPEED,
  BONUS_POINTS,
  KANJI_POINTS,
  MIN_SPEED,
  OBJET_CLIGNOTE,
  OBJET_VIE,
  TORTUE_RECUL,
  boucheesAvantPlafond,
  choisirType,
  creerObjet,
  effet,
  estExpire,
  opacite,
  resume,
  vitessePour,
} from '../src/objets.js'

let echecs = 0
const verifie = (ok, libelle, detail = '') => {
  if (ok) console.log(`  ✓ ${libelle}`)
  else {
    echecs++
    console.log(`  ✗ ${libelle}${detail ? ` — ${detail}` : ''}`)
  }
}

console.log('\n▸ la vitesse')
verifie(vitessePour(0) === BASE_SPEED, 'on démarre à la vitesse de base')
verifie(vitessePour(5) < vitessePour(0), 'chaque bouchée accélère')
verifie(vitessePour(10000) === MIN_SPEED, 'la vitesse ne dépasse jamais le plancher')
const plafond = boucheesAvantPlafond()
verifie(
  plafond >= 35,
  `on n'est à fond qu'après ${plafond} bouchées (c'était 24 avant)`,
  `${plafond}`,
)

console.log('\n▸ le tirage des types')
verifie(choisirType(0) === 'tortue' && choisirType(0.39) === 'tortue', 'le bas du tirage : tortue')
verifie(choisirType(0.4) === 'bonus' && choisirType(0.71) === 'bonus', 'le milieu : bonus')
verifie(choisirType(0.72) === 'kanji' && choisirType(0.999) === 'kanji', 'le haut : kanji')
const repartition = { tortue: 0, bonus: 0, kanji: 0 }
for (let i = 0; i < 10000; i++) repartition[choisirType(i / 10000)]++
verifie(
  repartition.tortue > repartition.bonus && repartition.bonus > repartition.kanji,
  'la tortue est la plus fréquente, le kanji le plus rare',
  JSON.stringify(repartition),
)

console.log('\n▸ les effets')
const tortue = creerObjet('tortue', 1, 1, 0)
const apresTortue = effet(tortue, 20)
verifie(apresTortue.bouchees === 20 - TORTUE_RECUL, 'la tortue fait reculer le compteur')
verifie(
  vitessePour(apresTortue.bouchees) > vitessePour(20),
  'et donc le serpent RALENTIT vraiment',
  `${vitessePour(20)} → ${vitessePour(apresTortue.bouchees)} ms`,
)
verifie(apresTortue.points === 0, 'la tortue ne donne pas de points')
verifie(effet(tortue, 2).bouchees === 0, 'elle ne fait jamais passer sous zéro')

const bonus = creerObjet('bonus', 1, 1, 0)
verifie(effet(bonus, 5).points === BONUS_POINTS, `le bonus donne ${BONUS_POINTS} points`)
verifie(effet(bonus, 5).bouchees === 5, 'le bonus ne change pas la vitesse')

const kanji = creerObjet('kanji', 1, 1, 0)
verifie(effet(kanji, 5).points === KANJI_POINTS, `le kanji donne ${KANJI_POINTS} points`)
verifie(
  typeof effet(kanji, 5).texte === 'string' && effet(kanji, 5).texte.length > 0,
  'et fait monter une traduction',
  effet(kanji, 5).texte,
)

console.log('\n▸ tous les points sont des multiples de 10')
// Le serveur refuse tout score qui n'est pas un multiple de 10 : si un objet
// rapportait 25 points, les scores seraient rejetés en silence.
verifie(BONUS_POINTS % 10 === 0 && KANJI_POINTS % 10 === 0, 'sinon l’API rejetterait les scores')

console.log('\n▸ la vie de l’objet')
verifie(!estExpire(creerObjet('bonus', 1, 1, 1000), 1000), 'à peine né, il est là')
verifie(!estExpire(creerObjet('bonus', 1, 1, 0), OBJET_VIE - 1), 'juste avant la fin, encore là')
verifie(estExpire(creerObjet('bonus', 1, 1, 0), OBJET_VIE + 1), 'passé le délai, il s’en va')

const neuf = creerObjet('bonus', 1, 1, 0)
verifie(opacite(neuf, 100) === 1, 'au début il ne clignote pas')
const t = OBJET_VIE - OBJET_CLIGNOTE + 500
let mini = 1
let maxi = 0
for (let d = 0; d < 600; d += 5) {
  const a = opacite(neuf, t + d)
  mini = Math.min(mini, a)
  maxi = Math.max(maxi, a)
}
verifie(maxi - mini > 0.5, 'sur la fin il clignote franchement', `${mini.toFixed(2)} → ${maxi.toFixed(2)}`)
verifie(opacite(neuf, OBJET_VIE) === 0, 'et finit invisible')

console.log('\n▸ la liste de kanji')
verifie(KANJI.length >= 30, `${KANJI.length} kanji disponibles`)
verifie(
  KANJI.every((k) => [...k.c].length === 1),
  'un seul caractère chacun — sinon ça ne tient pas dans une case',
  KANJI.filter((k) => [...k.c].length !== 1)
    .map((k) => k.c)
    .join(' '),
)
verifie(
  KANJI.every((k) => k.fr && k.fr.length <= 12),
  'traductions courtes, pour tenir sur une ligne',
  KANJI.filter((k) => !k.fr || k.fr.length > 12)
    .map((k) => k.c)
    .join(' '),
)
const doublons = KANJI.map((k) => k.c).filter((c, i, t) => t.indexOf(c) !== i)
verifie(doublons.length === 0, 'aucun doublon', doublons.join(' '))
verifie(
  KANJI.some((k) => k.c === '蛇'),
  'le serpent est dans la liste, forcément',
)

console.log('\n▸ le récapitulatif de fin de partie')
verifie(resume([]).length === 0, 'aucun kanji mangé : rien à montrer')
const appris = resume([
  { c: '水', fr: 'eau' },
  { c: '猫', fr: 'chat' },
  { c: '水', fr: 'eau' },
  { c: '水', fr: 'eau' },
])
verifie(appris.length === 2, 'les doublons sont regroupés', `${appris.length}`)
verifie(appris[0].c === '水' && appris[0].fois === 3, '水 compté 3 fois')
verifie(appris[1].c === '猫' && appris[1].fois === 1, '猫 compté 1 fois')
verifie(
  appris.map((k) => k.c).join('') === '水猫',
  'dans l’ordre où on les a rencontrés',
  appris.map((k) => k.c).join(''),
)
verifie(appris.every((k) => k.fr), 'chacun garde sa traduction')
verifie(resume([null, undefined, { fr: 'sans caractère' }]).length === 0, 'les entrées vides sont ignorées')

console.log(echecs === 0 ? '\n✓ objets : tout est bon' : `\n✗ ${echecs} échec(s)`)
process.exit(echecs === 0 ? 0 : 1)
