# 🗺️ Carte Interactive des IRIS

Application web interactive pour visualiser les IRIS (Îlots Regroupés pour l'Information Statistique) français organisés par grands quartiers.

## 🎯 Fonctionnalités

- **Navigation multi-niveaux** : Départements → Communes → IRIS
- **Visualisation des grands quartiers** : Regroupement coloré des IRIS
- **Interaction avancée** : 
  - Survol du menu pour surbrillance sur la carte
  - Tooltips informatifs
  - Export PDF de la carte avec légende
- **Interface moderne** : Design responsive avec Tailwind CSS

## 🛠️ Technologies

- **Frontend** : HTML5, CSS3, JavaScript ES6+
- **Cartographie** : Leaflet.js
- **Données** : GeoJSON (IGN/INSEE)
- **Styling** : Tailwind CSS
- **Export** : jsPDF + dom-to-image

## 🚀 Déploiement

Cette application est déployée sur Vercel et accessible à l'adresse :
[Lien vers l'application](#)

## 📊 Données

- Départements français
- Communes par département  
- IRIS par commune
- Correspondance IRIS ↔ Grands Quartiers

## 🔧 Développement local

```bash
# Lancer un serveur HTTP local
http-server -p 8080
# ou
python -m http.server 8080
```

Puis ouvrir : `http://localhost:8080`
