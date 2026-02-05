# 🛒 Assistant Courses IA (Liste de courses to Leclerc Drive)

![Version](https://img.shields.io/badge/version-3.0-blue)
![Tech](https://img.shields.io/badge/Gemini-2.0%20Flash-orange)
![Platform](https://img.shields.io/badge/Chrome-Extension-green)

Fini la corvée de taper les ingrédients un par un !
Cette extension Chrome **100% autonome (Serverless)** analyse vos photos de recettes ou vos listes de courses et remplit automatiquement votre panier sur le site **E.Leclerc Drive**.

Elle utilise l'intelligence artificielle **Google Gemini** pour comprendre le contexte (quantités, type de produit) et choisir le meilleur article en rayon (rapport qualité/prix).

## ✨ Fonctionnalités

- 📸 **Analyse d'image** : Prenez en photo une recette (livre, écran, manuscrit) et l'IA en extrait les ingrédients.
- 📝 **Liste textuelle** : Copiez-collez une liste brute depuis WhatsApp ou un bloc-notes.
- 🧠 **Choix Intelligent** : L'IA ne prend pas le premier produit venu. Elle compare tous les produits de la page, analyse le prix au kilo et choisit le plus pertinent par rapport à la recette originale.
- ⚡ **Automatique** : L'extension tape la recherche, scrolle pour charger tous les résultats, et ajoute au panier pour vous.
- 🛡️ **100% Local** : Aucune donnée ne transite par un serveur tiers. Votre clé API est stockée uniquement dans votre navigateur.

## 🚀 Installation

Cette extension n'est pas (encore) sur le Chrome Store. Vous pouvez l'installer en "Mode Développeur".

1. **Clonez ce dépôt** (ou téléchargez le ZIP) :
   \`\`\`bash
   git clone https://github.com/VOTRE_PSEUDO/NOM_DU_REPO.git
   \`\`\`
2. Ouvrez **Google Chrome**.
3. Tapez \`chrome://extensions\` dans la barre d'adresse.
4. Activez le **Mode développeur** (bouton en haut à droite).
5. Cliquez sur **Charger l'extension non empaquetée** (Load unpacked).
6. Sélectionnez le dossier \`extension_chrome\` de ce projet.

## 🛠️ Configuration

Pour fonctionner, l'extension a besoin d'un "cerveau" gratuit :

1. Cliquez sur l'icône de l'extension 🥕.
2. Cliquez sur la roue dentée ⚙️ pour aller dans les paramètres.
3. Entrez votre **Clé API Google Gemini**.
   - *C'est gratuit et ça se récupère ici : [Google AI Studio](https://aistudio.google.com/app/apikey)*.
4. Sauvegardez.

## 🎮 Utilisation

1. Connectez-vous sur votre compte [E.Leclerc Drive](https://www.leclercdrive.fr) et choisissez votre magasin.
2. Cliquez sur l'extension.
3. Chargez une image de recette ou collez une liste.
4. Cliquez sur **Lancer les courses 🚀**.
5. Laissez la magie opérer ! (La page va se rafraîchir et l'assistant va travailler).

## 💻 Stack Technique

- **Frontend** : HTML5, CSS3, Vanilla JavaScript.
- **IA Model** : Google Gemini 2.0 Flash (via API REST directe).
- **Chrome API** : Manifest V3, Scripting, Storage, Tabs.
- **Logique** : Gestion de file d'attente (Queue), persistance d'état via \`localStorage\`, DOM Scraping & Injection.

## ⚠️ Avertissement

Ce projet est un outil personnel à but éducatif. Il n'est pas affilié, associé, autorisé, approuvé par, ou officiellement lié à E.Leclerc ou Google.
Utilisez-le de manière responsable. Vérifiez toujours votre panier avant de payer !

---

## 📄 Licence

Ce projet est sous licence **CC BY-NC-ND 4.0**.
Vous êtes libre d'utiliser cet outil pour vos besoins personnels.
Toute utilisation commerciale ou modification du code source est interdite sans autorisation.

---