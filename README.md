# HEBI 蛇

**En ligne : https://hebi-snake-lebonbentos-projects.vercel.app**

Snake franco-japonais, installable sur iPhone et Android, **jouable hors-ligne**.
Grille 17×17, canvas interpolé à 60 fps, swipes enchaînables, sons WebAudio synthétiques.

Aucun serveur, aucune base de données : le record vit dans le `localStorage` du téléphone.

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

## Contrôles

```bash
npm run build      # doit passer sans erreur ni warning
npm run lint
npm run verifie    # Playwright : iPhone SE + grand écran, sur dist/
npm run verifie https://hebi-snake-lebonbentos-projects.vercel.app   # sur la prod
```

Audit Lighthouse (v11, mobile) : **PWA 100**, performance 99, bonnes pratiques 100.
La v12 de Lighthouse a supprimé la catégorie PWA, il faut donc `lighthouse@11`
pour retrouver `installable-manifest` et `maskable-icon`.

Le mode hors-ligne, lui, n'est pas vérifié par Lighthouse mais par
`npm run verifie`, qui coupe réellement le réseau et recharge la page.

## Ce qui rend le hors-ligne réel

- Les polices (Press Start 2P, Space Grotesk) sont **self-hostées** dans
  `public/fonts`, pas chargées depuis Google Fonts.
- Le service worker précache **tout** : HTML, JS, CSS, polices, icônes.
- Après la première visite, l'app ne fait plus une seule requête réseau.

## Structure

```
public/fonts/            polices woff2 (latin + latin-ext)
public/icons/            PNG générés par npm run icons
scripts/generate-icons.mjs
src/HebiSnake.jsx        le jeu
src/InstallPrompt.jsx    encart « Installer l'app » (Android) / geste iOS
src/index.css            Tailwind, @font-face, safe-areas, blocage du scroll
vite.config.js           React + Tailwind v4 + vite-plugin-pwa (manifest inclus)
```
