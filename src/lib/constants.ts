export const CATEGORIES_OBSERVATION = [
  { value: 'visite', label: 'Visite de routine' },
  { value: 'symptome', label: 'Symptôme observé' },
  { value: 'ravageur', label: 'Ravageur détecté' },
  { value: 'maladie', label: 'Maladie détectée' },
  { value: 'croissance', label: 'Croissance / développement' },
  { value: 'floraison', label: 'Floraison' },
  { value: 'fructification', label: 'Fructification' },
  { value: 'autre', label: 'Autre' },
];

export const ORGANES_ATTEINTS = [
  { value: 'feuille', label: 'Feuille' },
  { value: 'tige', label: 'Tige' },
  { value: 'racine', label: 'Racine' },
  { value: 'fruit', label: 'Fruit' },
  { value: 'fleur', label: 'Fleur' },
  { value: 'plante_entiere', label: 'Plante entière' },
];

export const FACES_FEUILLE = [
  { value: 'supérieure', label: 'Face supérieure' },
  { value: 'inférieure', label: 'Face inférieure' },
  { value: 'les_deux', label: 'Les deux faces' },
];

// ATTENTION : ces listes doivent rester alignées sur les contraintes CHECK de la table
// `cultures` (cultures_stade_valide / cultures_statut_valide). Une valeur absente de la
// base fait échouer toute création de culture en 23514 (check_violation).
export const STADES_CULTURE = [
  { value: 'pepiniere', label: 'Pépinière' },
  { value: 'levee', label: 'Levée' },
  { value: 'croissance_vegetative', label: 'Croissance' },
  { value: 'floraison', label: 'Floraison' },
  { value: 'nouaison', label: 'Nouaison (fruits formés)' },
  { value: 'fructification', label: 'Fructification' },
  { value: 'maturation', label: 'Maturation' },
  { value: 'recolte', label: 'Récolte' },
  { value: 'terminee', label: 'Terminée' },
];

export const STATUTS_CULTURE = [
  { value: 'en_cours', label: 'En cours' },
  { value: 'terminee', label: 'Terminée' },
  { value: 'abandonnee', label: 'Abandonnée' },
];

export const ESPECES_CULTURE = [
  { value: 'Tomate', label: 'Tomate' },
  { value: 'Piment', label: 'Piment' },
  { value: 'Gombo', label: 'Gombo' },
  { value: 'Maïs', label: 'Maïs' },
  { value: 'Aubergine', label: 'Aubergine' },
  { value: 'Oignon', label: 'Oignon' },
  { value: 'Autre', label: 'Autre' },
];

export const TYPES_INTERVENTION = [
  { value: 'traitement_fongicide', label: 'Traitement fongicide' },
  { value: 'traitement_insecticide', label: 'Traitement insecticide' },
  { value: 'traitement_bactericide', label: 'Traitement bactéricide' },
  { value: 'fertilisation', label: 'Fertilisation' },
  { value: 'irrigation', label: 'Irrigation' },
  { value: 'desherbage', label: 'Désherbage' },
  { value: 'taille', label: 'Taille / Élagage' },
  { value: 'palissage', label: 'Palissage' },
  { value: 'autre', label: 'Autre' },
];

export const TYPES_ALERTE = [
  { value: 'maladie', label: 'Maladie' },
  { value: 'ravageur', label: 'Ravageur' },
  { value: 'meteo', label: 'Météo' },
  { value: 'croissance', label: 'Croissance' },
  { value: 'irrigation', label: 'Irrigation' },
  { value: 'sol', label: 'Sol' },
  { value: 'autre', label: 'Autre' },
];

export const NIVEAUX_ALERTE = [
  { value: 'critique', label: 'Critique', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  { value: 'eleve', label: 'Élevé', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  { value: 'moyen', label: 'Moyen', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  { value: 'faible', label: 'Faible', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
] as const;

export function getNiveauConfig(niveau: string) {
  return NIVEAUX_ALERTE.find((n) => n.value === niveau) ?? NIVEAUX_ALERTE[2];
}

export function formatDate(date: string | null): string {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return date;
  }
}

export function formatDateTime(date: string | null): string {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return date;
  }
}

// Types de sol courants en Côte d'Ivoire, dits simplement (le producteur peut laisser vide).
export const TYPES_SOL = [
  { value: 'sableux', label: 'Sableux (terre légère, sèche vite)' },
  { value: 'limono-sableux', label: 'Limono-sableux (terre douce, courante)' },
  { value: 'limoneux', label: 'Limoneux (terre fine, retient l\'eau)' },
  { value: 'argilo-limoneux', label: 'Argilo-limoneux (terre lourde)' },
  { value: 'argileux', label: 'Argileux (terre très lourde, colle)' },
  { value: 'lateritique', label: 'Latéritique (terre rouge, caillouteuse)' },
  { value: 'autre', label: 'Autre / je ne sais pas' },
];

// Modes d'arrosage déclarés par le producteur.
export const MODES_IRRIGATION = [
  { value: 'arrosoir le matin', label: 'Arrosoir, le matin' },
  { value: 'arrosoir le soir', label: 'Arrosoir, le soir' },
  { value: 'arrosoir midi', label: 'Arrosoir, en pleine journée' },
  { value: 'goutte a goutte', label: 'Goutte à goutte' },
  { value: 'aspersion', label: 'Aspersion / arrosage par-dessus' },
  { value: 'pluie seule', label: 'Pluie seule (pas d\'arrosage)' },
  { value: 'mixte', label: 'Mixte (plusieurs façons)' },
];

export function formatFcfa(amount: number | null): string {
  if (amount === null || amount === undefined) return '—';
  return amount.toLocaleString('fr-FR') + ' FCFA';
}

export function getStadeLabel(stade: string | null): string {
  if (!stade) return '—';
  const s = STADES_CULTURE.find((s) => s.value === stade);
  return s?.label ?? stade;
}

export function getStatutLabel(statut: string): string {
  const s = STATUTS_CULTURE.find((s) => s.value === statut);
  return s?.label ?? statut;
}

export function getCategorieLabel(categorie: string): string {
  const c = CATEGORIES_OBSERVATION.find((c) => c.value === categorie);
  return c?.label ?? categorie;
}

export function getTypeInterventionLabel(type: string): string {
  const t = TYPES_INTERVENTION.find((t) => t.value === type);
  return t?.label ?? type;
}

export function getTypeAlerteLabel(type: string): string {
  const t = TYPES_ALERTE.find((t) => t.value === type);
  return t?.label ?? type;
}
