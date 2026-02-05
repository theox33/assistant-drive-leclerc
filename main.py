import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import List
import json
import PIL.Image
import io

# 1. Configuration
load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY") 
# Si tu n'as pas de .env, décommente la ligne dessous et mets ta clé
# API_KEY = "AIza..." 

if not API_KEY:
    raise ValueError("Aucune clé API trouvée. Vérifie ton fichier .env ou la variable API_KEY.")

genai.configure(api_key=API_KEY)

# Utilisation du modèle 2.0 Flash (celui que tu as repéré)
model = genai.GenerativeModel('gemini-2.0-flash')

app = FastAPI(title="Liste de courses to Leclerc API")

# --- NOUVEAU : Mémoire temporaire simple ---
# Dans une vraie app, on utiliserait une base de données (SQLite/Postgres).
# Ici, une variable globale suffit pour ton usage personnel.
DERNIERE_LISTE = [] 

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Indispensable pour que l'extension Chrome puisse nous parler
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "Le serveur est en ligne ! 🚀"}

@app.post("/analyser-liste")
async def analyser_liste(file: UploadFile = File(...)):
    global DERNIERE_LISTE  # On indique qu'on va utiliser la variable globale
    try:
        # 1. Lire les octets
        contents = await file.read()
        taille = len(contents)
        
        if taille == 0:
            raise HTTPException(status_code=400, detail="Le fichier reçu est vide.")

        # 2. Convertir en Image PIL
        try:
            image = PIL.Image.open(io.BytesIO(contents))
            # On force le chargement pour vérifier que l'image est saine
            image.verify() 
            # Il faut réouvrir après un verify() car le pointeur est déplacé
            image = PIL.Image.open(io.BytesIO(contents)) 
        except Exception as img_err:
            print(f"❌ ERREUR PIL : {img_err}")
            raise HTTPException(status_code=400, detail=f"Fichier image non reconnu. Est-ce bien un JPG/PNG ? Erreur: {img_err}")

        # ... (Le reste du code avec Gemini reste identique) ...
        prompt = """
        Tu es un assistant expert en courses. Analyse cette image de liste de courses.
        Ta mission :
        1. Identifie tous les ingrédients alimentaires.
        2. Ignore les ustensiles.
        3. Pour chaque ingrédient, donne un terme de recherche générique pour un Drive (E.Leclerc).
        Renvoie UNIQUEMENT un tableau JSON strict au format suivant :
        [{"nom_original": "...", "recherche": "...", "quantite_estimee": "..."}]
        """

        response = model.generate_content([prompt, image])
        texte_reponse = response.text.replace("```json", "").replace("```", "").strip()
        
        try:
            data = json.loads(texte_reponse)
        except json.JSONDecodeError:
            return {"error": "Erreur de format JSON", "raw_text": texte_reponse}

#  On sauvegarde en mémoire ---
        DERNIERE_LISTE = data
        print(f"💾 Liste sauvegardée en mémoire ({len(data)} articles)")
        
        return {"ingredients": data}

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"ERREUR SERVEUR GLOBALE : {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Route pour l'extension ---
@app.get("/recuperer-liste")
def recuperer_liste():
    """L'extension Chrome appellera cette route pour savoir quoi acheter."""
    return {"items": DERNIERE_LISTE}

# Structure des données reçues de l'extension
class ChoixProduit(BaseModel):
    recherche_initiale: str
    quantite_cible: str = "Non spécifiée" # NOUVEAU : Le contexte
    produits_trouves: List[str]

@app.post("/choisir-produit")
async def choisir_produit(data: ChoixProduit):
    """
    Reçoit les produits Leclerc ET la quantité désirée.
    Demande à Gemini de choisir et d'expliquer pourquoi.
    """
    try:
        # On prépare la liste
        liste_str = "\n".join([f"{i}. {p}" for i, p in enumerate(data.produits_trouves)])
        
        prompt = f"""
        CONTEXTE : Je fais des courses pour une recette.
        Ingrédient cherché : "{data.recherche_initiale}"
        Quantité nécessaire dans la recette : "{data.quantite_cible}"

        OPTIONS DISPONIBLES SUR LE SITE :
        {liste_str}

        TA MISSION :
        Choisis le meilleur produit.
        Critères :
        1. Correspondance sémantique (C'est bien le bon produit).
        2. Correspondance de quantité (Si je veux 200g, évite le format familial 5kg ou le format individuel 30g, cherche le plus proche).
        3. Si c'est flou, prends le moins cher ou la marque distributeur.
        
        FORMAT DE RÉPONSE ATTENDU (JSON STRICT) :
        {{
            "index": 0,  // Le numéro du produit choisi (ou -1 si rien ne va)
            "raison": "J'ai choisi ce produit car..." // Explication courte (1 phrase)
        }}
        """

        response = model.generate_content(prompt)
        text = response.text.replace("```json", "").replace("```", "").strip()
        
        # Parsing du JSON de l'IA
        try:
            resultat = json.loads(text)
            return resultat
        except json.JSONDecodeError:
            # Fallback si l'IA ne renvoie pas du JSON propre
            import re
            match = re.search(r'-?\d+', text)
            idx = int(match.group()) if match else 0
            return {"index": idx, "raison": "Choix par défaut (Erreur format IA)"}

    except Exception as e:
        print(f"Erreur IA Choix : {e}")
        return {"index": 0, "raison": "Erreur technique, 1er résultat pris."}

# Ajoute cette classe pour recevoir du texte
class ListeTexte(BaseModel):
    texte: str

@app.post("/analyser-texte")
async def analyser_texte(data: ListeTexte):
    """
    Analyse une liste de courses fournie en format TEXTE brut.
    """
    try:
        prompt = f"""
        Tu es un assistant expert en courses.
        Voici une liste d'ingrédients brute :
        "{data.texte}"
        
        Ta mission :
        1. Identifie les ingrédients.
        2. Reformule pour E.Leclerc Drive.
        
        Renvoie UNIQUEMENT un tableau JSON strict :
        [{{"nom_original": "...", "recherche": "...", "quantite_estimee": "..."}}]
        """

        response = model.generate_content(prompt)
        text = response.text.replace("```json", "").replace("```", "").strip()
        
        try:
            ingredients = json.loads(text)
            return {"ingredients": ingredients}
        except json.JSONDecodeError:
             # Fallback simple si l'IA échoue
             return {"ingredients": [{"nom_original": data.texte, "recherche": data.texte, "quantite_estimee": ""}]}

    except Exception as e:
        print(f"ERREUR TEXTE : {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)