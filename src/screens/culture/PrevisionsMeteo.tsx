import { useEffect, useMemo, useState } from 'react';
import { CloudRain, Info, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fr, type Ton } from '@/lib/meteo-conseil';
import {
  chargerPrevisions,
  conseilPrevision,
  emojiDuCode,
  libelleJour,
  nomDuJour,
  type PrevisionsMeteo,
} from '@/lib/meteo-previsions';

const TONS: Record<Ton, { carte: string; barre: string; texte: string }> = {
  risque: { carte: 'border-red-200 bg-red-50/60', barre: 'bg-gradient-to-r from-red-400 to-red-600', texte: 'text-red-800' },
  vigilance: { carte: 'border-amber-200 bg-amber-50/60', barre: 'bg-gradient-to-r from-amber-400 to-orange-500', texte: 'text-amber-900' },
  ok: { carte: 'border-emerald-200 bg-emerald-50/60', barre: 'bg-gradient-to-r from-emerald-400 to-emerald-600', texte: 'text-emerald-900' },
};

interface PrevisionsMeteoProps {
  parcelleId: string;
  jours?: number;
  /**
   * Données déjà chargées. Sert au rendu hors navigateur (vérification en ligne de
   * commande) : quand elles sont fournies, le composant ne fait aucun appel réseau.
   */
  donneesInitiales?: PrevisionsMeteo | null;
}

/**
 * Les prochains jours, en cartes simples : icône, températures, pluie et une phrase
 * d'action. Le producteur doit comprendre quoi faire sans lire de chiffres.
 */
export function PrevisionsMeteo({ parcelleId, jours = 5, donneesInitiales = null }: PrevisionsMeteoProps) {
  const [donnees, setDonnees] = useState<PrevisionsMeteo | null>(donneesInitiales);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(!donneesInitiales);
  const [rechargement, setRechargement] = useState(0);

  useEffect(() => {
    if (donneesInitiales) return;          // rendu hors navigateur : pas d'appel réseau
    const controleur = new AbortController();
    let annule = false;
    setChargement(true);
    setErreur(null);
    chargerPrevisions(parcelleId, jours, undefined, controleur.signal)
      .then((reponse) => {
        if (!annule) setDonnees(reponse);
      })
      .catch((e) => {
        if (!annule && (e as Error).name !== 'AbortError') setErreur((e as Error).message);
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
      controleur.abort();
    };
  }, [parcelleId, jours, rechargement, donneesInitiales]);

  // « Maladie active » est calculée par le serveur (diagnostic récent ou symptômes des 21 jours) :
  // une seule règle, au même endroit, pour l'onglet Météo et pour la mini-carte d'accueil.
  const cartes = useMemo(() => {
    const previsions = donnees?.previsions ?? [];
    return previsions.map((p, index) => ({
      prevision: p,
      position: index,
      conseil: conseilPrevision(p, index, donnees?.maladie?.active ?? false),
    }));
  }, [donnees]);

  if (chargement && !donnees) {
    return (
      <Card className="border-stone-200/60">
        <CardContent className="p-4 flex items-center gap-2 text-sm text-stone-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement des prévisions…
        </CardContent>
      </Card>
    );
  }

  if (erreur) {
    return (
      <Card className="border-amber-200 bg-amber-50/60">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm text-amber-900">{erreur}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 border-amber-300 text-amber-900"
              onClick={() => setRechargement((n) => n + 1)}
            >
              <RefreshCw className="w-3 h-3 mr-1" /> Réessayer
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Repli : parcelle sans coordonnées GPS (ou service en panne). On l'explique, sans inventer.
  if (donnees && !donnees.disponible) {
    return (
      <Card className="border-amber-200 bg-amber-50/60">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-900 mb-1">Prévisions indisponibles</p>
            <p className="text-sm text-amber-800">{donnees.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (cartes.length === 0) return null;

  const actuel = donnees?.actuel;
  const bloque = cartes[0]?.conseil.bloqueTraitement;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-stone-900 flex items-center gap-2">
          <CloudRain className="w-4 h-4 text-sky-600" />
          Les {cartes.length} prochains jours
        </h3>
        {actuel?.temperature_c !== null && actuel?.temperature_c !== undefined && (
          <span className="text-xs text-stone-500">
            maintenant {fr(actuel.temperature_c, 0)} °C
            {actuel.humidite_pct !== null && actuel.humidite_pct !== undefined ? ` · ${fr(actuel.humidite_pct, 0)} % d'humidité` : ''}
          </span>
        )}
      </div>

      {bloque && (
        <div className="rounded-xl border border-amber-300 bg-amber-100/70 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900 flex items-start gap-2">
            <span aria-hidden="true">🌧️</span>
            <span>Ne traitez pas aujourd'hui, la pluie va laver le produit.</span>
          </p>
          <p className="text-xs text-amber-800 mt-1">
            Attendez la fin des pluies annoncées, puis traitez sur feuillage sec.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cartes.map(({ prevision, position, conseil }) => (
          <Card key={prevision.jour} className={cn('overflow-hidden shadow-sm', TONS[conseil.ton].carte)}>
            <div className={cn('h-1', TONS[conseil.ton].barre)} />
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-900 truncate">
                    {libelleJour(prevision.jour, position)}
                  </p>
                  <p className="text-[11px] text-stone-500 capitalize">
                    {nomDuJour(prevision.jour)} {prevision.jour?.slice(8, 10)}/{prevision.jour?.slice(5, 7)}
                  </p>
                </div>
                <span className="text-2xl leading-none ml-1" aria-hidden="true">
                  {emojiDuCode(prevision.code_meteo)}
                </span>
              </div>

              <p className="text-sm text-stone-800">
                {fr(prevision.temp_min_c, 0)}° <span className="text-stone-400">/</span>{' '}
                <span className="font-semibold">{fr(prevision.temp_max_c, 0)}°C</span>
              </p>
              <p className="text-xs text-stone-600 flex items-center gap-1 mt-0.5">
                <CloudRain className="w-3 h-3" />
                {prevision.pluie_mm !== null && Number(prevision.pluie_mm) > 0
                  ? `${fr(prevision.pluie_mm, 1)} mm`
                  : 'pas de pluie'}
                {prevision.proba_pluie_pct !== null && Number(prevision.proba_pluie_pct) >= 50
                  ? ` · ${fr(prevision.proba_pluie_pct, 0)} %`
                  : ''}
              </p>

              <p className={cn('text-xs mt-2 leading-snug', TONS[conseil.ton].texte)}>{conseil.phrase}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
