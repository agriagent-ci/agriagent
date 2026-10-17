/**
 * Traduction d'un diagnostic AgriAgent en langage d'agriculteur.
 *
 * NIVEAU 1 (vue simplifiée) : bandeau vert/jaune/rouge, une phrase, les 3 maladies
 * les plus probables avec leur indice, 3 actions à cocher cette semaine.
 * NIVEAU 2 (vue complète) : le diagnostic intégral, inchangé.
 *
 * Tout est calculé à partir des données réellement en base (hypotheses, conclusion,
 * actions_immediates, informations_manquantes, observation liée). Rien n'est inventé :
 * quand l'information manque, la vue simplifiée le dit.
 */
import type { Diagnostic, Observation } from '../types/database';
import { normaliserHypotheses, normaliserListeTextes, type Hypothese } from './diagnostic';

export type Gravite = 'ok' | 'surveiller' | 'urgent';

export interface Bandeau {
  emoji: string;
  label: string;
  explication: string;
  classes: string;
  texteClasses: string;
}

export interface MaladieProbable {
  rang: string;
  nom: string;
  nomLatin: string | null;
  indice: string;
  indiceClasse: string;
}

export interface ActionSemaine {
  id: string;
  court: string;
  complet: string;
  quand: string | null;
}

export interface Pourquoi {
  emoji: string;
  texte: string;
}

export interface DiagnosticLisible {
  gravite: Gravite;
  bandeau: Bandeau;
  phrase: string;
  maladies: MaladieProbable[];
  actionsSemaine: ActionSemaine[];
  autresActions: number;
  pourquoi: Pourquoi[];
  dateDiagnostic: string;
}

const BANDEAUX: Record<Gravite, Bandeau> = {
  ok: {
    emoji: '🟢',
    label: 'Rien d’inquiétant',
    explication: 'La culture va bien d’après les informations enregistrées.',
    classes: 'border-emerald-200 bg-emerald-50/70',
    texteClasses: 'text-emerald-900',
  },
  surveiller: {
    emoji: '🟡',
    label: 'À surveiller',
    explication: 'Quelque chose est présent, sans urgence : il faut mesurer et suivre.',
    classes: 'border-amber-200 bg-amber-50/70',
    texteClasses: 'text-amber-900',
  },
  urgent: {
    emoji: '🔴',
    label: 'Action urgente',
    explication: 'Il faut intervenir tout de suite dans la parcelle.',
    classes: 'border-red-200 bg-red-50/70',
    texteClasses: 'text-red-900',
  },
};

/** Indices rencontrés en base : eleve, moyen, faible, tres faible (parfois en majuscules). */
export function indiceLisible(indice: string | null | undefined): { texte: string; classe: string } {
  const brut = (indice ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (brut.startsWith('tres') || brut.startsWith('très')) {
    return { texte: 'très faible', classe: 'bg-stone-100 text-stone-500 border-stone-200' };
  }
  if (brut.startsWith('eleve') || brut.startsWith('élevé') || brut.startsWith('fort')) {
    return { texte: 'élevé', classe: 'bg-red-100 text-red-700 border-red-200' };
  }
  if (brut.startsWith('moyen')) {
    return { texte: 'moyen', classe: 'bg-amber-100 text-amber-700 border-amber-200' };
  }
  if (brut.startsWith('faible')) {
    return { texte: 'faible', classe: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  }
  return { texte: brut || 'non précisé', classe: 'bg-stone-100 text-stone-500 border-stone-200' };
}

/** « Corynesporiose (Corynespora cassiicola) » -> nom simple + nom latin séparés. */
export function separerNom(nom: string): { nom: string; nomLatin: string | null } {
  const m = nom.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (!m) return { nom: nom.trim(), nomLatin: null };
  return { nom: m[1].trim(), nomLatin: m[2].trim() };
}

function scoreDepuisIndice(indice: string): number {
  const l = indiceLisible(indice).texte;
  if (l === 'élevé') return 2;
  if (l === 'moyen') return 1;
  return 0;
}

const SIGNES_URGENTS: RegExp[] = [
  /taches?\s+(?:huileuses?\s+)?sur\s+(?:les\s+)?fruits?/i,
  /l[ée]sions?\s+sur\s+(?:les\s+)?fruits?/i,
  /extension\s+aux?\s+(?:jeunes|nouvelles)\s+feuilles/i,
  /(?:taches?|l[ée]sions?|n[ée]cros\w*)\s+(?:sur|des|aux)\s+(?:les\s+)?(?:tiges?|p[ée]tioles?)/i,
  /atteinte\s+des\s+(?:tiges?|p[ée]tioles?)/i,
  /fl[ée]triss\w*/i,
  /pourriture\s+(?:du\s+)?(?:collet|collar|fruit|racine)/i,
];

const NEGATIONS = [
  'jamais', 'aucun', 'aucune', 'n’a pas', "n'a pas", 'non d[ée]crit', 'pas d[ée]crit',
  'ne sont pas', "n'est pas", 'sans ', 'non examin',
];

/**
 * Un signe n'est retenu que s'il décrit une atteinte RÉELLE. Les motifs du diagnostic
 * disent souvent l'inverse (« tiges et fruits n'ont jamais été examinés ») : sans ce
 * filtre, ces phrases feraient passer la fiche en « urgent » à tort.
 */
function contientSigneUrgent(texte: string): boolean {
  const phrases = texte.split(/(?<=[.;])\s+/);
  return phrases.some((phrase) => {
    if (NEGATIONS.some((n) => new RegExp(n, 'i').test(phrase))) return false;
    return SIGNES_URGENTS.some((motif) => motif.test(phrase));
  });
}

function nombreDe(texte: string, motif: RegExp): number | null {
  const m = texte.match(motif);
  return m ? Number(m[1]) : null;
}

/**
 * Gravité : score transparent, calculé uniquement sur les données du diagnostic.
 *   indice de la maladie la plus probable   élevé +2 · moyen +1
 *   atteinte confirmée hors feuilles du bas (tiges, jeunes feuilles, fruits) +2
 *   sévérité observée                       7 et plus +2 · 5-6 +1
 *   contrôle ou point de suivi en retard    +1
 *   mesure chiffrée absente (évolution inconnue) +1
 *   relevé météo interrompu                 +1
 *   6 et plus -> 🔴 action urgente · 3-5 -> 🟡 à surveiller · 2 et moins -> 🟢
 *
 * Les données manquantes comptent, mais moins qu'une atteinte réelle : un dossier
 * incomplet donne « à surveiller », pas « urgent ».
 */
export function calculerGravite(
  hypotheses: Hypothese[],
  actions: string[],
  manquantes: string[],
  conclusion: string | null,
  observation: Observation | null = null
): { gravite: Gravite; score: number; raisons: string[] } {
  const raisons: string[] = [];
  let score = 0;

  const tete = hypotheses[0];
  if (tete) {
    const points = scoreDepuisIndice(tete.indice ?? '');
    score += points;
    if (points > 0) {
      raisons.push(`La maladie la plus probable est « ${separerNom(tete.nom).nom} » (indice ${indiceLisible(tete.indice).texte}).`);
    }
  }

  const texteMotifs = hypotheses.map((h) => h.motif ?? '').join(' ');
  if (contientSigneUrgent(texteMotifs)) {
    score += 2;
    raisons.push('Une atteinte est décrite au-delà des feuilles du bas (tiges, jeunes feuilles ou fruits).');
  }

  if (observation && typeof observation.severite === 'number') {
    if (observation.severite >= 7) {
      score += 2;
      raisons.push(`La sévérité relevée sur le terrain est forte (${observation.severite}/9).`);
    } else if (observation.severite >= 5) {
      score += 1;
      raisons.push(`La sévérité relevée sur le terrain est moyenne (${observation.severite}/9).`);
    }
  }

  const actionRetard = actions.find((a) => /retard/i.test(a));
  if (actionRetard) {
    score += 1;
    const jours = nombreDe(actionRetard, /(\d+)\s*jour[s]?\s*de retard/i);
    raisons.push(jours ? `Le contrôle demandé a ${jours} jours de retard.` : 'Un contrôle demandé est en retard.');
  }

  if (manquantes.some((m) => /incidence|pourcentage|progression|hauteur du front/i.test(m))) {
    score += 1;
    raisons.push('Aucune mesure chiffrée (nombre de plants atteints, hauteur des taches) : impossible de savoir si la maladie avance.');
  }

  if (manquantes.some((m) => /relev[ée] m[ée]t[ée]o|aucun relev[ée]/i.test(m))) {
    score += 1;
  }

  const conclusionBasse = (conclusion ?? '').toLowerCase();
  if (/aucune donn[ée]e nouvelle|ind[ée]termin|inchang/i.test(conclusionBasse)) {
    raisons.push('Le diagnostic n’a pas de donnée nouvelle : il reconduit le précédent.');
  }

  const gravite: Gravite = score >= 6 ? 'urgent' : score >= 3 ? 'surveiller' : 'ok';
  return { gravite, score, raisons };
}

/** Phrase simple, construite sur ce qui est réellement décrit dans l'observation. */
export function phraseSimple(gravite: Gravite, observation: Observation | null, maladie: string | null): string {
  const organe = (observation?.organe_atteint ?? '').toLowerCase();
  const description = (observation?.description ?? '').toLowerCase();

  let debut: string;
  if (organe.includes('basse') || /feuilles du bas|bas du plant/i.test(description)) {
    debut = 'Vos feuilles du bas ont des taches';
  } else if (organe.includes('milieu') || /feuilles du milieu/i.test(description)) {
    debut = 'Vos feuilles du milieu ont des taches';
  } else if (organe.includes('jeune') || organe.includes('haute')) {
    debut = 'Vos jeunes feuilles sont atteintes';
  } else if (observation?.categorie === 'symptome') {
    debut = 'Des taches sont apparues sur vos plants';
  } else if (observation) {
    debut = 'Quelque chose a été noté sur vos plants';
  } else {
    debut = 'Aucune observation de terrain récente';
  }

  const severite = observation?.severite ?? null;
  if (severite !== null && severite >= 7) {
    debut += ' et elles sont fortes';
  }

  if (gravite === 'ok') {
    return `${debut}. Rien d’inquiétant pour l’instant : continuez à regarder vos plants chaque semaine.`;
  }
  if (gravite === 'surveiller') {
    return `${debut}. Ce n’est pas grave pour l’instant, mais il faut agir vite pour savoir si ça s’étend.`;
  }
  const nomCourt = maladie ? ` (${maladie})` : '';
  return `${debut}${nomCourt}. Il faut intervenir maintenant : faites les actions ci-dessous sans attendre.`;
}

/** 3 actions « cette semaine », raccourcies et priorisées. */
export function actionsDeLaSemaine(actions: string[], maximum = 3): { retenues: ActionSemaine[]; reste: number } {
  const notees = actions.map((texte, index) => {
    const bas = texte.toLowerCase();
    let priorite = 5;
    if (/aujourd|dès que possible|des que possible|maintenant/.test(bas)) priorite = 1;
    else if (/chaque jour|du jour/.test(bas)) priorite = 2;
    else if (/avant le|au plus tard/.test(bas)) priorite = 3;
    if (/contrôle chiffré|controle chiffre/.test(bas)) priorite -= 0.5; // le contrôle chiffré passe devant
    return { index, texte, priorite };
  });

  notees.sort((a, b) => a.priorite - b.priorite || a.index - b.index);

  const retenues = notees.slice(0, maximum).map(({ index, texte }) => ({
    id: `a${index}`,
    court: raccourcirAction(texte),
    complet: texte,
    quand: extraireQuand(texte),
  }));

  return { retenues, reste: Math.max(0, notees.length - maximum) };
}

/** « Aujourd'hui ou dès que possible : refaire un contrôle chiffré — compter… » -> « Aujourd'hui : refaire un contrôle chiffré » */
export function raccourcirAction(texte: string, limite = 100): string {
  let t = texte.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();

  // Tout ce qui suit le tiret de justification est du commentaire : on le laisse au niveau 2.
  t = t.split(' — ')[0].split(' – ')[0].trim();

  // « Aujourd'hui ou dès que possible » : on garde un repère court.
  t = t.replace(/^(aujourd’hui|aujourd'hui)\s+ou\s+d[èe]s que possible/i, 'Aujourd’hui');
  t = t.replace(/^(aujourd’hui|aujourd'hui)\s*:\s*/i, 'Aujourd’hui : ');

  // On coupe à la première proposition utile, jamais au milieu d'un mot.
  if (t.length > limite) {
    const coupe = t.slice(0, limite);
    const dernierSep = Math.max(coupe.lastIndexOf(', '), coupe.lastIndexOf(' ; '), coupe.lastIndexOf('; '));
    t = `${(dernierSep > 45 ? coupe.slice(0, dernierSep) : coupe).trim()}…`;
  }

  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Repère de temps placé en tête d'une action (« Aujourd'hui », « avant le 5 octobre 2026 »…). */
export function extraireQuand(texte: string): string | null {
  const m = texte.match(/^(aujourd’hui|aujourd'hui)[^:]{0,30}:/i);
  if (m) return 'aujourd’hui';
  const avant = texte.match(/^(avant le|au plus tard le|chaque jour)[^:.]{0,40}/i);
  if (avant) return avant[0].toLowerCase().trim();
  return null;
}

/** Vue simplifiée complète, prête à afficher. */
export function rendreLisible(
  diagnostic: Diagnostic,
  observation: Observation | null = null
): DiagnosticLisible {
  const hypotheses = normaliserHypotheses(diagnostic.hypotheses);
  const actions = normaliserListeTextes(diagnostic.actions_immediates);
  const manquantes = normaliserListeTextes(diagnostic.informations_manquantes);

  const { gravite, raisons } = calculerGravite(hypotheses, actions, manquantes, diagnostic.conclusion, observation);
  const bandeau = BANDEAUX[gravite];

  const maladies: MaladieProbable[] = hypotheses.slice(0, 3).map((h, i) => {
    const { nom, nomLatin } = separerNom(h.nom);
    const indice = indiceLisible(h.indice);
    return {
      rang: h.rang ?? String(i + 1),
      nom,
      nomLatin,
      indice: indice.texte,
      indiceClasse: indice.classe,
    };
  });

  const { retenues, reste } = actionsDeLaSemaine(actions);

  const pourquoi: Pourquoi[] = raisons.slice(0, 3).map((texte, i) => ({
    emoji: i === 0 ? '🔎' : i === 1 ? '⏱️' : '📏',
    texte,
  }));

  if (pourquoi.length === 0) {
    pourquoi.push({ emoji: '🔎', texte: 'Aucun signe préoccupant n’est décrit dans ce diagnostic.' });
  }

  return {
    gravite,
    bandeau,
    phrase: phraseSimple(gravite, observation, maladies[0]?.nom ?? null),
    maladies,
    actionsSemaine: retenues,
    autresActions: reste,
    pourquoi,
    dateDiagnostic: diagnostic.date_diagnostic,
  };
}
