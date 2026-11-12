# SECURITY

Plateforme destinée à des enfants : la protection des données et la
minimisation sont des exigences de conception.

## Mesures en place (Phase 1)

- **Minimisation des données** : l'enfant n'a qu'un pseudonyme (validation
  Zod : 2–20 caractères, sans données personnelles). Pas de nom complet,
  d'adresse, de localisation. Testé unitairement (rejet des pseudonymes
  contenant des données personnelles).
- **Pas de mot de passe en clair** : colonne `passwordHash` (hachage à
  implémenter en Phase 2 avec bcrypt, coût ≥ 10).
- **PostgreSQL non exposé** : en dev, bind `127.0.0.1` uniquement ;
  en production, réseau interne Coolify, jamais de port public.
- **Secrets hors du dépôt** : `.env` ignoré par Git, `.env.example` sans
  valeurs réelles, Docker injecte les variables.
- **Validation serveur** : Zod pour toute entrée d'API (principe posé,
  `/api/health` n'a pas d'entrée utilisateur).
- **Erreurs sans fuite** : l'API de santé ne renvoie jamais le détail de
  l'erreur au client (log console côté serveur uniquement).

## Mesures prévues (Phases 2-4)

- Hachage bcrypt + limitation des tentatives de connexion (table
  dédiée).
- Sessions cookies httpOnly + Secure + SameSite=Lax, expiration.
- Vérification d'autorisation côté serveur sur chaque accès aux données
  enfants (aucune donnée d'un enfant visible d'un autre compte).
- Protection de l'espace parent contre les modifications accidentelles
  depuis l'espace enfant.
- Réinitialisation sécurisée du mot de passe.
- En-têtes de sécurité Next.js (CSP, HSTS…) à configurer en Phase 2.

## Conformité légale (à évaluer)

Le produit visant des mineurs, le RGPD (UE) et les lois locales
applicables (selon les pays de déploiement) imposent des obligations
spécifiques (consentement parental, registre, minimisation). Aucune
démarche de conformité n'a encore été réalisée : cette analyse doit être
menée avec un spécialiste juridique avant toute mise en production avec
de vrais utilisateurs. Ne pas considérer la conformité comme acquise.

## Interdits définitifs

Publicité, chat public, profils/résultats publics, partage social,
collecte de données inutiles.
