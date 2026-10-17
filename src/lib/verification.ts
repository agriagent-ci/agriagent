/**
 * Vérification d'inscription par code à 6 chiffres (OTP Supabase).
 *
 * Règles et appels réseau isolés ici — et non dans l'écran — pour pouvoir être rejoués
 * sous Node (`npx tsx scripts/test-otp.ts`) sans navigateur.
 */

/**
 * Longueur attendue : 8 chiffres — c'est le réglage « Email OTP Length » du projet,
 * confirmé par un code réel renvoyé par Supabase. Choix du propriétaire du projet.
 */
export const LONGUEUR_CODE = 8;
/** Longueur maximale acceptée dans le champ (identique : on ne saisit que ce code-là). */
export const LONGUEUR_CODE_MAX = 8;
/** Délai avant de pouvoir redemander un code. */
export const DELAI_RENVOI_SECONDES = 60;

export interface ResultatVerification {
  ok: boolean;
  message: string | null;
}

export interface ResultatEnvoi {
  ok: boolean;
  message: string | null;
}

/** Client Supabase minimal dont ce module a besoin (facilite les tests hors navigateur). */
export interface ClientAuth {
  auth: {
    verifyOtp(options: { email: string; token: string; type: 'signup' }): Promise<{
      data: { session?: { user?: unknown } | null } | null;
      error: { message?: string } | null;
    }>;
    resend(options: { type: 'signup'; email: string }): Promise<{
      error: { message?: string } | null;
    }>;
  };
}

/** Ne garde que les chiffres, borné à la longueur maximale acceptée. */
export function normaliserCode(saisie: string | null | undefined): string {
  return (saisie ?? '').replace(/\D/g, '').slice(0, LONGUEUR_CODE_MAX);
}

/** Vrai quand la saisie a la longueur minimale attendue. */
export function codeComplet(saisie: string | null | undefined): boolean {
  return normaliserCode(saisie).length >= LONGUEUR_CODE;
}

/** Secondes restantes avant de pouvoir renvoyer un code (0 = autorisé). */
export function secondesRestantes(expireLe: number, maintenant: number = Date.now()): number {
  return Math.max(0, Math.ceil((expireLe - maintenant) / 1000));
}

/** Le code expire côté Supabase au bout d'une heure : on le dit en clair. */
export const DUREE_VALIDITE_MINUTES = 60;

export function messageDelai(secondes: number): string {
  if (secondes <= 0) return 'Vous pouvez renvoyer un code.';
  return `Vous pourrez renvoyer un code dans ${secondes} s.`;
}

/**
 * Traduit les messages de Supabase en phrases utilisables par un producteur.
 * Les messages techniques (« Token has expired or is invalid ») ne veulent rien dire
 * pour quelqu'un qui lit depuis son téléphone au champ.
 */
export function messageErreurCode(message: string | null | undefined): string {
  const brut = (message ?? '').trim();
  const m = brut.toLowerCase();

  if (!brut) return 'La vérification a échoué. Réessayez.';
  if (m.includes('expired') || m.includes('expiré')) {
    return "Ce code a expiré. Appuyez sur « Renvoyer le code » pour en recevoir un nouveau.";
  }
  if (m.includes('invalid') || m.includes('incorrect') || m.includes('token')) {
    return "Ce code n'est pas le bon. Vérifiez les chiffres reçus par email et réessayez.";
  }
  if (m.includes('rate') || m.includes('too many') || m.includes('security')) {
    return "Trop d'essais en peu de temps. Patientez une minute avant de réessayer.";
  }
  if (m.includes('not found') || m.includes('no user') || m.includes('user not')) {
    return "Nous n'avons pas retrouvé ce compte. Recommencez l'inscription.";
  }
  if (m.includes('already') && m.includes('confirm')) {
    return 'Ce compte est déjà confirmé : vous pouvez vous connecter.';
  }
  // « Error sending confirmation email », « Error sending recovery email » : ce n'est pas
  // la faute du producteur, c'est le service d'email du serveur (SMTP) qui ne répond pas.
  if (m.includes('sending') && m.includes('email')) {
    return "Nous n'avons pas pu envoyer l'email pour le moment. Réessayez dans quelques minutes ; "
      + "si cela dure, signalez-le à l'assistant AgriAgent (service d'email indisponible).";
  }
  return brut;
}

/** Vérifie le code auprès de Supabase. Succès = une session est ouverte. */
export async function verifierCode(
  client: ClientAuth,
  email: string,
  code: string
): Promise<{ ok: boolean; session: unknown; message: string | null }> {
  const propre = normaliserCode(code);
  if (!codeComplet(propre)) {
    return {
      ok: false,
      session: null,
      message: `Le code doit comporter ${LONGUEUR_CODE} chiffres.`,
    };
  }

  const { data, error } = await client.auth.verifyOtp({ email, token: propre, type: 'signup' });
  if (error) {
    return { ok: false, session: null, message: messageErreurCode(error.message) };
  }
  const session = data?.session ?? null;
  if (!session) {
    return {
      ok: false,
      session: null,
      message: 'Le code a été accepté mais la session n\'a pas pu être ouverte. Réessayez.',
    };
  }
  return { ok: true, session, message: null };
}

/** Redemande un code d'inscription pour la même adresse. */
export async function renvoyerCode(client: ClientAuth, email: string): Promise<ResultatEnvoi> {
  const { error } = await client.auth.resend({ type: 'signup', email });
  if (error) {
    const m = (error.message ?? '').toLowerCase();
    if (m.includes('rate') || m.includes('too many') || m.includes('security')) {
      return { ok: false, message: "Un code vient déjà d'être envoyé. Attendez une minute." };
    }
    // Supabase ne révèle pas si l'adresse existe : on reste neutre sur ce cas.
    return { ok: false, message: messageErreurCode(error.message) };
  }
  return { ok: true, message: 'Nouveau code envoyé par email.' };
}

/** Message affiché au producteur après une inscription qui exige une confirmation. */
export function messageInscriptionAvecCode(email: string): string {
  return `Nous avons envoyé un code à ${LONGUEUR_CODE} chiffres à ${email}. Saisissez-le pour activer votre compte.`;
}
