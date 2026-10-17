/**
 * Normalisation des diagnostics AgriAgent.
 *
 * Les colonnes jsonb de `diagnostics` (hypotheses, sources, informations_manquantes,
 * actions_immediates) sont des TABLEAUX, et leur contenu est hétérogène selon l'agent
 * qui a écrit la ligne :
 *   - hypotheses            : [{ rang, hypothese, motif, indice }] (rang parfois "1", parfois 1)
 *   - sources               : [{ url, titre, apport }] ou ["https://..."] ou []
 *   - informations_manquantes : ["texte", ...]
 *   - actions_immediates    : ["texte", ...]
 * Les rendre directement en JSX fait planter React (« Objects are not valid as a
 * React child ») : tout passe donc par les fonctions ci-dessous.
 */

export interface Hypothese {
  rang: string | null;
  nom: string;
  motif: string | null;
  indice: string | null;
}

export interface Source {
  titre: string;
  url: string | null;
  apport: string | null;
}

type Objet = Record<string, unknown>;

function estObjet(v: unknown): v is Objet {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function premiersMots(texte: string, max = 120): string {
  const propre = texte.replace(/\s+/g, ' ').trim();
  return propre.length > max ? `${propre.slice(0, max - 1)}…` : propre;
}

function versTexte(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' ? null : t;
  }
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return null;
}

/** Tableau de chaînes attendu ; tolère une chaîne seule, un objet, ou null. */
export function normaliserListeTextes(valeur: unknown): string[] {
  if (valeur === null || valeur === undefined) return [];
  if (typeof valeur === 'string') return valeur.trim() ? [valeur.trim()] : [];
  if (Array.isArray(valeur)) {
    return valeur
      .map((e) => versTexte(e) ?? (estObjet(e) ? premiersMots(Object.values(e).map(versTexte).filter(Boolean).join(' — ')) : null))
      .filter((t): t is string => Boolean(t));
  }
  if (estObjet(valeur)) {
    const texte = versTexte(valeur.texte) ?? versTexte(valeur.libelle) ?? versTexte(valeur.valeur);
    return texte ? [texte] : [premiersMots(Object.values(valeur).map(versTexte).filter(Boolean).join(' — '))].filter(Boolean);
  }
  return [];
}

/** Hypothèses : objets {rang, hypothese, motif, indice}, tolérant sur les clés. */
export function normaliserHypotheses(valeur: unknown): Hypothese[] {
  if (valeur === null || valeur === undefined) return [];
  const elements: unknown[] = Array.isArray(valeur) ? valeur : [valeur];

  return elements
    .map((e, i): Hypothese | null => {
      if (typeof e === 'string') {
        const t = e.trim();
        return t ? { rang: String(i + 1), nom: t, motif: null, indice: null } : null;
      }
      if (!estObjet(e)) return null;

      const nom =
        versTexte(e.hypothese) ??
        versTexte(e.nom) ??
        versTexte(e.libelle) ??
        versTexte(e.hypothese_principale) ??
        // dernier recours : première valeur texte de l'objet
        (Object.values(e).map(versTexte).find(Boolean) as string | undefined) ??
        null;
      if (!nom) return null;

      return {
        rang: versTexte(e.rang) ?? versTexte(e.priorite) ?? String(i + 1),
        nom: premiersMots(nom, 160),
        motif: versTexte(e.motif) ?? versTexte(e.motifs) ?? versTexte(e.raison),
        indice: versTexte(e.indice) ?? versTexte(e.niveau) ?? versTexte(e.indice_confiance),
      };
    })
    .filter((h): h is Hypothese => h !== null);
}

/** Sources : objets {url, titre, apport}, chaînes d'URL, ou mélange. */
export function normaliserSources(valeur: unknown): Source[] {
  if (valeur === null || valeur === undefined) return [];
  const elements: unknown[] = Array.isArray(valeur) ? valeur : [valeur];

  return elements
    .map((e): Source | null => {
      if (typeof e === 'string') {
        const t = e.trim();
        if (!t) return null;
        return { titre: t, url: /^https?:\/\//i.test(t) ? t : null, apport: null };
      }
      if (!estObjet(e)) return null;

      const url = versTexte(e.url) ?? versTexte(e.lien) ?? null;
      const titre =
        versTexte(e.titre) ?? versTexte(e.titre_source) ?? versTexte(e.nom) ?? url ??
        (Object.values(e).map(versTexte).find(Boolean) as string | undefined) ?? null;
      if (!titre) return null;

      // apport : uniquement les clés prévues, sinon on répéterait le titre.
      const apport = versTexte(e.apport) ?? versTexte(e.resume) ?? versTexte(e.apport_principal) ?? null;

      return { titre: premiersMots(titre, 160), url, apport };
    })
    .filter((s): s is Source => s !== null);
}
