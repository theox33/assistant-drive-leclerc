import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY") 
# Ou colle ta clé directement ci-dessous si le .env ne marche pas
# api_key = "AIza..." 

genai.configure(api_key=api_key)

print("🔍 Recherche des modèles disponibles pour toi...")
try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"- {m.name}")
except Exception as e:
    print(f"Erreur : {e}")