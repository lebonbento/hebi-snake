# HEBI 蛇

**En ligne : https://hebi-snake.vercel.app**

Snake franco-japonais, installable sur iPhone et Android, **jouable hors-ligne**.
Grille 17×17, canvas interpolé à 60 fps, swipes enchaînables, sons WebAudio synthétiques.

Le jeu lui-même ne dépend de rien : ton record vit dans le `localStorage` du
téléphone et la partie tourne en mode avion. Seul le **classement mondial**
parle à un serveur, et son absence n'empêche jamais de jouer.

## Lancer en local

```bash
npm install
npm run dev
```

Le service worker est actif en dev (`devOptions.enabled`), ce qui permet de tester
le mode hors-ligne sans passer par un build : couper le réseau dans les DevTools
et recharger.

## Builder

```bash
npm run build      # → dist/
npm run preview    # sert dist/ en local, sur le vrai service worker
```

## Icônes

Les PNG ne sont pas édités à la main, ils sont **générés** :

```bash
npm run icons
```

Le script construit un SVG (kanji 蛇 blanc sur disque rouge, fond encre) et le
rasterise en 192, 512, maskable 512 et apple-touch-icon 180. Le kanji est un
tracé vectoriel extrait de Noto Sans JP (OFL), pas un `<text>` : l'icône ne
dépend d'aucune police installée.

## Déployer

Le dépôt est relié au projet Vercel `hebi-snake` : chaque push sur `main`
déploie en production.

```bash
git push
```

⚠️ La protection « Vercel Authentication » est **désactivée** sur ce projet.
C'est indispensable : activée (c'est le défaut sur les nouveaux projets), elle
renvoie un 302 vers la page de connexion Vercel pour tout le monde, et l'app
devient impossible à installer sur un téléphone.

## Le jeu

Nourriture 🍙 = 10 points. Ça accélère à chaque bouchée, mais plus doucement
qu'avant : le plafond de vitesse n'arrive qu'après 38 bouchées, contre 24
auparavant — au-delà de 240 points, toute la partie se jouait à fond.

Trois **objets rares** apparaissent de temps en temps, un seul à la fois. Ils
vivent 7 secondes, clignotent de plus en plus vite sur la fin, puis s'en vont.

| Objet | Effet |
|---|---|
| 🐢 | Fait reculer le compteur de 6 bouchées : le serpent **ralentit pour de bon**, ce n'est pas une pause |
| ⭐ | +50 points |
| 漢 | +20 points, et la traduction du kanji monte à l'écran comme un fantôme |

Les 41 kanji sont dans `src/kanji.js` : un seul caractère chacun, parce qu'une
case fait 15 à 20 px — 猫 y tient, ねこ non.

À la fin de la partie, l'écran affiche **« TU AS APPRIS »** avec les kanji
ramassés, regroupés et comptés. Sans ça, la traduction s'efface en une seconde
et demie au milieu de l'action : joli, mais on n'en retient rien.

⚠️ Tous les gains doivent rester des **multiples de 10** : l'API rejette les
scores qui n'en sont pas. Et le plafond de plausibilité (`SCORE_MAX`) tient
compte des objets, sinon les bons scores seraient refusés en silence.

## Le classement

Un joueur = un pseudo unique + un code à 4 chiffres. Le code n'est pas un mot de
passe : il sert à retrouver son nom sur un autre téléphone, et à empêcher
d'écrire un score sous le nom de quelqu'un d'autre. Il est stocké haché.

Le nom n'est demandé qu'à la fin d'une partie **qui entre dans le top 20**,
comme sur une borne. Le reste du temps on joue sans rien saisir.

### Plusieurs joueurs sur le même téléphone

Un téléphone de famille sert à deux enfants. L'appareil garde donc une **liste**
de joueurs (`hebi-joueurs` dans `localStorage`), pas un seul compte : chacun a
son nom, son code, **son record** et sa file d'attente. Le nom dans l'en-tête
ouvre « QUI JOUE ? » : on bascule d'un tap, sans retaper le code — sur ce
téléphone-là, la preuve a déjà été faite une fois. Le code n'est exigé que pour
**ajouter** un joueur à l'appareil.

Trois conséquences, et c'est tout l'intérêt :

- le **record affiché suit le nom**, pas l'appareil — le petit frère n'hérite
  plus du record du grand ;
- un score fait hors-ligne est mis en attente **sur son auteur**, jamais réémis
  au nom de celui qui joue ensuite ;
- si une partie finit alors que personne n'est désigné, le jeu demande
  « c'est qui ? » au lieu de deviner.

Retirer un joueur ne touche ni son compte ni ses scores : il revient avec son
code. Et le mode silence (🔊), lui, appartient à l'appareil — pas au joueur :
c'est une propriété du lieu, il coupe le son **et la vibration**, et il est retenu.

- `GET  /api/classement` → les 20 meilleurs + le record mondial
- `POST /api/compte` → `{ action: 'creer' | 'retrouver', pseudo, code }`
- `POST /api/score` → `{ pseudo, code, score }`, ne garde que le meilleur

**Le jeu reste jouable hors-ligne.** Seul le classement demande le réseau : s'il
est injoignable, la partie se déroule normalement et le score est mis en file,
réémis au retour du réseau. Comme le serveur ne retient que le meilleur score,
réémettre deux fois la même partie est sans conséquence.

Garde-fous contre les scores fantaisistes : le score doit être un multiple de 10,
positif, et sous le maximum théorique du plateau (2860 = 286 bouchées × 10). La
contrainte est posée **dans la base**, pas seulement dans le code. Ça reste un jeu
public sans authentification forte : quelqu'un de déterminé peut envoyer un score
qu'il n'a pas fait, dans la limite du plafond.

### Base

Neon Postgres, une seule table (`api/_lib/schema.sql`). L'unicité des pseudos est
tenue par la **clé primaire** sur le pseudo normalisé — accents et casse
confondus — et pas par un `select` préalable qui laisserait passer deux
inscriptions simultanées.

```bash
DATABASE_URL='postgres://…' npm run migrate
```

## Contrôles

```bash
npm run build      # doit passer sans erreur ni warning
npm run lint
npm run verifie          # Playwright : iPhone SE + grand écran, sur dist/
npm run verifie <url>    # ... ou sur la prod
npm run test-objets      # vitesse, objets rares, liste de kanji
npm run test-classement  # logique du classement sur un vrai Postgres (PGlite)
npm run test-parcours    # parcours joueur complet : jouer → mourir → nom → tableau
npm run test-joueurs     # deux enfants, un téléphone : bascule, records, attribution
npm run local            # dist/ + les routes /api sur un Postgres en mémoire
```

`npm run local` et `npm run test-parcours` font tourner **les mêmes fichiers**
`api/*.js` que ceux déployés, sur un Postgres local : pas de Neon, pas de réseau,
pas de Vercel, et pourtant c'est bien le code de production qui est exercé.

Audit Lighthouse (v11, mobile) : **PWA 100**, performance 99, bonnes pratiques 100.
La v12 de Lighthouse a supprimé la catégorie PWA, il faut donc `lighthouse@11`
pour retrouver `installable-manifest` et `maskable-icon`.

Le mode hors-ligne, lui, n'est pas vérifié par Lighthouse mais par
`npm run verifie`, qui coupe réellement le réseau et recharge la page.

## Ce qui rend le hors-ligne réel

- Les polices (Press Start 2P, Space Grotesk) sont **self-hostées** dans
  `public/fonts`, pas chargées depuis Google Fonts.
- Le service worker précache **tout** : HTML, JS, CSS, polices, icônes.
- Après la première visite, **jouer** ne déclenche plus aucune requête. Les seuls
  appels réseau vont à `/api`, pour le classement, et ils échouent sans bruit.

## Licence et crédits

Le code est sous **MIT** (voir `LICENSE`) : reprenez-le, modifiez-le, vendez-le.

Le jeu ne contient **aucun son ni aucune image** : les bips sont synthétisés en
WebAudio, la nourriture ce sont des emoji rendus par le système. Rien à créditer
de ce côté.

Trois polices, toutes sous **SIL Open Font License 1.1**. Leur licence et leur
mention de copyright sont livrées à côté des fichiers, dans `public/fonts/` —
c'est ce que l'OFL exige, et ça doit rester vrai si vous redistribuez le projet.

| Police | Auteur | Usage |
|---|---|---|
| [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) | The Press Start 2P Project Authors | titres et chiffres, le pixel des bornes |
| [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) | The Space Grotesk Project Authors | texte courant |
| [Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP) | Adobe | le tracé du kanji 蛇 des icônes en est extrait |

Le kanji des icônes n'est pas un fichier de police embarqué : c'est un **contour
vectoriel** extrait de Noto Sans JP par `scripts/generate-icons.mjs`. L'OFL
autorise ce dérivé ; c'est à ce titre que sa licence est incluse.

Le motif de vagues en bas d'écran est un **seigaiha** (青海波), motif traditionnel
japonais, redessiné en CSS.

Quant au jeu lui-même : le principe du serpent qui s'allonge remonte à *Blockade*
(Gremlin, 1976), vingt ans avant Nokia. Des règles de jeu ne se protègent pas —
seule une expression le peut. HEBI n'emprunte ni code, ni graphisme, ni nom.

## Structure

```
api/classement.js        GET  : les 20 meilleurs + le record mondial
api/compte.js            POST : créer ou retrouver un pseudo
api/score.js             POST : enregistrer un score
api/_lib/logique.js      validation + requêtes (le « _ » exclut le dossier des routes)
api/_lib/schema.sql      la table, et les contraintes qui tiennent les scores
api/_lib/db.js           connexion Neon, et la couture qui permet de tester en local
public/fonts/            polices woff2 (latin + latin-ext) + leurs licences OFL
public/icons/            PNG générés par npm run icons
src/HebiSnake.jsx        le jeu
src/objets.js            règles des objets rares et de la vitesse (pures, testables)
src/kanji.js             les 41 kanji et leurs traductions
src/Classement.jsx       le tableau des meilleurs scores
src/SaisieNom.jsx        l'écran « ENTREZ VOTRE NOM »
src/Joueurs.jsx          « QUI JOUE ? » : les joueurs de CE téléphone
src/api.js               client du classement + joueurs de l'appareil + file d'attente
src/InstallPrompt.jsx    encart « Installer l'app » (Android) / geste iOS
src/index.css            Tailwind, @font-face, safe-areas, blocage du scroll
vite.config.js           React + Tailwind v4 + vite-plugin-pwa (manifest inclus)
```
