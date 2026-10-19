/**
 * Aperçu de l'état vide « Mes cultures » (celui de Dashboard.tsx) rendu avec les vrais
 * composants, pour contrôler de ses yeux le logo officiel sur téléphone.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/apercu-etat-vide.tsx
 *   -> écrit dist/apercu-etat-vide.html (CSS réellement construit, inlinée)
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { Logo } from "../src/components/Logo";
import { Card, CardContent } from "../src/components/ui/card";
import { Button } from "../src/components/ui/button";
import { Plus } from "lucide-react";

const css = readdirSync("dist/assets").filter((f) => f.endsWith(".css")).map((f) => readFileSync(`dist/assets/${f}`, "utf8")).join("\n");

const carte = createElement(
  Card,
  { className: "border-dashed border-2 border-stone-200" },
  createElement(
    CardContent,
    { className: "p-10 text-center" },
    createElement(Logo, { size: 80, className: "mx-auto mb-4" }),
    createElement("p", { className: "text-stone-500 mb-4" }, "Aucune culture enregistrée pour le moment."),
    createElement(
      Button,
      { className: "bg-emerald-600 hover:bg-emerald-700 shadow-primary" },
      createElement(Plus, { className: "w-4 h-4 mr-1" }),
      "Ajouter votre première culture"
    )
  )
);

const page = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/favicon.ico" sizes="any">
<title>Aperçu — état vide Mes cultures</title><style>${css}</style></head>
<body class="bg-stone-50"><div class="p-6 max-w-md mx-auto">
<p class="text-xs uppercase tracking-wide text-stone-400 mb-2">Mes cultures</p>
${renderToStaticMarkup(carte)}
</div></body></html>`;

writeFileSync("dist/apercu-etat-vide.html", page, "utf8");
console.log("écrit : dist/apercu-etat-vide.html (" + page.length + " o)");
