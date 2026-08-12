import { useState, useEffect, useRef, useCallback } from "react";
import Classement from "./Classement.jsx";
import SaisieNom from "./SaisieNom.jsx";
import {
  envoyerScore,
  lireClassement,
  lireCompte,
  oublierCompte,
  scoreEnAttente,
  viderFile,
} from "./api.js";

const TAILLE_CLASSEMENT = 20;

/* ── HEBI 蛇 — le snake franco-japonais ──
   Swipe pour diriger · flèches / ZQSD · espace = pause
   Record : localStorage ("hebi-best").
   Polices : Press Start 2P + Space Grotesk self-hostées via @font-face global. */

const COLS = 17;
const ROWS = 17;
const BASE_SPEED = 160; // ms par case
const MIN_SPEED = 65;
const FOODS = ["🍙", "🍣", "🍡", "🍤", "🍥"];

const lerp = (a, b, t) => a + (b - a) * t;

export default function HebiSnake() {
  const canvasRef = useRef(null);
  const boxRef = useRef(null);

  const [phase, setPhase] = useState("idle"); // idle | play | pause | over
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [muted, setMuted] = useState(false);

  // Classement
  const [compte, setCompte] = useState(null);
  const [mondial, setMondial] = useState(0);
  const [lignes, setLignes] = useState([]);
  const [chargeClassement, setChargeClassement] = useState(true);
  const [erreurClassement, setErreurClassement] = useState(false);
  const [voirClassement, setVoirClassement] = useState(false);
  const [demandeNom, setDemandeNom] = useState(false);
  const [rang, setRang] = useState(null);

  // état du jeu en refs (boucle canvas sans re-render)
  const phaseRef = useRef("idle");
  const mutedRef = useRef(false);
  const bestRef = useRef(0);
  const sizeRef = useRef(320);
  const snakeRef = useRef([]);
  const prevRef = useRef([]);
  const dirRef = useRef({ x: 1, y: 0 });
  const queueRef = useRef([]);
  const foodRef = useRef({ x: 12, y: 8, icon: "🍙" });
  const eatenRef = useRef(0);
  const scoreRef = useRef(0);
  const speedRef = useRef(BASE_SPEED);
  const lastTickRef = useRef(0);
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const touchRef = useRef(null);

  const setPhase2 = (p) => {
    phaseRef.current = p;
    setPhase(p);
  };

  /* ── audio : petits blips synthétiques ── */
  const audio = () => {
    if (!audioRef.current) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audioRef.current = new AC();
      } catch {}
    }
    return audioRef.current;
  };
  const tone = (f0, f1, dur, type, vol = 0.05) => {
    if (mutedRef.current) return;
    const a = audio();
    if (!a) return;
    try {
      if (a.state === "suspended") a.resume();
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, a.currentTime);
      o.frequency.exponentialRampToValueAtTime(Math.max(40, f1), a.currentTime + dur);
      g.gain.setValueAtTime(vol, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
      o.connect(g);
      g.connect(a.destination);
      o.start();
      o.stop(a.currentTime + dur);
    } catch {}
  };
  const vib = (ms) => {
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch {}
  };

  /* ── logique ── */
  const placeFood = (snake) => {
    let x, y;
    do {
      x = (Math.random() * COLS) | 0;
      y = (Math.random() * ROWS) | 0;
    } while (snake.some((s) => s.x === x && s.y === y));
    foodRef.current = { x, y, icon: FOODS[(Math.random() * FOODS.length) | 0] };
  };

  const reset = () => {
    const cy = (ROWS / 2) | 0;
    snakeRef.current = [
      { x: 5, y: cy },
      { x: 4, y: cy },
      { x: 3, y: cy },
    ];
    prevRef.current = snakeRef.current.map((s) => ({ ...s }));
    dirRef.current = { x: 1, y: 0 };
    queueRef.current = [];
    eatenRef.current = 0;
    scoreRef.current = 0;
    speedRef.current = BASE_SPEED;
    setScore(0);
    setNewBest(false);
    placeFood(snakeRef.current);
  };

  const nextDir = () => {
    const q = queueRef.current;
    while (q.length) {
      const d = q.shift();
      if (!(d.x === -dirRef.current.x && d.y === -dirRef.current.y)) {
        dirRef.current = d;
        break;
      }
    }
    return dirRef.current;
  };

  const pushDir = (d) => {
    if (phaseRef.current !== "play") return;
    const q = queueRef.current;
    const last = q.length ? q[q.length - 1] : dirRef.current;
    if (d.x === last.x && d.y === last.y) return;
    if (d.x === -last.x && d.y === -last.y) return;
    if (q.length < 3) q.push(d);
  };

  const die = () => {
    setPhase2("over");
    clearTimeout(timerRef.current);
    tone(300, 60, 0.4, "sawtooth", 0.06);
    vib(80);
    if (scoreRef.current > bestRef.current) {
      bestRef.current = scoreRef.current;
      setBest(scoreRef.current);
      setNewBest(true);
      try {
        localStorage.setItem("hebi-best", String(scoreRef.current));
      } catch {}
    }
  };

  const step = () => {
    const dir = nextDir();
    const body = snakeRef.current;
    prevRef.current = body.map((s) => ({ ...s }));
    const head = body[0];
    const nx = head.x + dir.x;
    const ny = head.y + dir.y;
    const f = foodRef.current;
    const eats = nx === f.x && ny === f.y;
    const hitWall = nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS;
    const hitSelf = body.some(
      (s, i) => (eats || i < body.length - 1) && s.x === nx && s.y === ny
    );
    if (hitWall || hitSelf) {
      die();
      return;
    }
    const ns = [{ x: nx, y: ny }, ...body];
    if (eats) {
      eatenRef.current += 1;
      scoreRef.current += 10;
      setScore(scoreRef.current);
      speedRef.current = Math.max(MIN_SPEED, BASE_SPEED - eatenRef.current * 4);
      placeFood(ns);
      tone(420 + eatenRef.current * 14, 660 + eatenRef.current * 14, 0.09, "square");
      vib(12);
    } else {
      ns.pop();
    }
    snakeRef.current = ns;
  };

  const tick = () => {
    if (phaseRef.current !== "play") return;
    step();
    if (phaseRef.current !== "play") return;
    lastTickRef.current = performance.now();
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(tick, speedRef.current);
  };

  const start = () => {
    if (phaseRef.current === "play") return;
    const a = audio();
    if (a && a.state === "suspended") a.resume();
    tone(330, 660, 0.12, "triangle");
    reset();
    setPhase2("play");
    lastTickRef.current = performance.now();
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(tick, speedRef.current);
  };

  const pauseGame = () => {
    if (phaseRef.current !== "play") return;
    clearTimeout(timerRef.current);
    setPhase2("pause");
  };

  const resumeGame = () => {
    if (phaseRef.current !== "pause") return;
    setPhase2("play");
    lastTickRef.current = performance.now();
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(tick, speedRef.current);
  };

  /* ── record persistant ── */
  useEffect(() => {
    try {
      const v = parseInt(localStorage.getItem("hebi-best") || "0", 10) || 0;
      bestRef.current = v;
      setBest(v);
    } catch {}
  }, []);

  /* ── classement ──
     Tout ce qui suit peut échouer sans conséquence : le jeu tourne pareil
     hors-ligne, seul le tableau des scores reste vide. */

  const rafraichirClassement = useCallback(async () => {
    try {
      const { classement, mondial: record } = await lireClassement();
      setLignes(classement);
      setMondial(record);
      setErreurClassement(false);
    } catch {
      setErreurClassement(true);
    } finally {
      setChargeClassement(false);
    }
  }, []);

  useEffect(() => {
    setCompte(lireCompte());
    rafraichirClassement();
    // Un score fait dans le métro part dès que le réseau revient.
    if (scoreEnAttente()) viderFile().then((j) => j && appliqueJoueur(j));
    const auRetour = () => viderFile().then((j) => j && appliqueJoueur(j));
    window.addEventListener("online", auRetour);
    return () => window.removeEventListener("online", auRetour);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const appliqueJoueur = (joueur) => {
    if (!joueur) return;
    // Le serveur fait autorité : il connaît aussi les parties des autres appareils.
    if (joueur.record > bestRef.current) {
      bestRef.current = joueur.record;
      setBest(joueur.record);
      try {
        localStorage.setItem("hebi-best", String(joueur.record));
      } catch {}
    }
    if (joueur.rang) setRang(joueur.rang);
  };

  /** Le score entre-t-il au tableau ? Sert à ne demander le nom que si ça vaut le coup. */
  const entreAuClassement = (s) =>
    s > 0 &&
    (lignes.length < TAILLE_CLASSEMENT || s > lignes[lignes.length - 1].record);

  useEffect(() => {
    if (phase !== "over") return;
    const s = scoreRef.current;
    if (s <= 0) return;

    let abandonne = false;
    (async () => {
      if (lireCompte()) {
        const joueur = await envoyerScore(s);
        if (abandonne) return;
        appliqueJoueur(joueur);
        rafraichirClassement();
      } else if (entreAuClassement(s)) {
        setDemandeNom(true);
      }
    })();
    return () => {
      abandonne = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const nomValide = async (joueur) => {
    setCompte(lireCompte());
    setDemandeNom(false);
    appliqueJoueur(joueur);
    appliqueJoueur(await envoyerScore(scoreRef.current));
    rafraichirClassement();
  };

  const ouvrirClassement = () => {
    if (phaseRef.current === "play") pauseGame();
    setVoirClassement(true);
    rafraichirClassement();
  };

  /* ── plateau visible dès l'accueil ── */
  useEffect(() => {
    reset();
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── clavier : flèches, ZQSD, WASD, espace, entrée ── */
  useEffect(() => {
    const onKey = (e) => {
      // Quand on tape son nom, Z/Q/S/D sont des LETTRES, pas des directions.
      const cible = e.target;
      if (cible && (cible.tagName === "INPUT" || cible.tagName === "TEXTAREA")) return;

      const k = e.key.toLowerCase();
      const map = {
        arrowup: { x: 0, y: -1 },
        z: { x: 0, y: -1 },
        w: { x: 0, y: -1 },
        arrowdown: { x: 0, y: 1 },
        s: { x: 0, y: 1 },
        arrowleft: { x: -1, y: 0 },
        q: { x: -1, y: 0 },
        a: { x: -1, y: 0 },
        arrowright: { x: 1, y: 0 },
        d: { x: 1, y: 0 },
      };
      if (map[k]) {
        e.preventDefault();
        pushDir(map[k]);
      } else if (k === " ") {
        e.preventDefault();
        if (phaseRef.current === "play") pauseGame();
        else if (phaseRef.current === "pause") resumeGame();
      } else if (k === "enter") {
        if (phaseRef.current === "idle" || phaseRef.current === "over") start();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── onglet masqué → pause auto ── */
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && phaseRef.current === "play") pauseGame();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── bloquer le scroll pendant les swipes ── */
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const block = (e) => {
      if (phaseRef.current === "play") e.preventDefault();
    };
    el.addEventListener("touchmove", block, { passive: false });
    return () => el.removeEventListener("touchmove", block);
  }, []);

  /* ── taille du canvas ──
     PWA : le plateau est borné par la LARGEUR *et* par la hauteur restante,
     sinon il déborde sous la barre d'accueil d'un iPhone SE. */
  useEffect(() => {
    const el = boxRef.current;
    const cv = canvasRef.current;
    if (!el || !cv) return;
    const fit = () => {
      const dispo = Math.min(el.clientWidth, el.clientHeight || Infinity);
      if (!dispo || dispo === Infinity) return;
      const w = Math.min(dispo, 420);
      const dpr = window.devicePixelRatio || 1;
      sizeRef.current = w;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(w * dpr);
      cv.style.width = w + "px";
      cv.style.height = w + "px";
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ── rendu canvas 60 fps avec interpolation ── */
  useEffect(() => {
    let raf;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const cv = canvasRef.current;
      if (!cv) return;
      const ctx = cv.getContext("2d");
      const s = sizeRef.current;
      const cell = s / COLS;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // fond + damier discret
      ctx.fillStyle = "#11111b";
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = "#151523";
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if ((x + y) % 2 === 0) ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }

      const now = performance.now();

      // nourriture (pulsation douce)
      const f = foodRef.current;
      const pulse = 1 + 0.07 * Math.sin(now / 180);
      ctx.font = `${cell * 0.82 * pulse}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(f.icon, (f.x + 0.5) * cell, (f.y + 0.56) * cell);

      // serpent interpolé
      const cur = snakeRef.current;
      if (cur.length) {
        const prev = prevRef.current.length ? prevRef.current : cur;
        const p =
          phaseRef.current === "play"
            ? Math.min(1, (now - lastTickRef.current) / speedRef.current)
            : 1;
        const pts = cur.map((seg, i) => {
          const pr = prev[Math.min(i, prev.length - 1)];
          return {
            x: (lerp(pr.x, seg.x, p) + 0.5) * cell,
            y: (lerp(pr.y, seg.y, p) + 0.5) * cell,
          };
        });
        const tail = pts[pts.length - 1];
        const g = ctx.createLinearGradient(pts[0].x, pts[0].y, tail.x, tail.y);
        g.addColorStop(0, "#86efac");
        g.addColorStop(0.5, "#34d399");
        g.addColorStop(1, "#0d9488");
        ctx.strokeStyle = g;
        ctx.lineWidth = cell * 0.72;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        pts.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
        ctx.stroke();

        // tête + yeux
        const h = pts[0];
        ctx.fillStyle = "#bbf7d0";
        ctx.beginPath();
        ctx.arc(h.x, h.y, cell * 0.42, 0, Math.PI * 2);
        ctx.fill();
        const d = dirRef.current;
        const ex = d.y * 0.16 * cell;
        const ey = d.x * 0.16 * cell;
        const fx = d.x * 0.12 * cell;
        const fy = d.y * 0.12 * cell;
        ctx.fillStyle = "#052e16";
        ctx.beginPath();
        ctx.arc(h.x + fx + ex, h.y + fy + ey, cell * 0.075, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(h.x + fx - ex, h.y + fy - ey, cell * 0.075, 0, Math.PI * 2);
        ctx.fill();
      }

      // liseré intérieur
      ctx.strokeStyle = "#262640";
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, s - 1, s - 1);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ── tactile : swipes enchaînables ── */
  const onTouchStart = (e) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchMove = (e) => {
    if (phaseRef.current !== "play" || !touchRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - touchRef.current.x;
    const dy = t.clientY - touchRef.current.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    const d =
      Math.abs(dx) > Math.abs(dy)
        ? { x: Math.sign(dx), y: 0 }
        : { x: 0, y: Math.sign(dy) };
    pushDir(d);
    touchRef.current = { x: t.clientX, y: t.clientY };
  };

  const toggleMute = () => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
  };

  /* ── UI ── */
  const px = "'Press Start 2P', monospace";
  const seigaiha = {
    backgroundImage:
      "radial-gradient(circle at 12px 26px, transparent 8px, rgba(94,234,212,.20) 8.5px 10px, transparent 10.5px 15px, rgba(94,234,212,.13) 15.5px 17px, transparent 17.5px 22px, rgba(94,234,212,.08) 22.5px 24px, transparent 24.5px), radial-gradient(circle at 12px 26px, transparent 8px, rgba(94,234,212,.20) 8.5px 10px, transparent 10.5px 15px, rgba(94,234,212,.13) 15.5px 17px, transparent 17.5px 22px, rgba(94,234,212,.08) 22.5px 24px, transparent 24.5px)",
    backgroundSize: "24px 26px, 24px 26px",
    backgroundPosition: "0 0, 12px 13px",
  };
  const overlayBox = {
    background: "rgba(10,10,16,0.78)",
    border: "1px solid #23233a",
  };
  const redBtn = {
    fontFamily: px,
    fontSize: 11,
    background: "#dc2626",
    color: "#fff",
    boxShadow: "0 6px 24px rgba(220,38,38,.35)",
    letterSpacing: 1,
  };
  const iconBtn = {
    background: "#1c1c2a",
    border: "1px solid #2d2d3f",
    fontSize: 15,
    lineHeight: 1,
  };

  return (
    <div
      /* PWA : h-full plutôt que min-h-screen — la hauteur est déjà celle de
         #root, safe-areas déduites. */
      className="h-full w-full flex flex-col items-center select-none overflow-hidden"
      style={{
        background: "#0b0b12",
        color: "#e2e8f0",
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
      }}
    >

      <div className="w-full max-w-md px-4 pt-5 pb-8 flex flex-col items-center flex-1 min-h-0">
        {/* en-tête */}
        <div className="w-full flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <span
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background: "#dc2626",
                boxShadow: "0 0 22px rgba(220,38,38,.45)",
              }}
            >
              <span
                style={{
                  color: "#fff",
                  fontSize: 20,
                  fontFamily: "'Hiragino Mincho ProN','Yu Mincho',serif",
                }}
              >
                蛇
              </span>
            </span>
            <div>
              <div style={{ fontFamily: px, fontSize: 16, letterSpacing: 2, color: "#f1f5f9" }}>
                HEBI
              </div>
              {compte ? (
                <button
                  onClick={() => {
                    oublierCompte();
                    setCompte(null);
                    setRang(null);
                  }}
                  title="Se déconnecter de ce nom"
                  className="text-xs uppercase active:opacity-60"
                  style={{ color: "#a7f3d0" }}
                >
                  {compte.pseudo}
                  {rang ? ` · ${rang}ᵉ` : ""}
                </button>
              ) : (
                <div className="text-xs" style={{ color: "#7c8299" }}>
                  « hé-bi » · le snake franco-japonais
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              aria-label="Classement"
              onClick={ouvrirClassement}
              className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition"
              style={iconBtn}
            >
              🏆
            </button>
            <button
              aria-label={muted ? "Activer le son" : "Couper le son"}
              onClick={toggleMute}
              className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition"
              style={iconBtn}
            >
              {muted ? "🔇" : "🔊"}
            </button>
            {phase === "play" && (
              <button
                aria-label="Pause"
                onClick={pauseGame}
                className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition"
                style={iconBtn}
              >
                ⏸
              </button>
            )}
          </div>
        </div>

        {/* scores : le tien, et celui à battre */}
        <div className="w-full flex gap-2 mb-3 shrink-0">
          {[
            { titre: "SCORE", valeur: score, couleur: "#a7f3d0" },
            { titre: "RECORD", valeur: best, couleur: "#fbbf24" },
            { titre: "MONDIAL", valeur: mondial, couleur: "#f87171" },
          ].map(({ titre, valeur, couleur }) => (
            <div
              key={titre}
              className="flex-1 min-w-0 rounded-xl px-2 py-2"
              style={{ background: "#15151f", border: "1px solid #232337" }}
            >
              <div style={{ fontFamily: px, fontSize: 6, color: "#7c8299", letterSpacing: 1 }}>
                {titre}
              </div>
              <div style={{ fontFamily: px, fontSize: 14, color: couleur, marginTop: 6 }}>
                {valeur}
              </div>
            </div>
          ))}
        </div>

        {/* plateau — flex-1 : il prend la place qui reste, et pas un pixel de plus */}
        <div
          ref={boxRef}
          className="hebi-board relative w-full flex-1 min-h-0 flex items-center justify-center"
          style={{ touchAction: "none" }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onContextMenu={(e) => e.preventDefault()}
        >
          <canvas
            ref={canvasRef}
            className={`block rounded-2xl ${phase === "over" ? "hebi-shake" : ""}`}
          />

          {phase !== "play" && !demandeNom && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="rounded-2xl px-6 py-6 text-center backdrop-blur-sm flex flex-col items-center gap-4"
                style={overlayBox}
              >
                {phase === "idle" && (
                  <>
                    <div style={{ fontFamily: px, fontSize: 13, color: "#f1f5f9" }}>
                      PRÊT ?
                    </div>
                    <div className="text-sm" style={{ color: "#9aa1b8" }}>
                      Attrape les onigiri 🍙 = 10 pts
                      <br />
                      Ça accélère à chaque bouchée.
                    </div>
                    <button
                      onClick={start}
                      className="rounded-full px-6 py-3 active:scale-95 transition"
                      style={redBtn}
                    >
                      ▶ JOUER
                    </button>
                  </>
                )}
                {phase === "pause" && (
                  <>
                    <div style={{ fontFamily: px, fontSize: 13, color: "#f1f5f9" }}>
                      PAUSE
                    </div>
                    <button
                      onClick={resumeGame}
                      className="rounded-full px-6 py-3 active:scale-95 transition"
                      style={redBtn}
                    >
                      ▶ REPRENDRE
                    </button>
                  </>
                )}
                {phase === "over" && !demandeNom && (
                  <>
                    <div style={{ fontFamily: px, fontSize: 13, color: "#f87171" }}>
                      GAME OVER
                    </div>
                    <div style={{ fontFamily: px, fontSize: 24, color: "#a7f3d0" }}>
                      {score}
                    </div>
                    {newBest ? (
                      <div style={{ fontFamily: px, fontSize: 9, color: "#fbbf24" }}>
                        ★ NOUVEAU RECORD ★
                      </div>
                    ) : (
                      <div className="text-xs" style={{ color: "#9aa1b8" }}>
                        Record : {best}
                      </div>
                    )}
                    <button
                      onClick={start}
                      className="rounded-full px-6 py-3 active:scale-95 transition"
                      style={redBtn}
                    >
                      ↻ REJOUER
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* aide */}
        <p className="text-xs text-center mt-3 shrink-0" style={{ color: "#6b7189" }}>
          Swipe pour diriger · ⌨️ flèches ou ZQSD · espace = pause
        </p>

        {/* vagues seigaiha */}
        <div className="w-full h-12 mt-5 rounded-xl overflow-hidden shrink-0" style={seigaiha} />
      </div>

      {/* « ENTREZ VOTRE NOM » : plein écran, parce que le formulaire est plus
          haut que le plateau sur un petit téléphone, clavier ouvert en plus. */}
      {demandeNom && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-[#0a0a10]/97 backdrop-blur-sm"
          style={{
            paddingTop: "env(safe-area-inset-top)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          <div className="flex min-h-full items-center justify-center px-5 py-8">
            <SaisieNom
              score={score}
              rang={entreAuClassement(score) ? null : rang}
              onFini={nomValide}
              onAnnule={() => setDemandeNom(false)}
            />
          </div>
        </div>
      )}

      {voirClassement && (
        <Classement
          lignes={lignes}
          moi={compte?.pseudo}
          chargement={chargeClassement}
          erreur={erreurClassement}
          onFermer={() => setVoirClassement(false)}
        />
      )}
    </div>
  );
}
