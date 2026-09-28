-- ============================================================================================
-- AGRIAGENT — TABLE ALERTES
-- Version : 1.0 — 2026-09-27
-- Objet : conserver les alertes générées par l'AlertAgent pour un suivi actionnable.
-- ============================================================================================

create table if not exists alertes (
    id                     uuid primary key default gen_random_uuid(),
    culture_id             uuid not null references cultures (id) on delete cascade,
    parcelle_id            uuid references parcelles (id) on delete cascade,
    alerte_le              timestamptz not null default now(),
    type_alerte            text not null,
    niveau                 text not null,
    message                text not null,
    action_recommandee     text,
    donnees_declenchantes  jsonb not null default '{}'::jsonb,
    traitee                boolean not null default false,
    traitee_le             timestamptz,
    traitee_par            text,
    notes_traitement       text,
    saisi_par              text not null default 'agent',
    cree_le                timestamptz not null default now(),
    maj_le                 timestamptz not null default now(),
    constraint alertes_type_valide check (type_alerte in (
        'progression_maladie', 'delai_recolte', 'meteo_risque', 'rappel_visite',
        'traitement_manquant', 'observation_manquante', 'autre'
    )),
    constraint alertes_niveau_valide check (niveau in (
        'faible', 'moyen', 'eleve', 'critique'
    ))
);

-- Index pour les lectures fréquentes
create index if not exists idx_alertes_culture       on alertes (culture_id, alerte_le desc);
create index if not exists idx_alertes_parcelle      on alertes (parcelle_id, alerte_le desc);
create index if not exists idx_alertes_non_traitees  on alertes (traitee, niveau) where traitee = false;
create index if not exists idx_alertes_type          on alertes (type_alerte);

-- Trigger maj_le
drop trigger if exists trg_alertes_maj on alertes;
create trigger trg_alertes_maj before update on alertes
    for each row execute function maj_horodatage();

-- RLS
alter table alertes enable row level security;

comment on table alertes is
    'Alertes générées par l''AlertAgent. RLS activée sans politique permissive : '
    'accès uniquement via le service role (agents authentifiés).';
