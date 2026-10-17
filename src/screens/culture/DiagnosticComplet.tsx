import { CheckCircle2, ChevronUp, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { normaliserHypotheses, normaliserSources, normaliserListeTextes } from '@/lib/diagnostic';
import type { Diagnostic } from '@/types/database';

interface DiagnosticCompletProps {
  diagnostic: Diagnostic;
  /** Revenir à la fiche simple (le bouton n'apparaît que si la fonction est fournie). */
  onRetour?: () => void;
}

/**
 * NIVEAU 2 — le diagnostic intégral, tel que rédigé par l'agent agronomique :
 * conclusion, toutes les hypothèses, toutes les actions, informations manquantes,
 * sources consultées.
 *
 * Séparé du niveau 1 pour pouvoir être testé indépendamment (rendu serveur), et parce
 * que les colonnes jsonb sont des tableaux d'objets : elles doivent être normalisées
 * avant tout affichage (sinon React lève « Objects are not valid as a React child »).
 */
export function DiagnosticComplet({ diagnostic, onRetour }: DiagnosticCompletProps) {
  const hypotheses = normaliserHypotheses(diagnostic.hypotheses);
  const actions = normaliserListeTextes(diagnostic.actions_immediates);
  const manquantes = normaliserListeTextes(diagnostic.informations_manquantes);
  const sources = normaliserSources(diagnostic.sources);

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-stone-400">Diagnostic complet rédigé par l’agent agronomique</p>
        {onRetour && (
          <Button variant="outline" size="sm" onClick={onRetour} className="border-stone-300 text-stone-700">
            <ChevronUp className="w-4 h-4 mr-1.5" />
            Revenir à la fiche simple
          </Button>
        )}
      </div>

      {diagnostic.conclusion && (
        <div className="rounded-xl bg-stone-50 border border-stone-200/60 p-3">
          <p className="text-[11px] uppercase tracking-wide text-stone-400 mb-1.5">Conclusion</p>
          <div className="text-stone-800 space-y-2">
            {diagnostic.conclusion
              .split(/\n{2,}/)
              .map((paragraphe) => paragraphe.trim())
              .filter(Boolean)
              .map((paragraphe, i) => (
                <p key={i} className="whitespace-pre-line leading-relaxed">{paragraphe}</p>
              ))}
          </div>
        </div>
      )}

      {diagnostic.niveau_confiance && (
        <p className="text-xs text-stone-500">
          Niveau de confiance de l’agent : <span className="font-medium">{diagnostic.niveau_confiance}</span>
        </p>
      )}

      {hypotheses.length > 0 && (
        <div>
          <p className="font-medium text-stone-700 mb-1.5">Toutes les hypothèses ({hypotheses.length})</p>
          <ol className="space-y-1.5">
            {hypotheses.map((hyp, i) => (
              <li key={`${diagnostic.id}-hyp-${i}`} className="flex gap-2 rounded-lg bg-stone-50 p-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-white border border-stone-200 text-[11px] font-semibold text-stone-500 flex items-center justify-center">
                  {hyp.rang ?? i + 1}
                </span>
                <span className="min-w-0">
                  <span className="font-medium text-stone-800">{hyp.nom}</span>
                  {hyp.indice && (
                    <Badge variant="outline" className="text-[11px] ml-2 align-middle bg-white">
                      indice {hyp.indice}
                    </Badge>
                  )}
                  {hyp.motif && <span className="block text-xs text-stone-500 mt-0.5">{hyp.motif}</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {actions.length > 0 && (
        <div>
          <p className="font-medium text-stone-700 mb-1.5">Toutes les actions demandées ({actions.length})</p>
          <ul className="space-y-1.5">
            {actions.map((action, i) => (
              <li key={`${diagnostic.id}-act-${i}`} className="text-stone-800 flex gap-2">
                <span className="shrink-0">•</span>
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {manquantes.length > 0 && (
        <details className="rounded-xl bg-amber-50/70 border border-amber-100 p-3" open>
          <summary className="cursor-pointer text-xs font-medium text-amber-800 list-none">
            Ce qu’il manque pour affiner ({manquantes.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {manquantes.map((info, i) => (
              <li key={`${diagnostic.id}-info-${i}`} className="text-xs text-amber-900 flex gap-2">
                <span className="shrink-0">•</span>
                <span>{info}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {sources.length > 0 ? (
        <details className="rounded-xl bg-stone-50 border border-stone-200/60 p-3">
          <summary className="cursor-pointer text-xs font-medium text-stone-600 list-none">
            Sources consultées ({sources.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {sources.map((source, i) => (
              <li key={`${diagnostic.id}-src-${i}`} className="text-xs text-stone-600">
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-700 hover:underline inline-flex items-start gap-1"
                  >
                    <ExternalLink className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>{source.titre}</span>
                  </a>
                ) : (
                  <span>{source.titre}</span>
                )}
                {source.apport && <span className="block text-stone-400 mt-0.5">{source.apport}</span>}
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <p className="text-xs text-stone-400 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Aucune source extérieure consultée : ce diagnostic repose sur les données de la parcelle.
        </p>
      )}
    </div>
  );
}
