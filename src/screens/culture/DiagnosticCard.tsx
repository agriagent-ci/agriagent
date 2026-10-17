import { useCallback, useMemo, useState } from 'react';
import { ChevronDown, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/constants';
import { rendreLisible } from '@/lib/diagnostic-lisible';
import { DiagnosticComplet } from '@/screens/culture/DiagnosticComplet';
import type { Diagnostic, Observation } from '@/types/database';

interface DiagnosticCardProps {
  diagnostic: Diagnostic;
  /** Observation de terrain rattachée : sert à décrire les symptômes en clair. */
  observation?: Observation | null;
  /** Position dans la liste (0 = le plus récent, mis en avant). */
  idx: number;
  /**
   * Afficher l'étiquette « Plus récent ». Faux quand plusieurs diagnostics portent la
   * même date : dans ce cas aucun n'est vraiment le dernier (la table n'a pas
   * d'horodatage).
   */
  estLePlusRecent?: boolean;
}

const CLE_SUIVI = (id: string) => `agri-diagnostic-actions:${id}`;

function lireSuivi(id: string): Record<string, boolean> {
  try {
    const brut = localStorage.getItem(CLE_SUIVI(id));
    return brut ? (JSON.parse(brut) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

/**
 * Une carte de diagnostic, en deux niveaux.
 *
 * NIVEAU 1 « fiche simple » (affiché par défaut) : bandeau vert/jaune/rouge, une phrase
 * en langage courant, les 3 maladies les plus probables avec leur indice, 3 actions à
 * cocher cette semaine. Tout vient de `rendreLisible`, donc des données du diagnostic.
 *
 * NIVEAU 2 « diagnostic complet » (bouton) : le texte intégral de l'agent (voir
 * DiagnosticComplet), qui normalise lui-même les colonnes jsonb — des tableaux d'objets
 * qu'il ne faut jamais rendre directement sous peine de faire planter React.
 */
export function DiagnosticCard({ diagnostic, observation = null, idx, estLePlusRecent = false }: DiagnosticCardProps) {
  const [complet, setComplet] = useState(false);
  const [suivi, setSuivi] = useState<Record<string, boolean>>(() => lireSuivi(diagnostic.id));

  // vue simplifiée, calculée depuis les données réelles
  const lisible = useMemo(() => rendreLisible(diagnostic, observation), [diagnostic, observation]);

  const basculerAction = useCallback((actionId: string) => {
    setSuivi((precedent) => {
      const suivant = { ...precedent, [actionId]: !precedent[actionId] };
      try {
        localStorage.setItem(CLE_SUIVI(diagnostic.id), JSON.stringify(suivant));
      } catch {
        /* navigation privée : on continue sans mémoriser */
      }
      return suivant;
    });
  }, [diagnostic.id]);

  const faites = lisible.actionsSemaine.filter((a) => suivi[a.id]).length;

  return (
    <Card className={idx === 0 ? 'border-emerald-300 shadow-md' : 'border-stone-200/60 shadow-sm'}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Mon diagnostic du {formatDate(diagnostic.date_diagnostic)}</CardTitle>
          <div className="flex items-center gap-2">
            {estLePlusRecent && <Badge className="bg-emerald-600 text-white">Plus récent</Badge>}
            <Badge variant="outline" className="text-xs bg-stone-50">
              {complet ? 'Version complète' : 'Fiche simple'}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4 text-sm">
        {complet ? (
          <DiagnosticComplet diagnostic={diagnostic} onRetour={() => setComplet(false)} />
        ) : (
          <>
            {/* ── Bandeau d'alerte ────────────────────────────────────────── */}
            <div className={`rounded-xl border p-3 ${lisible.bandeau.classes}`}>
              <p className={`font-semibold ${lisible.bandeau.texteClasses}`}>
                <span className="mr-1" aria-hidden="true">{lisible.bandeau.emoji}</span>
                {lisible.bandeau.label}
              </p>
              <p className={`text-xs mt-0.5 opacity-80 ${lisible.bandeau.texteClasses}`}>
                {lisible.bandeau.explication}
              </p>
            </div>

            {/* ── Phrase simple ───────────────────────────────────────────── */}
            <p className="text-base leading-snug text-stone-800">{lisible.phrase}</p>

            {/* ── Top 3 des maladies possibles ────────────────────────────── */}
            {lisible.maladies.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-stone-400 mb-1.5">
                  Maladie probable
                </p>
                <ul className="space-y-1">
                  {lisible.maladies.map((m) => (
                    <li key={`${m.rang}-${m.nom}`} className="flex items-center gap-2 flex-wrap">
                      <span className="w-4 text-xs text-stone-400">{m.rang}.</span>
                      <span className="font-medium text-stone-800">{m.nom}</span>
                      <Badge variant="outline" className={`text-[11px] ${m.indiceClasse}`}>
                        {m.indice}
                      </Badge>
                      {m.nomLatin && <span className="text-[11px] text-stone-400 italic">{m.nomLatin}</span>}
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-stone-400 mt-1.5">
                  « Indice » = la chance que ce soit cette maladie-là, d’après ce qui a été observé.
                </p>
              </div>
            )}

            {/* ── Pourquoi ce verdict ─────────────────────────────────────── */}
            <ul className="space-y-1">
              {lisible.pourquoi.map((p) => (
                <li key={p.texte} className="text-xs text-stone-500 flex gap-2">
                  <span aria-hidden="true">{p.emoji}</span>
                  <span>{p.texte}</span>
                </li>
              ))}
            </ul>

            {/* ── 3 actions à cocher cette semaine ───────────────────────── */}
            {lisible.actionsSemaine.length > 0 && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                <p className="font-medium text-emerald-800 text-xs mb-2 flex items-center gap-1.5">
                  <ListChecks className="w-3.5 h-3.5" />
                  À faire cette semaine ({faites}/{lisible.actionsSemaine.length} faites)
                </p>
                <ul className="space-y-2">
                  {lisible.actionsSemaine.map((action) => {
                    const ok = Boolean(suivi[action.id]);
                    return (
                      <li key={action.id}>
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ok}
                            onChange={() => basculerAction(action.id)}
                            className="mt-0.5 w-4 h-4 accent-emerald-600 shrink-0"
                          />
                          <span className={ok ? 'text-emerald-900/60 line-through' : 'text-emerald-900'}>
                            {action.court}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {lisible.autresActions > 0 && (
                  <p className="text-[11px] text-emerald-700/80 mt-2">
                    + {lisible.autresActions} autre{lisible.autresActions > 1 ? 's' : ''} action
                    {lisible.autresActions > 1 ? 's' : ''} dans le diagnostic complet.
                  </p>
                )}
                <p className="text-[11px] text-stone-400 mt-2">
                  Les cases cochées sont gardées sur cet appareil (rien n’est envoyé).
                </p>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setComplet(true)}
              className="w-full border-stone-300 text-stone-700 hover:text-stone-900"
            >
              Voir le diagnostic complet
              <ChevronDown className="w-4 h-4 ml-1.5" />
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
