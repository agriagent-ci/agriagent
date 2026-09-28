-- ============================================================================================
-- AGRIAGENT — SCHÉMA DE DONNÉES DE L'EXPLOITATION
-- Cible : PostgreSQL / Supabase
-- Version : 1.0 — 2026-09-22
-- ============================================================================================

-- 0. EXTENSIONS
create extension if not exists pgcrypto;

-- 1. AGRICULTEURS
create table if not exists agriculteurs (
    id                uuid primary key default gen_random_uuid(),
    nom               text not null,
    telephone         text unique,
    telegram_user_id  bigint unique,
    localite          text,
    commune           text,
    pays              text not null default 'Côte d''Ivoire',
    langue_preferee   text not null default 'fr',
    notes             text,
    cree_le           timestamptz not null default now(),
    maj_le            timestamptz not null default now()
);

-- 2. PARCELLES
create table if not exists parcelles (
    id                     uuid primary key default gen_random_uuid(),
    agriculteur_id         uuid not null references agriculteurs (id) on delete cascade,
    nom                    text not null,
    latitude               numeric(9, 6),
    longitude              numeric(9, 6),
    altitude_m             integer,
    superficie_m2          numeric(10, 2),
    commune                text,
    localite               text,
    type_sol               text,
    mode_irrigation        text,
    solanacee_precedente   boolean not null default false,
    annee_solanacee        integer,
    actif                  boolean not null default true,
    notes                  text,
    cree_le                timestamptz not null default now(),
    maj_le                 timestamptz not null default now(),
    constraint parcelles_coords_valides check (
        (latitude is null and longitude is null)
        or (latitude between -90 and 90 and longitude between -180 and 180)
    ),
    constraint parcelles_nom_unique_par_agriculteur unique (agriculteur_id, nom)
);

-- 3. CULTURES
create table if not exists cultures (
    id                    uuid primary key default gen_random_uuid(),
    parcelle_id           uuid not null references parcelles (id) on delete cascade,
    espece                text not null default 'tomate',
    variete               text,
    date_semis            date,
    date_repiquage        date,
    date_recolte_prevue   date,
    date_recolte_reelle   date,
    stade                 text not null default 'pepiniere',
    nombre_plants         integer,
    densite_plants_m2     numeric(6, 2),
    statut                text not null default 'en_cours',
    rendement_kg          numeric(10, 2),
    pertes_estimees_pct   numeric(5, 2),
    notes                 text,
    cree_le               timestamptz not null default now(),
    maj_le                timestamptz not null default now(),
    constraint cultures_stade_valide check (stade in (
        'pepiniere', 'levee', 'croissance_vegetative', 'floraison', 'nouaison',
        'fructification', 'maturation', 'recolte', 'terminee'
    )),
    constraint cultures_statut_valide check (statut in ('en_cours', 'terminee', 'abandonnee')),
    constraint cultures_pertes_valides check (pertes_estimees_pct is null
        or (pertes_estimees_pct between 0 and 100))
);

-- 4. OBSERVATIONS
create table if not exists observations (
    id                uuid primary key default gen_random_uuid(),
    culture_id        uuid not null references cultures (id) on delete cascade,
    observe_le        timestamptz not null default now(),
    categorie         text not null,
    description       text not null,
    organe_atteint    text,
    face_feuille      text,
    severite          smallint,
    incidence_pct     numeric(5, 2),
    hauteur_front_cm  integer,
    photo_url         text,
    saisi_par         text not null default 'agent',
    cree_le           timestamptz not null default now(),
    constraint observations_categorie_valide check (categorie in (
        'symptome', 'ravageur', 'adventice', 'meteo', 'intervention', 'recolte', 'autre'
    )),
    constraint observations_organe_valide check (organe_atteint is null or organe_atteint in (
        'feuille_basse', 'feuille_moyenne', 'feuille_haute', 'tige', 'petiole',
        'fleur', 'fruit', 'racine', 'plante_entiere'
    )),
    constraint observations_face_valide check (face_feuille is null or face_feuille in (
        'superieure', 'inferieure', 'les_deux'
    )),
    constraint observations_severite_valide check (severite is null or severite between 1 and 9),
    constraint observations_incidence_valide check (incidence_pct is null
        or (incidence_pct between 0 and 100))
);

-- 5. DIAGNOSTICS
create table if not exists diagnostics (
    id                    uuid primary key default gen_random_uuid(),
    culture_id            uuid not null references cultures (id) on delete cascade,
    observation_id        uuid references observations (id) on delete set null,
    date_diagnostic       timestamptz not null default now(),
    hypotheses            jsonb not null default '[]'::jsonb,
    conclusion            text,
    niveau_confiance      text,
    sources               jsonb not null default '[]'::jsonb,
    informations_manquantes jsonb not null default '[]'::jsonb,
    actions_immediates    jsonb not null default '[]'::jsonb,
    constraint diagnostics_confiance_valide check (niveau_confiance is null
        or niveau_confiance in ('faible', 'moyen', 'eleve'))
);

-- 6. INTERVENTIONS
create table if not exists interventions (
    id                     uuid primary key default gen_random_uuid(),
    culture_id             uuid not null references cultures (id) on delete cascade,
    fait_le                date not null default current_date,
    type_intervention      text not null,
    produit                text,
    matiere_active         text,
    dose                   numeric(10, 3),
    unite_dose             text,
    surface_traitee_m2     numeric(10, 2),
    delai_avant_recolte_j  integer,
    cout_fcfa              numeric(12, 2),
    operateur              text,
    notes                  text,
    cree_le                timestamptz not null default now(),
    constraint interventions_type_valide check (type_intervention in (
        'traitement_fongicide', 'traitement_insecticide', 'traitement_bactericide',
        'fertilisation', 'effeuillage', 'tuteurage', 'paillage', 'desherbage',
        'irrigation', 'piegeage', 'filet_anti_insecte', 'autre'
    )),
    constraint interventions_delai_valide check (delai_avant_recolte_j is null
        or delai_avant_recolte_j >= 0)
);

-- 7. MÉTÉO RELEVÉE
create table if not exists meteo_releves (
    id                uuid primary key default gen_random_uuid(),
    parcelle_id       uuid not null references parcelles (id) on delete cascade,
    jour              date not null,
    source            text not null default 'open-meteo',
    pluie_mm          numeric(6, 2),
    temp_min_c        numeric(5, 2),
    temp_max_c        numeric(5, 2),
    temp_moyenne_c    numeric(5, 2),
    rh_moyenne_pct    numeric(5, 2),
    heures_rh_90      smallint,
    vent_max_kmh      numeric(6, 2),
    et0_mm            numeric(6, 2),
    cree_le           timestamptz not null default now(),
    constraint meteo_releves_unique unique (parcelle_id, jour, source),
    constraint meteo_releves_rh_valide check (rh_moyenne_pct is null
        or (rh_moyenne_pct between 0 and 100))
);

-- 8. RÉCOLTES
create table if not exists recoltes (
    id                uuid primary key default gen_random_uuid(),
    culture_id        uuid not null references cultures (id) on delete cascade,
    recolte_le        date not null default current_date,
    quantite_kg       numeric(10, 2) not null,
    qualite           text,
    prix_vente_fcfa   numeric(10, 2),
    destination       text,
    notes             text,
    cree_le           timestamptz not null default now(),
    constraint recoltes_quantite_valide check (quantite_kg >= 0)
);

-- 9. INDEX
create index if not exists idx_parcelles_agriculteur   on parcelles (agriculteur_id);
create index if not exists idx_cultures_parcelle       on cultures (parcelle_id);
create index if not exists idx_cultures_statut         on cultures (statut) where statut = 'en_cours';
create index if not exists idx_observations_culture    on observations (culture_id, observe_le desc);
create index if not exists idx_observations_categorie  on observations (categorie);
create index if not exists idx_diagnostics_culture     on diagnostics (culture_id, date_diagnostic desc);
create index if not exists idx_interventions_culture   on interventions (culture_id, fait_le desc);
create index if not exists idx_meteo_parcelle_jour     on meteo_releves (parcelle_id, jour desc);
create index if not exists idx_recoltes_culture        on recoltes (culture_id, recolte_le desc);

-- 10. TRIGGER
create or replace function maj_horodatage() returns trigger as $$
begin
    new.maj_le = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_agriculteurs_maj on agriculteurs;
create trigger trg_agriculteurs_maj before update on agriculteurs
    for each row execute function maj_horodatage();

drop trigger if exists trg_parcelles_maj on parcelles;
create trigger trg_parcelles_maj before update on parcelles
    for each row execute function maj_horodatage();

drop trigger if exists trg_cultures_maj on cultures;
create trigger trg_cultures_maj before update on cultures
    for each row execute function maj_horodatage();

-- 11. VUE
create or replace view v_suivi_cultures as
select
    c.id                              as culture_id,
    a.nom                             as agriculteur,
    p.nom                             as parcelle,
    p.commune,
    c.espece,
    c.variete,
    c.stade,
    c.statut,
    c.date_repiquage,
    (current_date - c.date_repiquage) as jours_depuis_repiquage,
    p.solanacee_precedente,
    p.annee_solanacee,
    (select max(o.observe_le) from observations o where o.culture_id = c.id)                as derniere_observation,
    (select o.severite from observations o
       where o.culture_id = c.id and o.severite is not null
       order by o.observe_le desc limit 1)                                                 as derniere_severite,
    (select count(*) from observations o
       where o.culture_id = c.id and o.categorie = 'symptome')                             as nb_observations_symptomes,
    (select count(*) from interventions i where i.culture_id = c.id)                       as nb_interventions,
    (select sum(m.pluie_mm) from meteo_releves m
       where m.parcelle_id = p.id and m.jour >= c.date_repiquage)                          as pluie_cumulee_mm,
    (select sum(m.heures_rh_90) from meteo_releves m
       where m.parcelle_id = p.id and m.jour >= c.date_repiquage)                          as heures_humectation
from cultures c
join parcelles p     on p.id = c.parcelle_id
join agriculteurs a  on a.id = p.agriculteur_id;

-- 12. SÉCURITÉ
alter table agriculteurs  enable row level security;
alter table parcelles     enable row level security;
alter table cultures      enable row level security;
alter table observations  enable row level security;
alter table diagnostics   enable row level security;
alter table interventions enable row level security;
alter table meteo_releves enable row level security;
alter table recoltes      enable row level security;

-- 13. AMORÇAGE
insert into agriculteurs (id, nom, commune, localite, pays, notes)
values (
    '00000000-0000-4000-a000-000000000001',
    'Attowla Charles Fanuel Kouamé',
    'Anyama',
    'Anyama',
    'Côte d''Ivoire',
    'Producteur suivi depuis le 22/09/2026. Premier cas : taches foliaires sur tomate.'
)
on conflict (id) do nothing;

insert into parcelles (
    id, agriculteur_id, nom, latitude, longitude, altitude_m, commune, localite,
    mode_irrigation, solanacee_precedente, annee_solanacee, notes
)
values (
    '00000000-0000-4000-a000-000000000002',
    '00000000-0000-4000-a000-000000000001',
    'Parcelle tomate (non nommée)',
    5.518000, -4.030000, 91, 'Anyama', 'Anyama',
    'arrosoir le matin', true, 2025,
    'Tomate déjà cultivée en 2025 sur cette parcelle : inoculum probablement conservé.'
)
on conflict (id) do nothing;

insert into cultures (
    id, parcelle_id, espece, stade, statut, date_repiquage, notes
)
values (
    '00000000-0000-4000-a000-000000000003',
    '00000000-0000-4000-a000-000000000002',
    'tomate', 'croissance_vegetative', 'en_cours',
    current_date - 42,
    'Aucun traitement appliqué à l''ouverture du suivi.'
)
on conflict (id) do nothing;

insert into observations (
    id, culture_id, observe_le, categorie, description, organe_atteint, face_feuille,
    severite, saisi_par
)
values (
    '00000000-0000-4000-a000-000000000004',
    '00000000-0000-4000-a000-000000000003',
    '2026-09-22 00:00:00+00',
    'symptome',
    'Taches brunes irrégulières avec parfois un halo jaunâtre, sur les feuilles du bas et du milieu. '
    'Quelques petites zones sombres visibles à la face inférieure des feuilles.',
    'feuille_basse', 'les_deux', 4, 'producteur'
)
on conflict (id) do nothing;

insert into diagnostics (
    id, culture_id, observation_id, date_diagnostic, hypotheses, conclusion,
    niveau_confiance, sources, informations_manquantes, actions_immediates
)
values (
    '00000000-0000-4000-a000-000000000005',
    '00000000-0000-4000-a000-000000000003',
    '00000000-0000-4000-a000-000000000004',
    '2026-09-22 00:00:00+00',
    '[{"rang": 1, "hypothese": "cercosporiose (Pseudocercospora fuligena)",
       "indice": "eleve", "motif": "halo jaunâtre, départ sur feuilles âgées, fructification sombre au revers, pluies quotidiennes et humectation nocturne prolongée"},
      {"rang": 2, "hypothese": "cladosporiose (Passalora fulva)", "indice": "moyen",
       "motif": "même famille de symptômes, confusion documentée avec la cercosporiose"},
      {"rang": 3, "hypothese": "corynesporiose (Corynespora cassiicola)", "indice": "moyen",
       "motif": "taches brunes irrégulières, climat tropical humide"},
      {"rang": 4, "hypothese": "alternariose (Alternaria solani)", "indice": "moyen",
       "motif": "inoculum conservé par la tomate de 2025"},
      {"rang": 5, "hypothese": "septoriose (Septoria lycopersici)", "indice": "possible",
       "motif": "jaunissement des feuilles basses"},
      {"rang": 6, "hypothese": "bactériose (Xanthomonas spp.)", "indice": "possible",
       "motif": "taches irrégulières, mais pas de lésion huileuse décrite"}]'::jsonb,
    'Faisceau d''arguments pour une maladie fongique foliaire, la cercosporiose en tête. Aucune identification certaine sans photo ni loupe.',
    'moyen',
    '["https://ephytia.inra.fr/fr/C/11076/Tomate-Cercosporiose-Pseudocercospora-fuligena",
      "https://doi.org/10.15488/7090"]'::jsonb,
    '["photo rapprochée recto et verso des feuilles atteintes",
      "examen à la loupe (fructification en duvet sombre ?)",
      "programme de fertilisation, en particulier l''azote",
      "répartition spatiale des symptômes dans la parcelle"]'::jsonb,
    '["retirer et sortir de la parcelle les feuilles les plus atteintes",
      "continuer l''arrosage au matin, sans mouiller le feuillage",
      "ne pas travailler dans la parcelle mouillée",
      "prévoir un point de contrôle à 5 jours avec mesure du front de maladie"]'::jsonb
)
on conflict (id) do nothing;

-- FIN DU SCHÉMA
