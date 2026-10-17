/** Nombre à la française : 25.3 -> "25,3". Tolère une valeur numérique en texte (jsonb/numeric). */
export function fr(valeur, decimales = 1) {
    const n = nombre(valeur);
    if (n === null)
        return '—';
    return n.toLocaleString('fr-FR', {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales,
    });
}
/** "2026-09-27" -> "27/09". */
export function jourCourt(iso) {
    if (!iso)
        return '';
    const [a, m, j] = iso.slice(0, 10).split('-');
    return a && m && j ? `${j}/${m}` : iso.slice(0, 10);
}
function nombre(v) {
    if (v === null || v === undefined || v === '')
        return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
}
function pluieDe(m) {
    return nombre(m.pluie_mm) ?? 0;
}
function tempMaxDe(m) {
    return nombre(m.temp_max_c) ?? nombre(m.temp_moyenne_c);
}
function rhDe(m) {
    return nombre(m.rh_moyenne_pct);
}
function heuresHumides(m) {
    return nombre(m.heures_rh_90);
}
/** Relevés triés du plus récent au plus ancien. */
export function trierReleves(meteo) {
    return [...meteo].sort((a, b) => (a.jour < b.jour ? 1 : a.jour > b.jour ? -1 : 0));
}
/** Cumul de pluie sur les `jours` relevés les plus récents (le dernier inclus). */
export function pluieSur(meteo, jours) {
    return trierReleves(meteo)
        .slice(0, jours)
        .reduce((total, m) => total + pluieDe(m), 0);
}
function ageEnJours(jour, maintenant) {
    const date = new Date(`${jour.slice(0, 10)}T12:00:00Z`).getTime();
    const ecart = Math.floor((maintenant.getTime() - date) / 86400000);
    return Math.max(0, ecart);
}
/** Phrase courte décrivant une journée, pour les mini-cartes. */
export function describeJour(m) {
    const pluie = pluieDe(m);
    const temp = tempMaxDe(m);
    const rh = rhDe(m);
    if (pluie >= 20)
        return 'Grosse pluie';
    if (pluie >= 5)
        return 'Bonne pluie';
    if (pluie >= 0.5)
        return rh !== null && rh >= 85 ? 'Pluie légère, air très humide' : 'Pluie légère';
    if (temp !== null && temp >= 30)
        return 'Forte chaleur';
    if (rh !== null && rh >= 85)
        return 'Air très humide';
    if (temp !== null && temp >= 24 && rh !== null && rh >= 75)
        return 'Chaud et humide';
    return 'Temps calme';
}
/**
 * Le conseil du jour : la première règle qui s'applique gagne, du risque le plus
 * élevé au plus faible. Une seule phrase, simple, avec une icône.
 */
export function getConseilDuJour(meteo, maintenant = new Date()) {
    if (!meteo || meteo.length === 0)
        return null;
    const tries = trierReleves(meteo);
    const dernier = tries[0];
    const pluie24h = pluieDe(dernier);
    const pluie3j = pluieSur(meteo, 3);
    const tempMax = tempMaxDe(dernier);
    const tempMoy = nombre(dernier.temp_moyenne_c);
    const rh = rhDe(dernier);
    const heures = heuresHumides(dernier);
    const date = jourCourt(dernier.jour);
    let conseil;
    // Priorité : d'abord ce qui demande une action physique immédiate (grosse pluie),
    // puis le risque sanitaire (humidité), puis la chaleur, puis la sécheresse.
    if (pluie24h >= 20) {
        conseil = {
            emoji: '🌧️',
            titre: 'Grosse pluie',
            phrase: 'Grosse pluie — vérifiez que l’eau ne stagne pas au pied des plants.',
            ton: 'vigilance',
        };
    }
    else if (rh !== null && rh > 85) {
        conseil = {
            emoji: '💧',
            titre: 'Air très humide',
            phrase: 'Air très humide — risque de mildiou sur la tomate.',
            ton: 'risque',
        };
    }
    else if (tempMax !== null && tempMax > 30) {
        conseil = {
            emoji: '☀️',
            titre: 'Forte chaleur',
            phrase: 'Forte chaleur — pensez à arroser tôt le matin.',
            ton: 'vigilance',
        };
    }
    else if (pluie3j === 0) {
        conseil = {
            emoji: '💧',
            titre: 'Pas de pluie',
            phrase: 'Pas de pluie depuis 3 jours — surveillez l’humidité du sol.',
            ton: 'vigilance',
        };
    }
    else if (tempMoy !== null && rh !== null && tempMoy >= 24 && rh >= 75) {
        conseil = {
            emoji: '🌡️',
            titre: 'Chaud et humide',
            phrase: 'Temps chaud et humide — attention aux maladies fongiques.',
            ton: 'vigilance',
        };
    }
    else if (pluie24h >= 0.5) {
        conseil = {
            emoji: '🌧️',
            titre: 'Pluie légère',
            phrase: 'Pluie légère hier, vos plants ont reçu juste ce qu’il faut.',
            ton: 'ok',
        };
    }
    else if (rh !== null && rh < 55) {
        conseil = {
            emoji: '🌡️',
            titre: 'Air sec',
            phrase: 'Air sec — arrosez plutôt le soir, la terre boit mieux.',
            ton: 'vigilance',
        };
    }
    else {
        conseil = {
            emoji: '☀️',
            titre: 'Temps calme',
            phrase: 'Temps calme pour la saison — poursuivez le suivi habituel.',
            ton: 'ok',
        };
    }
    const secondaires = [];
    if (pluie24h >= 0.5 && pluie24h < 5) {
        secondaires.push(`🌧️ Pluie légère le ${date} : ${fr(pluie24h)} mm, vos plants ont reçu juste ce qu’il faut`);
    }
    else if (pluie24h >= 5) {
        secondaires.push(`🌧️ Pluie le ${date} : ${fr(pluie24h)} mm sur 24 h`);
    }
    else if (pluie24h === 0 && conseil.titre !== 'Pas de pluie') {
        secondaires.push(`☀️ Aucune pluie le ${date}`);
    }
    // L'air très humide reste signalé même quand ce n'est pas le message principal.
    const airTresHumideSignale = rh !== null && rh > 85 && conseil.titre !== 'Air très humide';
    if (airTresHumideSignale) {
        secondaires.push(`💧 Air très humide (${fr(rh, 0)} %) le ${date} — risque de mildiou sur la tomate`);
    }
    if (pluie3j > 0 && pluie3j < 5) {
        secondaires.push(`💧 Cumul des 3 derniers jours : ${fr(pluie3j)} mm seulement`);
    }
    // Pas de doublon avec la ligne « air très humide » juste au-dessus.
    if (heures !== null && heures >= 6 && !airTresHumideSignale) {
        secondaires.push(`💧 ${heures} h d’air très humide (plus de 90 %) le ${date} — conditions qui favorisent les taches`);
    }
    if (tempMax !== null && tempMax >= 30 && !conseil.phrase.startsWith('Forte chaleur')) {
        secondaires.push(`🌡️ Pic de chaleur à ${fr(tempMax)} °C le ${date}`);
    }
    const ageJours = ageEnJours(String(dernier.jour), maintenant);
    const note = ageJours > 2
        ? `Dernier relevé météo le ${date} (il y a ${ageJours} jours) : la météo n’a pas été remise à jour depuis.`
        : null;
    return {
        ...conseil,
        secondaires: secondaires.slice(0, 3),
        dateReleve: String(dernier.jour).slice(0, 10),
        ageJours,
        note,
    };
}
