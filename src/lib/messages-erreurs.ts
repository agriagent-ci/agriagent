/**
 * Messages d'erreur lisibles pour l'inscription et la connexion.
 *
 * Supabase/PostgREST renvoie des erreurs Postgres brutes. Exemple, quand un numéro de
 * téléphone est déjà pris :
 *
 *   code    : 23505
 *   message : duplicate key value violates unique constraint "agriculteurs_telephone_key"
 *   details : Key (telephone)=(+225 07 00 00 00 00) already exists.
 *
 * Affiché tel quel, le producteur ne comprend pas. On traduit donc les codes et les
 * contraintes concernées en phrases utiles ; tout le reste est renvoyé tel quel pour ne
 * pas masquer un vrai incident.
 */

export interface ErreurBase {
  code?: string | null;
  message?: string | null;
  details?: string | null;
}

const MESSAGES_CONTRAINTES: Record<string, string> = {
  agriculteurs_telephone_key:
    'Ce numéro de téléphone est déjà utilisé. Essayez de vous connecter ou utilisez un autre numéro.',
  agriculteurs_email_key: 'Cet email est déjà utilisé. Essayez de vous connecter.',
  agriculteurs_telegram_user_id_key: 'Ce compte Telegram est déjà relié à un autre producteur.',
};

const MESSAGES_AUTH: { motif: RegExp; texte: string }[] = [
  { motif: /user already registered|already been registered/i, texte: 'Cet email est déjà utilisé. Essayez de vous connecter.' },
  { motif: /invalid login credentials/i, texte: 'Email ou mot de passe incorrect.' },
  { motif: /email not confirmed/i, texte: "Votre compte n'est pas encore confirmé : saisissez le code à 8 chiffres reçu par email (regardez aussi les courriers indésirables)." },
  { motif: /password should be at least|password is too short/i, texte: 'Le mot de passe doit contenir au moins 6 caractères.' },
  { motif: /over_email_send_rate_limit|email rate limit/i, texte: 'Trop d’emails envoyés en peu de temps. Réessayez dans quelques minutes.' },
  { motif: /unable to validate email|invalid format/i, texte: "Cet email n'a pas un format valide." },
  { motif: /signups not allowed|signup is disabled/i, texte: 'Les inscriptions sont fermées pour le moment.' },
];

/** Texte à afficher pour une erreur renvoyée par Supabase (inscription ou connexion). */
export function messageErreur(erreur: ErreurBase | null | undefined): string | null {
  if (!erreur) return null;

  const code = erreur.code ?? '';
  const brut = `${erreur.message ?? ''} ${erreur.details ?? ''}`;

  // 23505 = violation d'unicité : on nomme la contrainte concernée.
  if (code === '23505') {
    for (const [contrainte, texte] of Object.entries(MESSAGES_CONTRAINTES)) {
      if (brut.includes(contrainte)) return texte;
    }
    // Colonne citée dans `details` quand le nom de la contrainte n'apparaît pas
    if (/\(\s*telephone\s*\)/i.test(brut)) return MESSAGES_CONTRAINTES.agriculteurs_telephone_key;
    if (/\(\s*email\s*\)/i.test(brut)) return MESSAGES_CONTRAINTES.agriculteurs_email_key;
    if (/\(\s*telegram_user_id\s*\)/i.test(brut)) return MESSAGES_CONTRAINTES.agriculteurs_telegram_user_id_key;
    return 'Ces informations sont déjà utilisées par un autre compte. Essayez de vous connecter.';
  }

  // 23503 = clé étrangère absente. Cas réel : l'email existe déjà, Supabase renvoie un
  // utilisateur « bouchon » dont l'id n'existe pas dans auth.users, et l'insertion du
  // profil échoue sur agriculteurs_auth_user_id_fkey.
  if (code === '23503') {
    return 'Cet email est déjà utilisé. Essayez de vous connecter.';
  }

  // 23514 = contrainte de domaine (CHECK) : ici, un stade ou un statut de culture qui ne
  // figure pas dans la liste acceptée par la base.
  if (code === '23514') {
    if (/cultures_stade_valide/i.test(brut)) {
      return "Ce stade de culture n'est pas accepté. Choisissez un stade dans la liste (pépinière, levée, croissance, floraison…).";
    }
    if (/cultures_statut_valide/i.test(brut)) {
      return "Ce statut de culture n'est pas accepté. Choisissez « en cours », « terminée » ou « abandonnée ».";
    }
    return "Une valeur saisie n'est pas acceptée par la base de données. Vérifiez les dates et les listes de choix.";
  }

  // RLS : la base a refusé l'enregistrement.
  if (code === '42501') {
    return "La base de données a refusé l'enregistrement du profil. Signalez-le : la policy RLS de la table agriculteurs est en cause.";
  }

  for (const regle of MESSAGES_AUTH) {
    if (regle.motif.test(erreur.message ?? '')) return regle.texte;
  }

  return erreur.message ?? 'Une erreur inattendue est survenue. Réessayez.';
}

/** Message pour une erreur d'inscription (même logique, nom explicite côté appelant). */
export function messageErreurInscription(erreur: ErreurBase | null | undefined): string | null {
  return messageErreur(erreur);
}

/** Message quand le compte existe déjà (Supabase renvoie alors 0 identité). */
export const MESSAGE_COMPTE_EXISTANT =
  'Cet email est déjà utilisé. Essayez de vous connecter.';
