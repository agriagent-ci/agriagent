/**
 * Client du chat AgriAgent : compression de la photo puis envoi à l'API backend.
 *
 * L'API est appelée sur la même origine (`/api/chat/stream`) : en HTTPS via le tunnel
 * Cloudflare comme en HTTP direct, ça évite le contenu mixte et le CORS.
 */

// `?.` est indispensable : hors Vite (tests Node, tsx), `import.meta.env` n'existe pas.
const BASE_API = (import.meta.env?.VITE_API_BASE_URL as string | undefined) ?? '/api';

export interface CoutsChat {
  jetons_entree?: number;
  jetons_sortie?: number;
  usd?: number;
  centimes?: number;
}

export interface MetadonneesChat {
  confiance: 'faible' | 'moyen' | 'eleve';
  vision: boolean;
  symptome_detecte: boolean;
  observation_id: string | null;
  cout?: CoutsChat;
  duree_ms?: number;
}

export interface PhotoPreparee {
  base64: string;
  mediaType: string;
  octets: number;
  largeur: number;
  hauteur: number;
  apercu: string;
}

/** Compresse la photo côté client (JPEG, max `maxOctets`) avant de l'envoyer. */
export async function compresserImage(fichier: File, maxOctets = 1_000_000): Promise<PhotoPreparee> {
  const image = await chargerImage(fichier);
  let largeur = image.width;
  let hauteur = image.height;
  let qualite = 0.85;

  // On réduit la qualité, puis la taille, jusqu'à passer sous la limite.
  for (let essai = 0; essai < 8; essai += 1) {
    if (Math.max(largeur, hauteur) > 1600) {
      const facteur = 1600 / Math.max(largeur, hauteur);
      largeur = Math.round(largeur * facteur);
      hauteur = Math.round(hauteur * facteur);
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, largeur);
    canvas.height = Math.max(1, hauteur);
    const contexte = canvas.getContext('2d');
    if (!contexte) throw new Error("Impossible de préparer l'image sur cet appareil.");
    contexte.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resoudre) =>
      canvas.toBlob((b) => resoudre(b), 'image/jpeg', qualite)
    );
    if (!blob) throw new Error("Impossible de compresser l'image.");

    if (blob.size <= maxOctets) {
      const base64 = await blobVersBase64(blob);
      return {
        base64: base64.slice(base64.indexOf(',') + 1),
        mediaType: 'image/jpeg',
        octets: blob.size,
        largeur: canvas.width,
        hauteur: canvas.height,
        apercu: base64,
      };
    }

    if (qualite > 0.45) qualite -= 0.15;
    else {
      largeur = Math.round(largeur * 0.75);
      hauteur = Math.round(hauteur * 0.75);
    }
  }

  throw new Error("Photo trop lourde même après compression. Essayez une photo plus simple.");
}

function chargerImage(fichier: File): Promise<HTMLImageElement> {
  return new Promise((resoudre, rejeter) => {
    const url = URL.createObjectURL(fichier);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resoudre(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      rejeter(new Error("Fichier image illisible."));
    };
    image.src = url;
  });
}

function blobVersBase64(blob: Blob): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resoudre(String(lecteur.result));
    lecteur.onerror = () => rejeter(new Error('Lecture du fichier impossible.'));
    lecteur.readAsDataURL(blob);
  });
}

export interface MessageHistorique {
  role: 'producteur' | 'ia';
  texte: string;
}

export interface ParametresMessage {
  message: string;
  photo?: PhotoPreparee | null;
  /** Derniers échanges : le backend les repasse au modèle pour qu'il ne se répète pas. */
  historique?: MessageHistorique[];
  parcelleId?: string | null;
  cultureId?: string | null;
  /** Appelé à chaque morceau de réponse (affichage au fil de l'eau). */
  onMorceau?: (texte: string) => void;
  signal?: AbortSignal;
  /** Surcharge de l'URL de base (tests hors navigateur). */
  baseApi?: string;
}

/** Envoie le message et lit la réponse en flux (SSE). */
export async function envoyerMessage({
  message,
  photo,
  historique,
  parcelleId,
  cultureId,
  onMorceau,
  signal,
  baseApi,
}: ParametresMessage): Promise<MetadonneesChat> {
  const reponse = await fetch(`${baseApi ?? BASE_API}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      historique: historique ?? [],
      image_base64: photo?.base64 ?? null,
      media_type: photo?.mediaType ?? 'image/jpeg',
      parcelle_id: parcelleId ?? null,
      culture_id: cultureId ?? null,
    }),
    signal,
  });

  if (!reponse.ok || !reponse.body) {
    let detail = `HTTP ${reponse.status}`;
    try {
      const corps = await reponse.json();
      if (corps?.detail) detail = String(corps.detail);
    } catch {
      /* réponse non JSON */
    }
    throw new Error(`L'assistant est indisponible (${detail}).`);
  }

  const lecteur = reponse.body.getReader();
  const decodeur = new TextDecoder();
  let tampon = '';
  let meta: MetadonneesChat | null = null;

  while (true) {
    const { done, value } = await lecteur.read();
    if (done) break;
    tampon += decodeur.decode(value, { stream: true });

    let separateur = tampon.indexOf('\n\n');
    while (separateur !== -1) {
      const bloc = tampon.slice(0, separateur);
      tampon = tampon.slice(separateur + 2);
      separateur = tampon.indexOf('\n\n');

      for (const ligne of bloc.split('\n')) {
        if (!ligne.startsWith('data:')) continue;
        const charge = ligne.slice(5).trim();
        if (!charge) continue;
        let evenement: { type: string; texte?: string; message?: string } & Partial<MetadonneesChat>;
        try {
          evenement = JSON.parse(charge);
        } catch {
          continue;
        }
        if (evenement.type === 'delta' && evenement.texte) {
          onMorceau?.(evenement.texte);
        } else if (evenement.type === 'fin') {
          meta = evenement as MetadonneesChat;
        } else if (evenement.type === 'erreur') {
          throw new Error(evenement.message ?? "Erreur de l'assistant.");
        }
      }
    }
  }

  return (
    meta ?? {
      confiance: 'faible',
      vision: false,
      symptome_detecte: false,
      observation_id: null,
    }
  );
}
