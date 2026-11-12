# SECURITY

Plateforme destinée à des enfants : la protection des données et la
minimisation sont des exigences de conception.

## Mesures en place (Phases 1 et 2.1)

- **Minimisation des données** : l'enfant n'a qu'un pseudonyme (validation
  Zod : 2–20 caractères, sans données personnelles). Pas de nom complet,
  d'adresse, de localisation. Testé unitairement (rejet des pseudonymes
  contenant des données personnelles).
- **Mots de passe** : hachage bcrypt (coût 12 configurable via
  `AUTH_BCRYPT_ROUNDS`, borné 10–15). Aucun mot de passe en clair ni dans
  la base ni dans les logs (aucun log du contenu des formulaires).
- **Sessions** : JWT HS256 (jose) signé avec `AUTH_SECRET` (≥ 32
  caractères, requis, absent par défaut) + table `sessions` en
  PostgreSQL. **Stratégie de révocation** : le JWT porte l'identifiant de
  session (`jti`) ; chaque requête vérifie en base que la session existe,
  n'est pas révoquée et n'est pas expirée. Supprimer le cookie ne suffit
  pas : un jeton copié avant déconnexion devient inutilisable (testé).
- **Cookies** : `httpOnly`, `SameSite=Lax`, `Secure` en production,
  expiration alignée sur la session.
- **Limitation des tentatives** : persistée en PostgreSQL (survit aux
  redémarrages) — échecs comptés par e-mail normalisé (minuscules, donc
  anti-contournement par casse) sur une fenêtre glissante de
  `AUTH_ATTEMPT_WINDOW_MIN` minutes (15 par défaut) ; au
  `AUTH_MAX_LOGIN_ATTEMPTS`-ème échec (5), blocage de
  `AUTH_BLOCK_MINUTES` minutes (15) ; les tentatives sont purgées après
  `AUTH_ATTEMPT_RETENTION_HOURS` heures (24). Un nouvel échec pendant le
  blocage le prolonge.
- **Anti-énumération de comptes** : message d'échec unique « E-mail ou
  mot de passe incorrect. » ; comparaison bcrypt factice pour un compte
  inconnu afin d'égaliser le temps de réponse (anti-oracle temporel).
  Trade-off assumé et documenté : l'inscription indique explicitement
  « adresse déjà utilisée » (meilleure UX ; aucun annuaire public de
  comptes n'existe dans le produit).
- **CSRF** : Server Actions Next.js avec vérification d'Origin intégrée ;
  cookie `SameSite=Lax` en seconde barrière.
- **PostgreSQL non exposé** : en dev, bind `127.0.0.1` uniquement ;
  en production, réseau interne Coolify, jamais de port public.
- **Secrets hors du dépôt** : `.env` ignoré par Git, `.env.example` sans
  valeurs réelles, aucun secret par défaut dans le code (démarrage
  refusé sans `AUTH_SECRET`).
- **Validation serveur** : Zod pour toute entrée (auth, pseudonyme,
  génération de questions).
- **Erreurs sans fuite** : les API ne renvoient jamais le détail des
  erreurs techniques (log console côté serveur uniquement).
- **E-mails** : normalisés en minuscules + index unique `LOWER(email)`
  en base (double barrière contre les doublons par casse).
- **Consentement** : `termsAcceptedAt` + `termsVersion` tracés à
  l'inscription.

## Conformité légale (à évaluer)

Le produit visant des mineurs, le RGPD (UE) et les lois locales
applicables (selon les pays de déploiement) imposent des obligations
spécifiques (consentement parental, registre, minimisation). Aucune
démarche de conformité n'a encore été réalisée : cette analyse doit être
menée avec un spécialiste juridique avant toute mise en production avec
de vrais utilisateurs. Ne pas considérer la conformité comme acquise.

## Mesures prévues (Phases 2.2-4)

- Vérification d'autorisation côté serveur sur chaque accès aux données
  enfants (aucune donnée d'un enfant visible d'un autre compte).
- Protection de l'espace parent contre les modifications accidentelles
  depuis l'espace enfant.
- Réinitialisation sécurisée du mot de passe.
- En-têtes de sécurité Next.js (CSP, HSTS…) à configurer.
- Purge des sessions/tentatives anciennes (tâche planifiée ou à
  l'événement).

## Interdits définitifs

Publicité, chat public, profils/résultats publics, partage social,
collecte de données inutiles.
