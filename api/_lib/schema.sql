-- Une seule table : un joueur, son code, son record.
-- Le classement se déduit de `record`, il n'y a rien d'autre à stocker.

create table if not exists joueurs (
  -- Le pseudo normalisé EST la clé : c'est lui qui garantit qu'on ne peut pas
  -- avoir deux fois le même pseudo, à la casse et aux accents près.
  pseudo_norm text primary key,
  -- Le pseudo tel que le joueur l'a écrit, pour l'afficher.
  pseudo      text        not null,
  -- sha256 du code à 4 chiffres. Ce n'est pas un mot de passe (10 000
  -- possibilités) : ça évite juste de stocker le code en clair.
  code_hash   text        not null,
  record      integer     not null default 0,
  parties     integer     not null default 0,
  cree_le     timestamptz not null default now(),
  maj_le      timestamptz not null default now(),

  constraint record_plausible check (record >= 0 and record <= 20000),
  constraint pseudo_non_vide  check (length(pseudo) between 1 and 12)
);

-- Le plafond valait 2860 (la nourriture seule) avant l'arrivée des objets
-- rares, qui rapportent en plus. Une contrainte existante ne se met pas à jour
-- toute seule : on la remplace.
alter table joueurs drop constraint if exists record_plausible;
alter table joueurs add  constraint record_plausible check (record >= 0 and record <= 20000);

-- Le classement, c'est cette requête et rien d'autre : l'index la rend instantanée.
create index if not exists joueurs_record_idx on joueurs (record desc, maj_le asc);

-- Un code à 4 chiffres, c'est 10 000 possibilités : sans frein, on les essaie
-- toutes en quelques minutes. Au-delà de quelques échecs, le compte se ferme
-- un quart d'heure, ce qui porte l'attaque complète à des centaines d'heures.
alter table joueurs add column if not exists echecs         integer     not null default 0;
alter table joueurs add column if not exists bloque_jusqu_a timestamptz;

-- ------------------------------------------------------------------
-- Un joueur, PLUSIEURS scores.
-- ------------------------------------------------------------------
-- Avant, la table `joueurs` gardait le seul meilleur score de chacun : avec
-- quatre comptes, un tableau de 20 lignes en affichait quatre. Chaque partie
-- laisse maintenant sa ligne ici, et le tableau liste les 20 MEILLEURS SCORES
-- — un même joueur peut donc en occuper plusieurs, comme sur une borne.
-- `joueurs.record` reste tenu à jour : c'est le record personnel affiché en
-- haut de l'écran, et il sert de repli si cette table est vide.
create table if not exists scores (
  id          bigint generated always as identity primary key,
  pseudo_norm text        not null references joueurs (pseudo_norm) on delete cascade,
  score       integer     not null,
  -- Clé d'idempotence fournie par le client : une partie renvoyée deux fois
  -- (file d'attente hors-ligne, réponse perdue) ne s'inscrit qu'une seule fois.
  partie_id   text,
  joue_le     timestamptz not null default now(),

  constraint score_plausible check (score >= 0 and score <= 20000)
);

-- L'unicité ne porte que sur les clés réellement fournies : un vieux client
-- qui n'en envoie pas doit continuer à marcher.
create unique index if not exists scores_partie_id_idx on scores (partie_id) where partie_id is not null;

-- Le classement, c'est cette requête : 20 meilleurs scores, à égalité le plus
-- ancien devant.
create index if not exists scores_meilleurs_idx on scores (score desc, joue_le asc);
create index if not exists scores_joueur_idx    on scores (pseudo_norm, score desc);

-- Les records déjà en base sont nés avant cette table : sans cette reprise ils
-- disparaîtraient du tableau. `partie_id` rend la reprise rejouable.
insert into scores (pseudo_norm, score, partie_id, joue_le)
select pseudo_norm, record, 'record-repris:' || pseudo_norm, maj_le
  from joueurs
 where record > 0
on conflict do nothing;
