# Prêt immo — simulateur de capacité d’emprunt (France)

SPA React (Vite + TypeScript + Mantine) pour estimer une capacité d’emprunt immobilier.

Le projet est **à but éducatif** : les résultats dépendent d’hypothèses simplifiées et ne remplacent pas une étude bancaire.

## Fonctionnalités

- Capacité d’emprunt à partir d’un **budget mensuel** (mensualité + assurance)
- Assurance emprunteur :
    - soit **prime mensuelle fixe** (€/mois)
    - soit **taux annuel** (%/an) appliqué au capital (capital initial ou capital restant dû)
- Garantie (caution / hypothèque / PPD) : frais et impact sur une estimation de TAEG
- Tableau d’amortissement mensuel

## Hypothèses (pédagogiques)

- Mensualités constantes
- Conversion du taux annuel nominal en taux mensuel par division par 12
- TAEG estimé via un calcul d’IRR sur des flux mensuels (approximation)
- Ratio d’endettement : 1/3 du revenu (si saisie par revenu)

## Développement

```bash
npm install
npm run dev
```

## Qualité

```bash
npm run lint
npm run build
```

## Tests (unitaires)

Tests unitaires sur le moteur de calcul (Node, sans tests UI React) :

```bash
npm run test
npm run test:run
```

## Déploiement

Le projet est configuré pour un déploiement statique (ex: GitHub Pages) avec un `base` Vite adapté.
