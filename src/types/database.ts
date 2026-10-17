export interface Agriculteur {
  id: string;
  nom: string;
  telephone: string | null;
  email: string | null;
  auth_user_id: string;
  localite: string | null;
  commune: string | null;
  pays: string | null;
  langue_preferee: string | null;
  notes: string | null;
  cree_le: string;
  maj_le: string;
}

export interface Parcelle {
  id: string;
  agriculteur_id: string;
  nom: string;
  latitude: number | null;
  longitude: number | null;
  altitude_m: number | null;
  superficie_m2: number | null;
  commune: string | null;
  localite: string | null;
  type_sol: string | null;
  mode_irrigation: string | null;
  solanacee_precedente: string | null;
  annee_solanacee: number | null;
  actif: boolean;
  notes: string | null;
  cree_le: string;
  maj_le: string;
}

export interface Culture {
  id: string;
  parcelle_id: string;
  espece: string;
  variete: string | null;
  date_semis: string | null;
  date_repiquage: string | null;
  date_recolte_prevue: string | null;
  date_recolte_reelle: string | null;
  stade: string | null;
  nombre_plants: number | null;
  densite_plants_m2: number | null;
  statut: string;
  rendement_kg: number | null;
  pertes_estimees_pct: number | null;
  notes: string | null;
  cree_le: string;
  maj_le: string;
  parcelle?: Parcelle;
}

export interface Observation {
  id: string;
  culture_id: string;
  observe_le: string;
  categorie: string;
  description: string | null;
  organe_atteint: string | null;
  face_feuille: string | null;
  severite: number | null;
  incidence_pct: number | null;
  hauteur_front_cm: number | null;
  photo_url: string | null;
  saisi_par: string | null;
  cree_le: string;
}

/**
 * Colonnes jsonb de `diagnostics` : ce sont des TABLEAUX dont le contenu varie
 * selon l'agent qui a écrit la ligne (voir lib/diagnostic.ts). Ne jamais les
 * rendre directement en JSX — passer par normaliserHypotheses / normaliserSources
 * / normaliserListeTextes.
 */
export interface DiagnosticHypotheseBrute {
  rang?: string | number | null;
  hypothese?: string | null;
  nom?: string | null;
  motif?: string | null;
  indice?: string | null;
  [cle: string]: unknown;
}

export interface DiagnosticSourceBrute {
  titre?: string | null;
  url?: string | null;
  apport?: string | null;
  [cle: string]: unknown;
}

export interface Diagnostic {
  id: string;
  culture_id: string;
  observation_id: string | null;
  date_diagnostic: string;
  hypotheses: DiagnosticHypotheseBrute[] | string | null;
  conclusion: string | null;
  niveau_confiance: string | null;
  sources: DiagnosticSourceBrute[] | string | null;
  informations_manquantes: string[] | string | null;
  actions_immediates: string[] | string | null;
  cree_le: string;
}

export interface Intervention {
  id: string;
  culture_id: string;
  fait_le: string;
  type_intervention: string;
  produit: string | null;
  matiere_active: string | null;
  dose: number | null;
  unite_dose: string | null;
  surface_traitee_m2: number | null;
  delai_avant_recolte_j: number | null;
  cout_fcfa: number | null;
  operateur: string | null;
  notes: string | null;
  cree_le: string;
}

export interface MeteoReleve {
  id: string;
  parcelle_id: string;
  jour: string;
  source: string;
  pluie_mm: number;
  temp_min_c: number | null;
  temp_max_c: number | null;
  temp_moyenne_c: number | null;
  rh_moyenne_pct: number | null;
  heures_rh_90: number | null;
  vent_max_kmh: number | null;
  et0_mm: number | null;
  cree_le: string;
}

export interface Recolte {
  id: string;
  culture_id: string;
  recolte_le: string;
  quantite_kg: number;
  qualite: string | null;
  prix_vente_fcfa: number | null;
  destination: string | null;
  notes: string | null;
  cree_le: string;
}

export interface Alerte {
  id: string;
  culture_id: string | null;
  parcelle_id: string | null;
  alerte_le: string;
  type_alerte: string;
  niveau: 'critique' | 'eleve' | 'moyen' | 'faible';
  message: string;
  action_recommandee: string | null;
  donnees_declenchantes: Record<string, unknown> | null;
  traitee: boolean;
  traitee_le: string | null;
  traitee_par: string | null;
  notes_traitement: string | null;
  saisi_par: string | null;
  cree_le: string;
  maj_le: string;
  culture?: Culture;
  parcelle?: Parcelle;
}

export interface VSuiviCulture {
  culture_id: string;
  agriculteur: string;
  parcelle: string;
  commune: string | null;
  espece: string;
  variete: string | null;
  stade: string | null;
  statut: string;
  date_repiquage: string | null;
  jours_depuis_repiquage: number | null;
  solanacee_precedente: string | null;
  annee_solanacee: number | null;
  derniere_observation: string | null;
  derniere_severite: number | null;
  nb_observations_symptomes: number;
  nb_interventions: number;
  pluie_cumulee_mm: number;
  heures_humectation: number;
}
