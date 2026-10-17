/*
# AgriAgent - Schéma de base de données complet

## Description
Crée toutes les tables pour l'application AgriAgent, un assistant intelligent
pour les producteurs agricoles ivoiriens.

## Tables créées
1. `agriculteurs` - Profils des agriculteurs liés aux comptes auth
2. `parcelles` - Parcelles de terrain appartenant à un agriculteur
3. `cultures` - Cultures plantées sur les parcelles
4. `observations` - Observations agronomiques sur les cultures
5. `diagnostics` - Diagnostics liés aux observations
6. `interventions` - Interventions phytosanitaires sur les cultures
7. `meteo_releves` - Relevés météo journaliers par parcelle
8. `recoltes` - Récoltes enregistrées par culture
9. `alertes` - Alertes sur les cultures

## Vue créée
- `v_suivi_cultures` - Vue résumant le suivi des cultures avec agrégations

## Sécurité
- RLS activée sur toutes les tables
- Chaque agriculteur ne voit que ses propres données via `auth_user_id`
- Politiques ownership-scoped pour SELECT/INSERT/UPDATE/DELETE
- Tables enfants vérifient l'appartenance via la chaîne parentale

## Notes importantes
1. Les colonnes `auth_user_id` sur `agriculteurs` ont DEFAULT auth.uid()
2. Les tables enfants (parcelles, etc.) vérifient l'ownership via EXISTS sur le parent
3. Toutes les tables utilisent gen_random_uuid() pour les IDs
4. Les timestamps utilisent timestamptz DEFAULT now()
*/

-- ============================================
-- TABLE: agriculteurs
-- ============================================
CREATE TABLE IF NOT EXISTS agriculteurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  telephone text,
  email text,
  auth_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  localite text,
  commune text,
  pays text DEFAULT 'Côte d''Ivoire',
  langue_preferee text DEFAULT 'fr',
  notes text,
  cree_le timestamptz DEFAULT now(),
  maj_le timestamptz DEFAULT now()
);

ALTER TABLE agriculteurs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_agriculteurs" ON agriculteurs;
CREATE POLICY "select_own_agriculteurs" ON agriculteurs FOR SELECT
  TO authenticated USING (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "insert_own_agriculteurs" ON agriculteurs;
CREATE POLICY "insert_own_agriculteurs" ON agriculteurs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "update_own_agriculteurs" ON agriculteurs;
CREATE POLICY "update_own_agriculteurs" ON agriculteurs FOR UPDATE
  TO authenticated USING (auth.uid() = auth_user_id) WITH CHECK (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "delete_own_agriculteurs" ON agriculteurs;
CREATE POLICY "delete_own_agriculteurs" ON agriculteurs FOR DELETE
  TO authenticated USING (auth.uid() = auth_user_id);

-- ============================================
-- TABLE: parcelles
-- ============================================
CREATE TABLE IF NOT EXISTS parcelles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agriculteur_id uuid NOT NULL REFERENCES agriculteurs(id) ON DELETE CASCADE,
  nom text NOT NULL,
  latitude double precision,
  longitude double precision,
  altitude_m double precision,
  superficie_m2 double precision,
  commune text,
  localite text,
  type_sol text,
  mode_irrigation text,
  solanacee_precedente text,
  annee_solanacee int,
  actif boolean DEFAULT true,
  notes text,
  cree_le timestamptz DEFAULT now(),
  maj_le timestamptz DEFAULT now()
);

ALTER TABLE parcelles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_parcelles" ON parcelles;
CREATE POLICY "select_own_parcelles" ON parcelles FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM agriculteurs WHERE agriculteurs.id = parcelles.agriculteur_id AND agriculteurs.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_parcelles" ON parcelles;
CREATE POLICY "insert_own_parcelles" ON parcelles FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM agriculteurs WHERE agriculteurs.id = parcelles.agriculteur_id AND agriculteurs.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_parcelles" ON parcelles;
CREATE POLICY "update_own_parcelles" ON parcelles FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM agriculteurs WHERE agriculteurs.id = parcelles.agriculteur_id AND agriculteurs.auth_user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM agriculteurs WHERE agriculteurs.id = parcelles.agriculteur_id AND agriculteurs.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_parcelles" ON parcelles;
CREATE POLICY "delete_own_parcelles" ON parcelles FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM agriculteurs WHERE agriculteurs.id = parcelles.agriculteur_id AND agriculteurs.auth_user_id = auth.uid())
  );

-- ============================================
-- TABLE: cultures
-- ============================================
CREATE TABLE IF NOT EXISTS cultures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcelle_id uuid NOT NULL REFERENCES parcelles(id) ON DELETE CASCADE,
  espece text NOT NULL,
  variete text,
  date_semis date,
  date_repiquage date,
  date_recolte_prevue date,
  date_recolte_reelle date,
  stade text DEFAULT 'semis',
  nombre_plants int,
  densite_plants_m2 double precision,
  statut text DEFAULT 'actif',
  rendement_kg double precision,
  pertes_estimees_pct double precision,
  notes text,
  cree_le timestamptz DEFAULT now(),
  maj_le timestamptz DEFAULT now()
);

ALTER TABLE cultures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_cultures" ON cultures;
CREATE POLICY "select_own_cultures" ON cultures FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM parcelles p
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE p.id = cultures.parcelle_id AND a.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_cultures" ON cultures;
CREATE POLICY "insert_own_cultures" ON cultures FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM parcelles p
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE p.id = cultures.parcelle_id AND a.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_cultures" ON cultures;
CREATE POLICY "update_own_cultures" ON cultures FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM parcelles p
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE p.id = cultures.parcelle_id AND a.auth_user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM parcelles p
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE p.id = cultures.parcelle_id AND a.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_cultures" ON cultures;
CREATE POLICY "delete_own_cultures" ON cultures FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM parcelles p
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE p.id = cultures.parcelle_id AND a.auth_user_id = auth.uid()
    )
  );

-- ============================================
-- TABLE: observations
-- ============================================
CREATE TABLE IF NOT EXISTS observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  culture_id uuid NOT NULL REFERENCES cultures(id) ON DELETE CASCADE,
  observe_le date NOT NULL DEFAULT CURRENT_DATE,
  categorie text NOT NULL,
  description text,
  organe_atteint text,
  face_feuille text,
  severite int CHECK (severite >= 1 AND severite <= 9),
  incidence_pct double precision,
  hauteur_front_cm double precision,
  photo_url text,
  saisi_par uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cree_le timestamptz DEFAULT now()
);

ALTER TABLE observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_observations" ON observations;
CREATE POLICY "select_own_observations" ON observations FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM cultures c
      JOIN parcelles p ON p.id = c.parcelle_id
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE c.id = observations.culture_id AND a.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_observations" ON observations;
CREATE POLICY "insert_own_observations" ON observations FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM cultures c
      JOIN parcelles p ON p.id = c.parcelle_id
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE c.id = observations.culture_id AND a.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_observations" ON observations;
CREATE POLICY "update_own_observations" ON observations FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM cultures c
      JOIN parcelles p ON p.id = c.parcelle_id
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE c.id = observations.culture_id AND a.auth_user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM cultures c
      JOIN parcelles p ON p.id = c.parcelle_id
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE c.id = observations.culture_id AND a.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_observations" ON observations;
CREATE POLICY "delete_own_observations" ON observations FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM cultures c
      JOIN parcelles p ON p.id = c.parcelle_id
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE c.id = observations.culture_id AND a.auth_user_id = auth.uid()
    )
  );

-- ============================================
-- TABLE: diagnostics
-- ============================================
CREATE TABLE IF NOT EXISTS diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  culture_id uuid NOT NULL REFERENCES cultures(id) ON DELETE CASCADE,
  observation_id uuid REFERENCES observations(id) ON DELETE SET NULL,
  date_diagnostic date NOT NULL DEFAULT CURRENT_DATE,
  hypotheses text,
  conclusion text,
  niveau_confiance text,
  sources text,
  informations_manquantes text,
  actions_immediates text,
  cree_le timestamptz DEFAULT now()
);

ALTER TABLE diagnostics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_diagnostics" ON diagnostics;
CREATE POLICY "select_own_diagnostics" ON diagnostics FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM cultures c
      JOIN parcelles p ON p.id = c.parcelle_id
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE c.id = diagnostics.culture_id AND a.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_diagnostics" ON diagnostics;
CREATE POLICY "insert_own_diagnostics" ON diagnostics FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM cultures c
      JOIN parcelles p ON p.id = c.parcelle_id
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE c.id = diagnostics.culture_id AND a.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_diagnostics" ON diagnostics;
CREATE POLICY "update_own_diagnostics" ON diagnostics FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM cultures c
      JOIN parcelles p ON p.id = c.parcelle_id
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE c.id = diagnostics.culture_id AND a.auth_user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM cultures c
      JOIN parcelles p ON p.id = c.parcelle_id
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE c.id = diagnostics.culture_id AND a.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_diagnostics" ON diagnostics;
CREATE POLICY "delete_own_diagnostics" ON diagnostics FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM cultures c
      JOIN parcelles p ON p.id = c.parcelle_id
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE c.id = diagnostics.culture_id AND a.auth_user_id = auth.uid()
    )
  );

-- ============================================
-- TABLE: interventions
-- ============================================
CREATE TABLE IF NOT EXISTS interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  culture_id uuid NOT NULL REFERENCES cultures(id) ON DELETE CASCADE,
  fait_le date NOT NULL DEFAULT CURRENT_DATE,
  type_intervention text NOT NULL,
  produit text,
  matiere_active text,
  dose double precision,
  unite_dose text,
  surface_traitee_m2 double precision,
  delai_avant_recolte_j int,
  cout_fcfa int,
  operateur text,
  notes text,
  cree_le timestamptz DEFAULT now()
);

ALTER TABLE interventions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_interventions" ON interventions;
CREATE POLICY "select_own_interventions" ON interventions FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM cultures c
      JOIN parcelles p ON p.id = c.parcelle_id
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE c.id = interventions.culture_id AND a.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_interventions" ON interventions;
CREATE POLICY "insert_own_interventions" ON interventions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM cultures c
      JOIN parcelles p ON p.id = c.parcelle_id
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE c.id = interventions.culture_id AND a.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_interventions" ON interventions;
CREATE POLICY "update_own_interventions" ON interventions FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM cultures c
      JOIN parcelles p ON p.id = c.parcelle_id
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE c.id = interventions.culture_id AND a.auth_user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM cultures c
      JOIN parcelles p ON p.id = c.parcelle_id
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE c.id = interventions.culture_id AND a.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_interventions" ON interventions;
CREATE POLICY "delete_own_interventions" ON interventions FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM cultures c
      JOIN parcelles p ON p.id = c.parcelle_id
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE c.id = interventions.culture_id AND a.auth_user_id = auth.uid()
    )
  );

-- ============================================
-- TABLE: meteo_releves
-- ============================================
CREATE TABLE IF NOT EXISTS meteo_releves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcelle_id uuid NOT NULL REFERENCES parcelles(id) ON DELETE CASCADE,
  jour date NOT NULL,
  source text DEFAULT 'manuel',
  pluie_mm double precision DEFAULT 0,
  temp_min_c double precision,
  temp_max_c double precision,
  temp_moyenne_c double precision,
  rh_moyenne_pct double precision,
  heures_rh_90 double precision,
  vent_max_kmh double precision,
  et0_mm double precision,
  cree_le timestamptz DEFAULT now()
);

ALTER TABLE meteo_releves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_meteo_releves" ON meteo_releves;
CREATE POLICY "select_own_meteo_releves" ON meteo_releves FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM parcelles p
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE p.id = meteo_releves.parcelle_id AND a.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_meteo_releves" ON meteo_releves;
CREATE POLICY "insert_own_meteo_releves" ON meteo_releves FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM parcelles p
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE p.id = meteo_releves.parcelle_id AND a.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_meteo_releves" ON meteo_releves;
CREATE POLICY "update_own_meteo_releves" ON meteo_releves FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM parcelles p
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE p.id = meteo_releves.parcelle_id AND a.auth_user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM parcelles p
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE p.id = meteo_releves.parcelle_id AND a.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_meteo_releves" ON meteo_releves;
CREATE POLICY "delete_own_meteo_releves" ON meteo_releves FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM parcelles p
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE p.id = meteo_releves.parcelle_id AND a.auth_user_id = auth.uid()
    )
  );

-- ============================================
-- TABLE: recoltes
-- ============================================
CREATE TABLE IF NOT EXISTS recoltes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  culture_id uuid NOT NULL REFERENCES cultures(id) ON DELETE CASCADE,
  recolte_le date NOT NULL DEFAULT CURRENT_DATE,
  quantite_kg double precision NOT NULL,
  qualite text,
  prix_vente_fcfa int,
  destination text,
  notes text,
  cree_le timestamptz DEFAULT now()
);

ALTER TABLE recoltes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_recoltes" ON recoltes;
CREATE POLICY "select_own_recoltes" ON recoltes FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM cultures c
      JOIN parcelles p ON p.id = c.parcelle_id
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE c.id = recoltes.culture_id AND a.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_recoltes" ON recoltes;
CREATE POLICY "insert_own_recoltes" ON recoltes FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM cultures c
      JOIN parcelles p ON p.id = c.parcelle_id
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE c.id = recoltes.culture_id AND a.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_recoltes" ON recoltes;
CREATE POLICY "update_own_recoltes" ON recoltes FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM cultures c
      JOIN parcelles p ON p.id = c.parcelle_id
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE c.id = recoltes.culture_id AND a.auth_user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM cultures c
      JOIN parcelles p ON p.id = c.parcelle_id
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE c.id = recoltes.culture_id AND a.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_recoltes" ON recoltes;
CREATE POLICY "delete_own_recoltes" ON recoltes FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM cultures c
      JOIN parcelles p ON p.id = c.parcelle_id
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE c.id = recoltes.culture_id AND a.auth_user_id = auth.uid()
    )
  );

-- ============================================
-- TABLE: alertes
-- ============================================
CREATE TABLE IF NOT EXISTS alertes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  culture_id uuid REFERENCES cultures(id) ON DELETE CASCADE,
  parcelle_id uuid REFERENCES parcelles(id) ON DELETE CASCADE,
  alerte_le timestamptz DEFAULT now(),
  type_alerte text NOT NULL,
  niveau text NOT NULL DEFAULT 'moyen',
  message text NOT NULL,
  action_recommandee text,
  donnees_declenchantes jsonb,
  traitee boolean DEFAULT false,
  traitee_le timestamptz,
  traitee_par uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes_traitement text,
  saisi_par uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cree_le timestamptz DEFAULT now(),
  maj_le timestamptz DEFAULT now()
);

ALTER TABLE alertes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_alertes" ON alertes;
CREATE POLICY "select_own_alertes" ON alertes FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM parcelles p
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE p.id = alertes.parcelle_id AND a.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM cultures c
      JOIN parcelles p ON p.id = c.parcelle_id
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE c.id = alertes.culture_id AND a.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_alertes" ON alertes;
CREATE POLICY "insert_own_alertes" ON alertes FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM parcelles p
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE p.id = alertes.parcelle_id AND a.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM cultures c
      JOIN parcelles p ON p.id = c.parcelle_id
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE c.id = alertes.culture_id AND a.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_alertes" ON alertes;
CREATE POLICY "update_own_alertes" ON alertes FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM parcelles p
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE p.id = alertes.parcelle_id AND a.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM cultures c
      JOIN parcelles p ON p.id = c.parcelle_id
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE c.id = alertes.culture_id AND a.auth_user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM parcelles p
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE p.id = alertes.parcelle_id AND a.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM cultures c
      JOIN parcelles p ON p.id = c.parcelle_id
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE c.id = alertes.culture_id AND a.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_alertes" ON alertes;
CREATE POLICY "delete_own_alertes" ON alertes FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM parcelles p
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE p.id = alertes.parcelle_id AND a.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM cultures c
      JOIN parcelles p ON p.id = c.parcelle_id
      JOIN agriculteurs a ON a.id = p.agriculteur_id
      WHERE c.id = alertes.culture_id AND a.auth_user_id = auth.uid()
    )
  );

-- ============================================
-- INDEX pour les performances
-- ============================================
CREATE INDEX IF NOT EXISTS idx_parcelles_agriculteur ON parcelles(agriculteur_id);
CREATE INDEX IF NOT EXISTS idx_cultures_parcelle ON cultures(parcelle_id);
CREATE INDEX IF NOT EXISTS idx_observations_culture ON observations(culture_id);
CREATE INDEX IF NOT EXISTS idx_diagnostics_culture ON diagnostics(culture_id);
CREATE INDEX IF NOT EXISTS idx_interventions_culture ON interventions(culture_id);
CREATE INDEX IF NOT EXISTS idx_meteo_parcelle ON meteo_releves(parcelle_id, jour);
CREATE INDEX IF NOT EXISTS idx_recoltes_culture ON recoltes(culture_id);
CREATE INDEX IF NOT EXISTS idx_alertes_culture ON alertes(culture_id);
CREATE INDEX IF NOT EXISTS idx_alertes_parcelle ON alertes(parcelle_id);
CREATE INDEX IF NOT EXISTS idx_alertes_traitee ON alertes(traitee);

-- ============================================
-- VUE: v_suivi_cultures
-- ============================================
CREATE OR REPLACE VIEW v_suivi_cultures AS
SELECT
  c.id AS culture_id,
  a.nom AS agriculteur,
  p.nom AS parcelle,
  p.commune,
  c.espece,
  c.variete,
  c.stade,
  c.statut,
  c.date_repiquage,
  CASE WHEN c.date_repiquage IS NOT NULL
    THEN CURRENT_DATE - c.date_repiquage
    ELSE NULL END AS jours_depuis_repiquage,
  p.solanacee_precedente,
  p.annee_solanacee,
  (SELECT MAX(o.observe_le) FROM observations o WHERE o.culture_id = c.id) AS derniere_observation,
  (SELECT MAX(o.severite) FROM observations o WHERE o.culture_id = c.id AND o.severite IS NOT NULL) AS derniere_severite,
  (SELECT COUNT(*) FROM observations o WHERE o.culture_id = c.id AND o.categorie != 'visite') AS nb_observations_symptomes,
  (SELECT COUNT(*) FROM interventions i WHERE i.culture_id = c.id) AS nb_interventions,
  (SELECT COALESCE(SUM(m.pluie_mm), 0) FROM meteo_releves m WHERE m.parcelle_id = p.id AND m.jour >= CURRENT_DATE - 7) AS pluie_cumulee_mm,
  (SELECT COALESCE(SUM(m.heures_rh_90), 0) FROM meteo_releves m WHERE m.parcelle_id = p.id AND m.jour >= CURRENT_DATE - 7) AS heures_humectation
FROM cultures c
JOIN parcelles p ON p.id = c.parcelle_id
JOIN agriculteurs a ON a.id = p.agriculteur_id;