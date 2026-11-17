# BOAD NEXUS (version en ligne)

Outil d'évaluation ex-ante ESG, ODD et d'impact des financements de la BOAD.
Cette version utilise Firebase (projet `boad-nexus-test`) pour la connexion et les données.

## Déploiement sur Render

- **Build Command** : `npm install --include=dev && npm run build`
- **Start Command** : `npm start`
- **Variables d'environnement** :
  - `NODE_ENV` = `production`
  - `NODE_VERSION` = `22`
  - `GEMINI_API_KEY` = la clé Gemini (à ne jamais mettre dans le code)

Après le premier déploiement, ajouter l'adresse Render (`xxx.onrender.com`) dans
Firebase › Authentication › Paramètres › Domaines autorisés.

## Lancer en local

1. `npm install`
2. Créer un fichier `.env` avec `GEMINI_API_KEY=...`
3. `npm run dev`
