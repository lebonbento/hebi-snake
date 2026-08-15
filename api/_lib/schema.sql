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
