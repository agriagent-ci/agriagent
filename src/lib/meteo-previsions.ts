/**
 * Prévisions météo en langage agriculteur (Open-Meteo via l'API AgriAgent).
 *
 * Deux usages :
 *  - les 5 cartes de l'onglet Météo ;
 *  - la mini-carte de l'écran Accueil.
 *
 * Règles pures et testables hors navigateur (scripts/test-meteo-previsions.mjs).
 */
import { fr } from './meteo-conseil';
import type { Ton } from './meteo-conseil';

export interface PrevisionJour {
  jour: string;
  code_meteo: number | string | null;
  temp_min_c: number | string | null;
  temp_max_c: number | string | null;
  pluie_mm: number | string | null;
  proba_pluie_pct: number | string | null;
  vent_max_kmh: number | string | null;
  et0_mm: number | string | null;
}

export interface MeteoActuelle {
  temperature_c: number | string | null;
  humidite_pct: number | string | null;
  pluie_mm: number | string | null;
  vent_kmh: number | string | null;
  code_meteo: number | string | null;
}

export interface ContexteMaladie {
  active?: boolean;
  diagnostic_recent?: { date_diagnostic?: string; niveau_confiance?: string } | null;
  observations_recentes_21j?: number;
}

export interface PrevisionsMeteo {
  disponible: boolean;
  raison?: 'coordonnees_absentes' | 'service_indisponible';
  message?: string;
  parcelle?: { id: string; nom?: string; commune?: string } | null;
  actuel?: MeteoActuelle;
  previsions?: PrevisionJour[];
  maladie?: ContexteMaladie;
}

export interface ConseilPrevision {
  emoji: string;
  phrase: string;
  ton: Ton;
  /** Vrai pour le message « ne traitez pas aujourd'hui ». */
  bloqueTraitement?: boolean;
}

/** Codes météo WMO -> icône. Les codes sont regroupés par famille, comme le fait Open-Meteo. */
export function emojiDuCode(code: number | string | null | undefined): string {
  const c = typeof code === 'number' ? code : Number(code);
  if (!Number.isFinite(c)) return '⛅';
  if (c === 0) return '☀️';
  if (c === 1) return '🌤️';
  if (c === 2) return '⛅';
  if (c === 3) return '☁️';
  if (c === 45 || c === 48) return '🌫️';
  if (c >= 51 && c <= 57) return '🌦️';
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return '🌧️';
  if (c >= 71 && c <= 77) return '🌨️';
  if (c >= 95) return '⛈️';
  return '⛅';
}

function nombre(valeur: unknown): number | null {
  if (valeur === null || valeur === undefined || valeur === '') return null;
  const n = typeof valeur === 'number' ? valeur : Number(valeur);
  return Number.isFinite(n) ? n : null;
}

/** « Aujourd'hui », « Demain », « Dans 3 jours », « lundi 20/10 » au-delà. */
export function libelleJour(jourIso: string, position: number, aujourdhui = new Date()): string {
  if (position === 0) return "Aujourd'hui";
  if (position === 1) return 'Demain';
  const jour = jourIso?.slice(0, 10) ?? '';
  const [j, m] = jour.split('-').slice(2);
  const dans = joursEntre(jour, aujourdhui);
  if (dans !== null && dans >= 2 && dans <= 5) return `Dans ${dans} jours`;
  return j && m ? `${j}/${m}` : jour;
}

function joursEntre(jourIso: string, reference: Date): number | null {
  if (!jourIso) return null;
  const date = new Date(`${jourIso.slice(0, 10)}T12:00:00Z`).getTime();
  if (Number.isNaN(date)) return null;
  return Math.round((date - reference.getTime()) / 86400000);
}

/** Nom court du jour, pour l'en-tête des cartes. */
export function nomDuJour(jourIso: string): string {
  const noms = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const date = new Date(`${jourIso?.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? '' : noms[date.getUTCDay()];
}

/**
 * Conseil d'une journée prévue. La première règle qui s'applique gagne, du plus
 * contraignant au plus anodin.
 */
export function conseilPrevision(
  prevision: PrevisionJour,
  position: number,
  maladieActive = false,
  aujourdhui = new Date()
): ConseilPrevision {
  const pluie = nombre(prevision.pluie_mm) ?? 0;
  const tempMax = nombre(prevision.temp_max_c);
  const emoji = emojiDuCode(prevision.code_meteo);
  const quand = libelleJour(prevision.jour, position, aujourdhui);

  // 1) Pluie annoncée dans les 24 h alors qu'une maladie est en cours : traiter serait perdu.
  if (position === 0 && pluie >= 5 && maladieActive) {
    return {
      emoji: '🌧️',
      phrase: `Ne traitez pas aujourd'hui, la pluie va laver le produit (${fr(pluie, 1)} mm prévus).`,
      ton: 'vigilance',
      bloqueTraitement: true,
    };
  }

  if (pluie >= 20) {
    return {
      emoji: '🌧️',
      phrase: `${quand} : grosse pluie (${fr(pluie, 1)} mm) — vérifiez que l'eau ne stagne pas au pied des plants.`,
      ton: 'vigilance',
    };
  }

  if (pluie >= 5) {
    return {
      emoji: '🌧️',
      phrase: `${quand} : pluie modérée (${fr(pluie, 1)} mm) — reportez tout traitement fongicide.`,
      ton: 'vigilance',
    };
  }

  if (tempMax !== null && tempMax >= 33) {
    return {
      emoji: '☀️',
      phrase: `${quand} : forte chaleur (${fr(tempMax, 0)} °C) — arrosez tôt le matin.`,
      ton: 'vigilance',
    };
  }

  if (tempMax !== null && tempMax >= 30) {
    return {
      emoji: '☀️',
      phrase: `${quand} : chaleur (${fr(tempMax, 0)} °C) — arrosez tôt le matin ou le soir.`,
      ton: 'vigilance',
    };
  }

  if (pluie >= 1) {
    return {
      emoji: emoji,
      phrase: `${quand} : pluie légère (${fr(pluie, 1)} mm) — utile pour la culture.`,
      ton: 'ok',
    };
  }

  return {
    emoji: emoji,
    phrase: `${quand} : temps calme — poursuivez le suivi habituel.`,
    ton: 'ok',
  };
}

/**
 * Phrase de la mini-carte d'accueil, à partir de la météo du moment.
 * Une seule phrase, compréhensible sans thermomètre.
 */
export function conseilDuMoment(actuel: MeteoActuelle | null | undefined, maladieActive = false): ConseilPrevision {
  const temperature = nombre(actuel?.temperature_c);
  const humidite = nombre(actuel?.humidite_pct);
  const emoji = emojiDuCode(actuel?.code_meteo);
  const pluie = nombre(actuel?.pluie_mm) ?? 0;

  if (pluie >= 2) {
    return { emoji: '🌧️', phrase: 'Il pleut — pas de traitement maintenant, il serait lavé.', ton: 'vigilance' };
  }
  if (humidite !== null && humidite >= 85) {
    return {
      emoji: '💧',
      phrase: maladieActive
        ? 'Air très humide — risque fongique élevé sur cette parcelle en cours de maladie.'
        : 'Air très humide — conditions qui favorisent les maladies fongiques.',
      ton: 'risque',
    };
  }
  if (temperature !== null && temperature >= 30) {
    return { emoji: '☀️', phrase: 'Forte chaleur — arrosez tôt le matin, avant que le soleil monte.', ton: 'vigilance' };
  }
  if (temperature !== null && humidite !== null && temperature >= 24 && humidite >= 75) {
    return {
      emoji: '🌡️',
      phrase: maladieActive ? 'Chaud et humide — risque fongique élevé.' : 'Chaud et humide — surveillez les feuilles du bas.',
      ton: maladieActive ? 'risque' : 'vigilance',
    };
  }
  if (humidite !== null && humidite < 55) {
    return { emoji: '🌡️', phrase: 'Air sec — arrosez plutôt le soir, la terre boit mieux.', ton: 'vigilance' };
  }
  return { emoji: emoji, phrase: 'Temps calme pour la saison — poursuivez le suivi habituel.', ton: 'ok' };
}

const BASE_API = (import.meta.env?.VITE_API_BASE_URL as string | undefined) ?? '/api';

/** Récupère les prévisions pour une parcelle (le serveur relaie Open-Meteo). */
export async function chargerPrevisions(
  parcelleId: string,
  jours = 5,
  baseApi = BASE_API,
  signal?: AbortSignal
): Promise<PrevisionsMeteo> {
  const reponse = await fetch(
    `${baseApi}/meteo/previsions?parcelle_id=${encodeURIComponent(parcelleId)}&jours=${jours}`,
    { signal }
  );
  if (!reponse.ok) {
    throw new Error(`Météo indisponible (HTTP ${reponse.status}).`);
  }
  return (await reponse.json()) as PrevisionsMeteo;
}
