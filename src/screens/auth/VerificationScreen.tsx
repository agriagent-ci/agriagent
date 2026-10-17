import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, KeyRound, Loader2, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import {
  DELAI_RENVOI_SECONDES,
  DUREE_VALIDITE_MINUTES,
  LONGUEUR_CODE,
  LONGUEUR_CODE_MAX,
  codeComplet,
  messageDelai,
  secondesRestantes,
} from '@/lib/verification';

interface VerificationScreenProps {
  onBack: () => void;
  /**
   * Adresse à afficher. Normalement lue dans le contexte ; cette entrée sert au rendu
   * hors navigateur (aperçu en ligne de commande), où il n'y a pas de session.
   */
  emailInitial?: string | null;
}

/**
 * Saisie du code reçu par email après l'inscription.
 *
 * Le producteur lit son email sur le même téléphone : un seul champ large, clavier
 * numérique, et aucune action inutile. Le compte n'existe réellement qu'après la
 * validation du code (c'est là que le profil est créé).
 */
export function VerificationScreen({ onBack, emailInitial = null }: VerificationScreenProps) {
  const { pendingEmail, verifyCode, resendCode, setPendingEmail } = useAuth();
  const email = emailInitial ?? pendingEmail;
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [verification, setVerification] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [finDelai, setFinDelai] = useState(() => Date.now() + DELAI_RENVOI_SECONDES * 1000);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const champ = useRef<HTMLInputElement>(null);

  // Décompte du délai de renvoi (une seconde à la fois, sans minuterie qui s'emballe).
  useEffect(() => {
    const tic = window.setInterval(() => setMaintenant(Date.now()), 1000);
    return () => window.clearInterval(tic);
  }, []);

  const reste = useMemo(() => secondesRestantes(finDelai, maintenant), [finDelai, maintenant]);

  useEffect(() => {
    champ.current?.focus();
  }, []);

  const handleValider = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErreur(null);
    setInfo(null);

    if (!codeComplet(code)) {
      setErreur(`Entrez les ${LONGUEUR_CODE} chiffres du code reçu par email.`);
      return;
    }

    setVerification(true);
    const resultat = await verifyCode(code);
    setVerification(false);

    if (!resultat.ok) {
      setErreur(resultat.message);
      setCode('');
      champ.current?.focus();
      return;
    }
    // Succès : la session est ouverte et le profil créé, l'application passe à l'accueil.
  };

  const handleRenvoyer = async () => {
    setErreur(null);
    setInfo(null);
    setEnvoi(true);
    const resultat = await resendCode();
    setEnvoi(false);

    if (!resultat.ok) {
      setErreur(resultat.message);
      return;
    }
    setInfo(resultat.message);
    setFinDelai(Date.now() + DELAI_RENVOI_SECONDES * 1000);
  };

  const changerAdresse = () => {
    setPendingEmail(null);
    onBack();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-stone-50 to-amber-50/30 leaf-pattern p-4">
      <div className="w-full max-w-md">
        <motion.div
          className="flex flex-col items-center mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Logo size={104} className="md:hidden" />
          <Logo size={128} className="hidden md:flex" />
          <h1 className="text-xl font-bold tracking-tight text-stone-900 mt-3">
            Vérifiez votre <span className="text-emerald-600">email</span>
          </h1>
        </motion.div>

        <motion.div
          className="glass rounded-2xl border border-white/40 shadow-xl p-6 md:p-8"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-emerald-700" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-stone-700">
                Nous avons envoyé un code à {LONGUEUR_CODE} chiffres à
              </p>
              <p className="font-semibold text-stone-900 break-all">
                {email ?? 'votre adresse email'}
              </p>
            </div>
          </div>

          <form onSubmit={handleValider} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="code" className="text-stone-700 text-sm font-medium flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-stone-400" /> Code de confirmation
              </label>
              <input
                id="code"
                ref={champ}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, LONGUEUR_CODE_MAX))}
                onPaste={(e) => {
                  const colle = e.clipboardData.getData('text');
                  if (/\d/.test(colle)) {
                    e.preventDefault();
                    setCode(colle.replace(/\D/g, '').slice(0, LONGUEUR_CODE_MAX));
                  }
                }}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={LONGUEUR_CODE_MAX}
                placeholder={'0'.repeat(LONGUEUR_CODE)}
                aria-describedby="aide-code"
                className="w-full h-16 text-center text-3xl font-bold tracking-[0.35em] rounded-xl border border-stone-200 bg-white/80 text-stone-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 outline-none transition"
              />
              <p id="aide-code" className="text-xs text-stone-500">
                Le code arrive en quelques secondes. S'il n'apparaît pas, regardez dans les courriers
                indésirables (spam). Il reste valable {DUREE_VALIDITE_MINUTES} minutes.
              </p>
            </div>

            <AnimatePresence>
              {erreur && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600"
                  role="alert"
                >
                  {erreur}
                </motion.div>
              )}
              {info && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700"
                >
                  {info}
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              disabled={verification || !codeComplet(code)}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-semibold shadow-lg shadow-emerald-600/25 disabled:opacity-60"
            >
              {verification ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
              {verification ? 'Vérification…' : 'Valider'}
            </Button>

            <div className="text-center text-sm">
              <button
                type="button"
                onClick={handleRenvoyer}
                disabled={envoi || reste > 0}
                className={
                  reste > 0 || envoi
                    ? 'text-stone-400 cursor-not-allowed inline-flex items-center gap-1.5'
                    : 'text-emerald-600 font-semibold hover:underline inline-flex items-center gap-1.5'
                }
              >
                {envoi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Renvoyer le code
              </button>
              <p className="text-xs text-stone-500 mt-1">{messageDelai(reste)}</p>
            </div>
          </form>

          <div className="mt-5 pt-4 border-t border-stone-200/70 text-center text-sm">
            <button
              onClick={changerAdresse}
              className="inline-flex items-center gap-1 text-stone-500 hover:text-emerald-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Ce n'est pas ma bonne adresse, recommencer
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
