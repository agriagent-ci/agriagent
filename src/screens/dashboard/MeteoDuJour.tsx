import { useEffect, useState } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { fr, type Ton } from '@/lib/meteo-conseil';
import { chargerPrevisions, conseilDuMoment, emojiDuCode, type PrevisionsMeteo } from '@/lib/meteo-previsions';

const TONS: Record<Ton, string> = {
  risque: 'border-red-200 bg-red-50/70',
  vigilance: 'border-amber-200 bg-amber-50/70',
  ok: 'border-emerald-200 bg-emerald-50/70',
};

interface MeteoDuJourProps {
  parcelleId: string;
  /** Ouvre l'onglet Météo complet. */
  onOuvrirMeteo?: () => void;
  /** Données déjà chargées : rendu hors navigateur (vérification en ligne de commande). */
  donneesInitiales?: PrevisionsMeteo | null;
}

/**
 * Mini-carte de l'écran Accueil : la météo du moment en une phrase, et un accès direct
 * à l'onglet Météo. Volontairement compacte : elle ne doit pas pousser les cultures plus bas.
 */
export function MeteoDuJour({ parcelleId, onOuvrirMeteo, donneesInitiales = null }: MeteoDuJourProps) {
  const [donnees, setDonnees] = useState<PrevisionsMeteo | null>(donneesInitiales);
  const [chargement, setChargement] = useState(!donneesInitiales);

  useEffect(() => {
    if (donneesInitiales) return;          // rendu hors navigateur : pas d'appel réseau
    const controleur = new AbortController();
    let annule = false;
    setChargement(true);
    chargerPrevisions(parcelleId, 5, undefined, controleur.signal)
      .then((reponse) => {
        if (!annule) setDonnees(reponse);
      })
      .catch(() => {
        if (!annule) setDonnees(null);
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
      controleur.abort();
    };
  }, [parcelleId, donneesInitiales]);

  if (chargement && !donnees) {
    return (
      <Card className="border-stone-200/60">
        <CardContent className="p-3 flex items-center gap-2 text-sm text-stone-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Météo du jour…
        </CardContent>
      </Card>
    );
  }

  // Parcelle sans GPS : on le dit en une ligne, sans en faire un bloc d'erreur.
  if (donnees && !donnees.disponible) {
    return (
      <Card className="border-amber-200 bg-amber-50/70">
        <CardContent className="p-3 flex items-center gap-3">
          <span className="text-2xl leading-none" aria-hidden="true">📍</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-900">Météo indisponible</p>
            <p className="text-xs text-amber-800">
              Ajoutez les coordonnées GPS de cette parcelle pour voir sa météo.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!donnees?.disponible) return null;

  const actuel = donnees.actuel;
  const conseil = conseilDuMoment(actuel, donnees.maladie?.active ?? false);
  const emoji = emojiDuCode(actuel?.code_meteo);

  return (
    <Card
      className={cn(
        'overflow-hidden shadow-sm transition-colors',
        onOuvrirMeteo && 'cursor-pointer hover:border-emerald-300',
        TONS[conseil.ton]
      )}
      onClick={onOuvrirMeteo}
      role={onOuvrirMeteo ? 'button' : undefined}
      tabIndex={onOuvrirMeteo ? 0 : undefined}
      onKeyDown={(e) => {
        if (onOuvrirMeteo && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onOuvrirMeteo();
        }
      }}
    >
      <CardContent className="p-3 flex items-center gap-3">
        <span className="text-3xl leading-none shrink-0" aria-hidden="true">{emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-stone-900">
            {fr(actuel?.temperature_c, 0)} °C
            {donnees.parcelle?.nom ? <span className="font-normal text-stone-500"> · {donnees.parcelle.nom}</span> : null}
          </p>
          <p className="text-xs text-stone-700 leading-snug">{conseil.phrase}</p>
        </div>
        {onOuvrirMeteo && (
          <span className="text-xs text-stone-500 flex items-center gap-0.5 shrink-0">
            Météo <ChevronRight className="w-3 h-3" />
          </span>
        )}
      </CardContent>
    </Card>
  );
}
