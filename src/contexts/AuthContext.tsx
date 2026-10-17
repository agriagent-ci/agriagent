import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { messageErreur, messageErreurInscription, MESSAGE_COMPTE_EXISTANT } from '@/lib/messages-erreurs';
import { verifierCode as verifierCodeApi, renvoyerCode as renvoyerCodeApi } from '@/lib/verification';
import {
  creerProfil as creerProfilApi,
  infosDepuisUtilisateur,
  type InfosInscription,
} from '@/lib/profil-agriculteur';
import type { Agriculteur } from '@/types/database';

interface ResultatInscription {
  error: string | null;
  /** Vrai quand Supabase exige la confirmation par code : il n'y a alors pas de session. */
  needVerification: boolean;
  email: string | null;
}

interface ResultatConnexion {
  error: string | null;
  /** Vrai quand la connexion échoue parce que le compte n'est pas encore confirmé. */
  needVerification: boolean;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Agriculteur | null;
  loading: boolean;
  /** Adresse en attente de confirmation (inscription ou connexion sur un compte non confirmé). */
  pendingEmail: string | null;
  signIn: (email: string, password: string) => Promise<ResultatConnexion>;
  signUp: (email: string, password: string, nom: string, telephone: string, localite: string) => Promise<ResultatInscription>;
  verifyCode: (code: string) => Promise<{ ok: boolean; message: string | null }>;
  resendCode: () => Promise<{ ok: boolean; message: string | null }>;
  setPendingEmail: (email: string | null) => void;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** L'adresse en attente de confirmation survit à un rechargement de page. */
const CLE_EMAIL_A_CONFIRMER = 'agriagent.email_a_confirmer';

function emailMemorise(): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(CLE_EMAIL_A_CONFIRMER);
  } catch {
    return null;
  }
}

function memoriserEmail(email: string | null) {
  try {
    if (typeof window === 'undefined') return;
    if (email) window.localStorage.setItem(CLE_EMAIL_A_CONFIRMER, email);
    else window.localStorage.removeItem(CLE_EMAIL_A_CONFIRMER);
  } catch {
    /* navigation privée : on continue sans mémoire */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Agriculteur | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingEmail, setPendingEmailEtat] = useState<string | null>(() => emailMemorise());

  const setPendingEmail = (email: string | null) => {
    setPendingEmailEtat(email);
    memoriserEmail(email);
  };

  const fetchProfile = async (uid: string) => {
    const { data, error } = await supabase
      .from('agriculteurs')
      .select('*')
      .eq('auth_user_id', uid)
      .maybeSingle();

    if (error) {
      console.error('Erreur lors du chargement du profil:', error);
      return;
    }
    setProfile(data as Agriculteur | null);
  };

  // La création de la ligne `agriculteurs` vit dans src/lib/profil-agriculteur.ts :
  // la même fonction est rejouée par le test en ligne de commande.
  const creerProfil = (utilisateur: User, infos: InfosInscription, email: string | null) =>
    creerProfilApi(supabase, utilisateur, infos, email);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        (async () => {
          await fetchProfile(session.user.id);
          setLoading(false);
        })();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<ResultatConnexion> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Compte créé mais code jamais saisi : on le conduit vers l'écran de vérification
      // au lieu de le laisser devant « Email not confirmed ».
      const brut = (error.message ?? '').toLowerCase();
      if (brut.includes('not confirmed')) {
        setPendingEmail(email);
        return { error: messageErreur(error), needVerification: true };
      }
      return { error: messageErreur(error), needVerification: false };
    }
    setPendingEmail(null);
    return { error: null, needVerification: false };
  };

  const signUp = async (
    email: string,
    password: string,
    nom: string,
    telephone: string,
    localite: string
  ): Promise<ResultatInscription> => {
    // Les informations du profil voyagent dans les métadonnées de l'utilisateur : elles
    // survivent ainsi à un rechargement de page entre l'inscription et la saisie du code.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nom, telephone, localite } },
    });
    if (error) return { error: messageErreurInscription(error), needVerification: false, email: null };

    if (data.user) {
      // Supabase ne dit pas « cet email existe déjà » : il renvoie un utilisateur
      // bouchon sans identité. On le détecte pour éviter d'insérer un profil fantôme
      // (l'insertion échouerait ensuite sur une clé étrangère, avec un message obscur).
      if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return { error: MESSAGE_COMPTE_EXISTANT, needVerification: false, email: null };
      }

      if (data.session) {
        // Confirmation d'email désactivée : on enchaîne comme avant (profil + connexion).
        const erreurProfil = await creerProfil(data.user, { nom, telephone, localite }, email);
        if (erreurProfil) return { error: erreurProfil, needVerification: false, email: null };
        return { error: null, needVerification: false, email };
      }

      // Confirmation d'email activée : pas de session, donc PAS de profil ici
      // (la politique RLS refuserait l'insertion). On envoie l'utilisateur saisir son code.
      setPendingEmail(email);
      return { error: null, needVerification: true, email };
    }

    return { error: null, needVerification: false, email };
  };

  /** Valide le code reçu par email, puis crée le profil du compte confirmé. */
  const verifyCode = async (code: string) => {
    if (!pendingEmail) {
      return { ok: false, message: "Adresse email inconnue : recommencez l'inscription." };
    }

    const resultat = await verifierCodeApi(supabase, pendingEmail, code);
    if (!resultat.ok) return { ok: false, message: resultat.message };

    const utilisateur = (resultat.session as Session | null)?.user ?? null;
    if (utilisateur) {
      const erreurProfil = await creerProfil(
        utilisateur,
        infosDepuisUtilisateur(utilisateur),
        utilisateur.email ?? pendingEmail
      );
      if (erreurProfil) return { ok: false, message: erreurProfil };
      // La session est posée par onAuthStateChange ; on force la lecture du profil.
      await fetchProfile(utilisateur.id);
    }

    setPendingEmail(null);
    return { ok: true, message: null };
  };

  const resendCode = async () => {
    if (!pendingEmail) {
      return { ok: false, message: "Adresse email inconnue : recommencez l'inscription." };
    }
    return renvoyerCodeApi(supabase, pendingEmail);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error: messageErreur(error) };
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        pendingEmail,
        signIn,
        signUp,
        verifyCode,
        resendCode,
        setPendingEmail,
        signOut,
        resetPassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return context;
}
