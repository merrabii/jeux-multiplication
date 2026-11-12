# UI DESIGN — Univers magique

## Direction artistique

Univers chaleureux et immersif : licornes, fées, dragons sympathiques,
châteaux enchantés, étoiles magiques, forêts enchantées, cristaux.

À éviter absolument : look « tableau de bord », interfaces chargées,
couleurs agressives, animations excessives, petits boutons, textes petits.

## Design system (Phase 1 — tokens dans `app/globals.css`)

| Token | Valeur | Usage |
|---|---|---|
| `--background` | `#2d2a55` | Ciel du royaume (violet profond doux) |
| `--foreground` | `#fdf8ef` | Texte sur fond sombre (contraste élevé) |
| `--royal-star` | `#ffd166` | Étoiles magiques, or doux |
| `--royal-magic` | `#a78bfa` | Violet magique |
| `--royal-fairy` | `#7dd3fc` | Bleu fée |
| `--royal-dragon` | `#86efac` | Vert dragon |
| `--royal-unicorn` | `#f9a8d4` | Rose licorne |
| `--card` | `#fffaf2` | Cartes blanc chaud (lisibilité enfant) |
| `--royal-success` / `--royal-error` | `#4ade80` / `#f87171` | Feedback |

## Typographies

- **Fredoka** (display) : titres, boutons — ronde et chaleureuse.
- **Nunito** (texte) : très lisible, adaptée aux enfants.
- Taille de base `1.0625rem`, line-height 1.6.

## Composants de base

- `.btn-large` : hauteur ≥ 52px, rayon 1rem, retour tactile (`:active` scale).
- Focus clavier : contour or 3px toujours visible.
- `prefers-reduced-motion` : réduit toutes les animations.

## Illustrations

⚠️ **Ressources manquantes (documentées)** : aucune illustration définitive
n'existe encore. Solution provisoire assumée : emojis Unicode + décor CSS
(étoiles). Les images définitives (licornes, dragons, mondes) sont à créer
en Phase 2/3 dans `public/images/` et `public/avatars/` — aucune image
générique ne sera présentée comme définitive.

## Responsive

Approche mobile-first, cibles tactiles larges. Tests de tailles d'écran
prévus en Phase 6 (320px → 1920px).
