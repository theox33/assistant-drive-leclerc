from playwright.sync_api import sync_playwright
import time
import random

def run():
    # On lance Playwright
    with sync_playwright() as p:
        # headless=False signifie qu'on VOIT le navigateur s'ouvrir (indispensable pour le débogage et moins suspect)
        browser = p.chromium.launch(headless=False, slow_mo=100) 
        
        # On crée un contexte (comme une session utilisateur)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        )
        page = context.new_page()

        print("--- ÉTAPE 1 : Ouverture du site ---")
        page.goto("https://www.leclercdrive.fr")

        # PAUSE MANUELLE
        print("\n!!! ACTION REQUISE !!!")
        print("Le script est en pause pendant 45 secondes.")
        print(">> S'il vous plaît, connectez-vous ou choisissez votre magasin 'Drive' manuellement dans la fenêtre qui s'est ouverte.")
        print(">> Une fois sur la page d'accueil de VOTRE magasin, ne touchez plus à rien.")
        time.sleep(45) 

        print("\n--- ÉTAPE 2 : Tentative de recherche ---")
        try:
            # On cherche la barre de recherche. 
            # Note : Les sélecteurs (id, class) changent souvent. 
            # Ici on cherche un input générique souvent utilisé pour la recherche.
            search_input = page.get_by_placeholder("Rechercher un produit", exact=False)
            
            # Si le placeholder ne marche pas, on essaie une stratégie de repli générique
            if not search_input.is_visible():
                 search_input = page.locator("input[type='search']")

            search_input.click()
            # Simulation de frappe humaine (petit délai entre les touches)
            page.keyboard.type("Pates Barilla", delay=100) 
            page.keyboard.press("Enter")
            
            print("Recherche lancée...")
            time.sleep(5) # Attendre les résultats

            # On prend une capture d'écran pour prouver que ça a marché
            page.screenshot(path="resultat_recherche.png")
            print("Capture d'écran 'resultat_recherche.png' sauvegardée.")

            print("\n--- ÉTAPE 3 : Analyse des résultats ---")
            # Essai de détection d'un bouton d'ajout (C'est souvent là que ça casse si le code du site change)
            # On cherche n'importe quel bouton qui contient le texte "Ajouter"
            boutons_ajout = page.get_by_role("button", name="Ajouter").all()
            
            if boutons_ajout:
                print(f"Succès ! J'ai trouvé {len(boutons_ajout)} boutons 'Ajouter' sur la page.")
                # On ne clique pas pour ne pas polluer ton vrai panier, mais on pourrait :
                # boutons_ajout[0].click()
            else:
                print("Pas de bouton 'Ajouter' évident trouvé (le site utilise peut-être des icônes sans texte).")

        except Exception as e:
            print(f"Erreur rencontrée : {e}")

        print("\nTest terminé. Fermeture dans 10 secondes.")
        time.sleep(10)
        browser.close()

if __name__ == "__main__":
    run()