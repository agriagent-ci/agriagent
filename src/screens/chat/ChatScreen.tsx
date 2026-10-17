import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Send, X, Sprout, AlertTriangle, NotebookPen, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { envoyerMessage, compresserImage, type MetadonneesChat, type PhotoPreparee } from '@/lib/chat';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Culture, Parcelle } from '@/types/database';

interface Message {
  id: string;
  role: 'producteur' | 'ia';
  texte: string;
  apercu?: string;
  confiance?: MetadonneesChat['confiance'];
  observationId?: string | null;
  enCours?: boolean;
  erreur?: boolean;
}

const SUGGESTIONS = [
  'Mes feuilles du bas ont des taches, est-ce grave ?',
  'Quand dois-je arroser cette semaine ?',
  'Que dois-je vérifier dans ma parcelle aujourd’hui ?',
];

const LIBELLE_CONFIANCE: Record<string, string> = {
  faible: 'confiance faible',
  moyen: 'confiance moyenne',
  eleve: 'confiance élevée',
};

export function ChatScreen() {
  const { profile } = useAuth();
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [parcelles, setParcelles] = useState<Parcelle[]>([]);
  const [cultureId, setCultureId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [saisie, setSaisie] = useState('');
  const [photo, setPhoto] = useState<PhotoPreparee | null>(null);
  const [preparationPhoto, setPreparationPhoto] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const champFichier = useRef<HTMLInputElement>(null);
  const finListe = useRef<HTMLDivElement>(null);

  // ── parcelle et culture actives ─────────────────────────────────────────
  useEffect(() => {
    if (!profile) return;
    let annule = false;
    (async () => {
      const { data: parcellesData } = await supabase
        .from('parcelles')
        .select('*')
        .eq('agriculteur_id', profile.id)
        .order('cree_le', { ascending: false });
      if (annule) return;
      const mesParcelles = (parcellesData ?? []) as Parcelle[];
      setParcelles(mesParcelles);

      if (mesParcelles.length === 0) return;
      const { data: culturesData } = await supabase
        .from('cultures')
        .select('*')
        .in('parcelle_id', mesParcelles.map((p) => p.id))
        .order('cree_le', { ascending: false });
      if (annule) return;
      const mesCultures = (culturesData ?? []) as Culture[];
      setCultures(mesCultures);
      setCultureId((precedent) => precedent ?? mesCultures[0]?.id ?? null);
    })();
    return () => {
      annule = true;
    };
  }, [profile]);

  const cultureActive = useMemo(
    () => cultures.find((c) => c.id === cultureId) ?? cultures[0] ?? null,
    [cultures, cultureId]
  );
  const parcelleActive = useMemo(
    () => parcelles.find((p) => p.id === cultureActive?.parcelle_id) ?? parcelles[0] ?? null,
    [parcelles, cultureActive]
  );

  useEffect(() => {
    finListe.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const choisirPhoto = useCallback(async (fichier: File | undefined) => {
    if (!fichier) return;
    setPreparationPhoto(true);
    try {
      setPhoto(await compresserImage(fichier));
    } catch (e) {
      setMessages((precedent) => [
        ...precedent,
        {
          id: `err-${Date.now()}`,
          role: 'ia',
          texte: (e as Error).message,
          erreur: true,
        },
      ]);
    } finally {
      setPreparationPhoto(false);
      if (champFichier.current) champFichier.current.value = '';
    }
  }, []);

  const envoyer = useCallback(
    async (texteForce?: string) => {
      const question = (texteForce ?? saisie).trim();
      if (!question && !photo) return;
      if (envoiEnCours) return;

      const idUtilisateur = `u-${Date.now()}`;
      const idIa = `ia-${Date.now()}`;
      const apercu = photo?.apercu;

      const historiqueRecent = messages
        .filter((m) => m.texte.trim() && !m.erreur)
        .slice(-6)
        .map((m) => ({
          role: (m.role === 'producteur' ? 'producteur' : 'ia') as 'producteur' | 'ia',
          texte: m.texte,
        }));

      setSaisie('');
      setPhoto(null);
      setEnvoiEnCours(true);
      setMessages((precedent) => [
        ...precedent,
        { id: idUtilisateur, role: 'producteur', texte: question, apercu },
        { id: idIa, role: 'ia', texte: '', enCours: true },
      ]);

      try {
        const meta = await envoyerMessage({
          message: question,
          photo,
          historique: historiqueRecent,
          parcelleId: parcelleActive?.id ?? null,
          cultureId: cultureActive?.id ?? null,
          onMorceau: (morceau) => {
            setMessages((precedent) =>
              precedent.map((m) => (m.id === idIa ? { ...m, texte: m.texte + morceau } : m))
            );
          },
        });
        setMessages((precedent) =>
          precedent.map((m) =>
            m.id === idIa
              ? {
                  ...m,
                  enCours: false,
                  confiance: meta.confiance,
                  observationId: meta.observation_id ?? null,
                }
              : m
          )
        );
      } catch (e) {
        setMessages((precedent) =>
          precedent.map((m) =>
            m.id === idIa
              ? { ...m, enCours: false, erreur: true, texte: (e as Error).message }
              : m
          )
        );
      } finally {
        setEnvoiEnCours(false);
      }
    },
    [saisie, photo, envoiEnCours, parcelleActive, cultureActive, messages]
  );

  return (
    <div className="min-h-screen bg-stone-50 pb-24 md:pb-8">
      <div className="max-w-3xl mx-auto px-4 pt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-stone-900">Assistant AgriAgent</h1>
            <p className="text-xs text-stone-500 truncate">
              {parcelleActive
                ? `Parcelle « ${parcelleActive.nom} »${cultureActive ? ` · ${cultureActive.espece}` : ''}${
                    cultureActive?.stade ? ` · ${cultureActive.stade.replace(/_/g, ' ')}` : ''
                  }`
                : 'Aucune parcelle enregistrée pour le moment'}
            </p>
          </div>
        </div>

        {cultures.length > 1 && (
          <select
            value={cultureId ?? ''}
            onChange={(e) => setCultureId(e.target.value)}
            className="mb-3 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700"
          >
            {cultures.map((c) => (
              <option key={c.id} value={c.id}>
                {c.espece}
                {c.variete ? ` (${c.variete})` : ''}
              </option>
            ))}
          </select>
        )}

        {/* Fil de discussion */}
        <div className="space-y-3">
          {messages.length === 0 && (
            <Card className="border-stone-200/60 p-4">
              <p className="text-sm text-stone-700 mb-1">Bonjour {profile?.nom?.split(' ')[0] ?? ''},</p>
              <p className="text-sm text-stone-500 mb-3">
                Écrivez votre question ou envoyez une photo de vos plants. Je réponds avec
                l’historique de votre parcelle (dernier diagnostic, observations, météo).
              </p>
              <div className="space-y-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => envoyer(s)}
                    className="w-full text-left text-sm rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 px-3 py-2 text-stone-700"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Card>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={cn('flex', m.role === 'producteur' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm',
                  m.role === 'producteur'
                    ? 'bg-emerald-600 text-white rounded-br-sm'
                    : m.erreur
                      ? 'bg-red-50 border border-red-200 text-red-800 rounded-bl-sm'
                      : 'bg-white border border-stone-200/60 text-stone-800 rounded-bl-sm'
                )}
              >
                {m.apercu && (
                  <img
                    src={m.apercu}
                    alt="Photo envoyée"
                    className="mb-2 rounded-lg max-h-48 w-auto object-cover"
                  />
                )}
                <p className="whitespace-pre-line leading-snug">
                  {m.texte || (m.enCours ? '…' : '')}
                </p>

                {m.role === 'ia' && !m.enCours && !m.erreur && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {m.confiance && (
                      <Badge variant="outline" className="text-[10px] bg-stone-50 text-stone-500">
                        {LIBELLE_CONFIANCE[m.confiance] ?? m.confiance}
                      </Badge>
                    )}
                    {m.observationId && (
                      <span className="text-[10px] text-emerald-700 flex items-center gap-1">
                        <NotebookPen className="w-3 h-3" />
                        Symptôme noté dans le carnet
                      </span>
                    )}
                  </div>
                )}

                {m.enCours && (
                  <span className="inline-block mt-1 text-[10px] text-stone-400">réponse en cours…</span>
                )}
              </div>
            </div>
          ))}
          <div ref={finListe} />
        </div>

        {!cultureActive && parcelles.length > 0 && (
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Aucune culture enregistrée sur vos parcelles : je peux répondre, mais sans
            historique de culture.
          </p>
        )}
      </div>

      {/* Zone de saisie, posée au-dessus de la barre de navigation */}
      <div className="fixed bottom-16 md:bottom-0 inset-x-0 z-30 border-t border-stone-200/60 glass">
        <div className="max-w-3xl mx-auto px-3 py-3">
          {photo && (
            <div className="mb-2 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-2">
              <img src={photo.apercu} alt="Aperçu" className="w-12 h-12 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-emerald-900 font-medium">Photo prête à l’envoi</p>
                <p className="text-[11px] text-emerald-700">
                  {Math.round(photo.octets / 1024)} Ko · {photo.largeur}×{photo.hauteur} (compressée sur l’appareil)
                </p>
              </div>
              <button
                onClick={() => setPhoto(null)}
                className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-100"
                aria-label="Retirer la photo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex items-end gap-2">
            <input
              ref={champFichier}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void choisirPhoto(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => champFichier.current?.click()}
              disabled={preparationPhoto || envoiEnCours}
              className="shrink-0 border-stone-300 text-stone-600"
              aria-label="Prendre une photo"
            >
              <Camera className="w-5 h-5" />
            </Button>

            <textarea
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void envoyer();
                }
              }}
              rows={1}
              placeholder={preparationPhoto ? 'Préparation de la photo…' : 'Écrivez votre question…'}
              className="flex-1 resize-none rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 max-h-32"
            />

            <Button
              type="button"
              onClick={() => void envoyer()}
              disabled={envoiEnCours || (!saisie.trim() && !photo)}
              className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
              aria-label="Envoyer"
            >
              {envoiEnCours ? <Sprout className="w-5 h-5 animate-pulse" /> : <Send className="w-5 h-5" />}
            </Button>
          </div>
          <p className="mt-1.5 text-[10px] text-stone-400 text-center">
            L’assistant s’appuie sur vos données réelles ; en cas de doute, montrez les plants à un technicien.
          </p>
        </div>
      </div>
    </div>
  );
}
