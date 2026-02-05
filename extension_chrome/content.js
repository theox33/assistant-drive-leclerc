console.log("🛒 Extension Moulinex V6 (Fix Start) chargée !");

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- DÉMARRAGE ---
checkStateAndAct();

async function checkStateAndAct() {
    chrome.storage.local.get(['courseQueue', 'isActive', 'isPaused', 'totalItems', 'courseHistory', 'isFirstRun'], async (result) => {
        const queue = result.courseQueue || [];
        const isActive = result.isActive || false;
        const isPaused = result.isPaused || false;
        const totalItems = result.totalItems || 1;
        const history = result.courseHistory || [];
        const isFirstRun = result.isFirstRun || false; // Récupération du drapeau

        if (isActive) {
            afficherPanneauControle(queue.length, totalItems, isPaused, history[history.length - 1]);

            if (isPaused) {
                console.log("⏸️ En pause.");
                return;
            }

            // --- CORRECTIF ICI : GESTION DU PREMIER LANCEMENT ---
            if (isFirstRun) {
                console.log("🚀 PREMIER LANCEMENT : On ignore l'ajout, on cherche direct.");
                
                if (queue.length > 0) {
                    // 1. On enlève le drapeau pour la prochaine fois
                    chrome.storage.local.set({ isFirstRun: false });
                    
                    // 2. On lance directement la recherche du 1er ingrédient
                    const premierItem = queue[0];
                    updateStatusText(`Démarrage : Recherche de ${premierItem.recherche}...`);
                    await wait(1000); // Petite pause visuelle
                    await lancerRecherche(premierItem.recherche);
                } else {
                    alert("Liste vide !");
                    chrome.storage.local.set({ isActive: false });
                }
                return; // On s'arrête là, le rechargement de page fera la suite
            }
            // ---------------------------------------------------

            if (queue.length > 0) {
                await gererEtapeCourante(queue, history);
            } else {
                chrome.storage.local.set({ isActive: false, isPaused: false });
                genererRapportFinal(history);
            }
        } else {
            // Pas actif, on ne fait rien (le bouton start est géré par la popup maintenant)
        }
    });
}

// --- LOGIQUE MÉTIER ---

async function gererEtapeCourante(queue, history) {
    const itemActuel = queue[0];
    
    // 1. Tenter l'ajout (On passe l'objet ENTIER itemActuel, pas juste le nom)
    const resultatAction = await tenterAjoutPanier(itemActuel);

    // 2. Enregistrer le résultat dans l'historique
    if (resultatAction) {
        history.push(resultatAction);
    }

    // 3. Préparer la suite
    const nouvelleQueue = queue.slice(1); 
    
    chrome.storage.local.set({ courseQueue: nouvelleQueue, courseHistory: history }, async () => {
        const check = await chrome.storage.local.get(['isPaused']);
        if (check.isPaused) {
            window.location.reload(); 
            return;
        }

        if (nouvelleQueue.length > 0) {
            const prochainItem = nouvelleQueue[0];
            updateStatusText(`Suivant : ${prochainItem.recherche}...`);
            await wait(2000); 
            await lancerRecherche(prochainItem.recherche);
        } else {
            // C'était le dernier, on recharge pour déclencher la fin dans checkStateAndAct
            window.location.reload();
        }
    });
}

async function lancerRecherche(terme) {
    // 1. Trouver l'input texte
    let searchInput = document.querySelector("input[id*='rechercheTexte'], input[id*='Recherche']");
    if (!searchInput) {
        await wait(2000);
        searchInput = document.querySelector("input[id*='rechercheTexte'], input[id*='Recherche']");
        if(!searchInput) return;
    }

    // 2. Remplir le texte
    searchInput.focus();
    searchInput.value = terme;
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(500);

    // 3. TROUVER LE BOUTON (Mise à jour pour ton HTML spécifique)
    let searchBtn = document.getElementById("inputWRSL301_rechercheBouton"); // Ton ID exact

    // Si pas trouvé par ID, on cherche par classe ou type submit
    if (!searchBtn) {
        searchBtn = document.querySelector(".inputWRSL301_Submit");
    }
    if (!searchBtn) {
        searchBtn = document.querySelector("input[type='submit'][aria-label='Rechercher']");
    }
    
    // Fallback anciens sélecteurs
    if (!searchBtn) {
        let parent = searchInput.parentElement;
        searchBtn = parent.querySelector("a, button, span[class*='ok'], div[class*='loupe']");
    }

    // 4. Action
    if (searchBtn) {
        console.log("🔍 Clic sur le bouton de recherche spécifique.");
        searchBtn.click();
    } else {
        console.log("⚠️ Bouton introuvable, tentative simulation Entrée.");
        searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
        searchInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', keyCode: 13, bubbles: true }));
        searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
    }
}

async function tenterAjoutPanier(item) {
    const motCleRecherche = item.recherche;       
    const nomOriginal = item.nom_original;        
    const quantiteCible = item.quantite_estimee || "Non spécifiée";

    updateStatusText(`IA analyse pour : "${nomOriginal}"`);
    
    // --- NOUVEAU : ON SCROLLE POUR TOUT CHARGER ---
    await scrollerPourChargerTout();
    // ----------------------------------------------

    // Maintenant on peut récupérer TOUS les produits chargés
    const cartesProduits = Array.from(document.querySelectorAll("li.liWCRS310_Product"));
    
    // On filtre pour être sûr de ne pas prendre des cases vides
    // (Parfois le site laisse des balises <li> vides en bas de page)
    const topCartes = cartesProduits.filter(carte => {
        const texte = carte.innerText || "";
        return texte.length > 5; // On garde ceux qui ont du texte
    });

    console.log(`📊 Produits détectés après scroll : ${topCartes.length}`);

    if (topCartes.length === 0) return null;

    const produitsDetails = topCartes.map((carte, index) => {
        const lienTitre = carte.querySelector(".aWCRS310_Product");
        const nom = lienTitre ? lienTitre.innerText.replace(/[\n\r]+/g, ' ').trim() : "Inconnu";
        const prixInfo = carte.querySelector(".pWCRS310_PrixUniteMesure");
        const infoPrix = prixInfo ? `(${prixInfo.innerText.trim()})` : "";
        return `${index}. ${nom} ${infoPrix}`;
    });

    let indexChoisi = 0;
    let raisonChoix = "Défaut";

    try {
        const storage = await chrome.storage.local.get(['geminiApiKey']);
        const API_KEY = storage.geminiApiKey;

        if (API_KEY) {
            const listeStr = produitsDetails.join("\n");
            
            // --- LE PROMPT AMÉLIORÉ AVEC LE CONTEXTE ORIGINAL ---
            const prompt = `CONTEXTE : Je fais mes courses pour une recette précise.
            
            MA DEMANDE EXACTE (Liste originale) : "${nomOriginal}"
            CE QUE J'AI TAPÉ EN RECHERCHE : "${motCleRecherche}"
            QUANTITÉ VISÉE : "${quantiteCible}"
            
            LISTE DES PRODUITS DISPONIBLES EN MAGASIN :
            ${listeStr}
            
            MISSION : Choisis le produit qui correspond le mieux à ma demande originale.
            
            CRITÈRES :
            1. TYPE : Respecte la spécificité si précisée dans la demande originale (ex: "à purée", "vert", "entier").
            2. QUANTITÉ : Vise la quantité cible.
            3. PRIX : À qualité égale, prends le meilleur prix au kg/l (info entre parenthèses).
            4. DÉFAUT : Si la spécificité n'est pas trouvée, prends le produit standard le moins cher.
            
            RÉPONSE JSON STRICTE : {"index": X, "raison": "Court texte explicatif"}`;
            // ----------------------------------------------------

            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            const result = await response.json();
            const textResponse = result.candidates[0].content.parts[0].text;
            const cleanJson = textResponse.replace(/```json|```/g, '').trim();
            const data = JSON.parse(cleanJson);

            indexChoisi = data.index;
            raisonChoix = data.raison;
            console.log(`🧠 IA : ${raisonChoix}`);
            updateStatusText(`Choix : ${raisonChoix.substring(0, 35)}...`);
        }

    } catch (err) {
        console.error("Erreur IA", err);
        raisonChoix = "Erreur IA";
    }

    // ... (Le reste de la fonction pour le clic et le retour reste identique) ...
    
    let produitAchete = "Aucun";
    let statut = "Échoué";

    if (indexChoisi !== -1 && indexChoisi < topCartes.length) {
        const carteGagnante = topCartes[indexChoisi];
        const nomPropre = produitsDetails[indexChoisi]; 
        produitAchete = nomPropre;

        const boutonAjout = carteGagnante.querySelector("a.aWCRS310_Add");

        if (boutonAjout && boutonAjout.offsetParent !== null) {
            boutonAjout.scrollIntoView({behavior: "smooth", block: "center"});
            await wait(500);
            boutonAjout.click();
            await wait(2000); 

            const boutonFermer = document.querySelector("a.fermer, button.close, .modal-close");
            if (boutonFermer) boutonFermer.click();
            
            statut = "Ajouté";
        } else {
            statut = "Rupture/Erreur";
        }
    }

    return {
        demande: nomOriginal, // On enregistre le nom original dans l'historique aussi
        contexte: quantiteCible,
        choix: produitAchete,
        raison: raisonChoix,
        statut: statut
    };
}

// --- UI & RAPPORT ---

function genererRapportFinal(history) {
    // On crée un tableau HTML simple
    let html = `
    <html>
    <head>
        <title>Bilan Courses IA</title>
        <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .success { color: green; font-weight:bold; }
            .error { color: red; font-weight:bold; }
        </style>
    </head>
    <body>
        <h1>🧾 Bilan de vos courses</h1>
        <table>
            <tr>
                <th>Ingrédient Demandé</th>
                <th>Quantité Cible</th>
                <th>Produit Choisi</th>
                <th>Raison de l'IA</th>
                <th>Statut</th>
            </tr>
    `;

    history.forEach(row => {
        html += `
            <tr>
                <td>${row.demande}</td>
                <td>${row.contexte}</td>
                <td>${row.choix}</td>
                <td>${row.raison}</td>
                <td class="${row.statut === 'Ajouté' ? 'success' : 'error'}">${row.statut}</td>
            </tr>
        `;
    });

    html += "</table></body></html>";

    // Création d'un Blob pour télécharger le fichier
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    // Création d'un lien invisible pour déclencher le téléchargement
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bilan_Courses_${new Date().toLocaleTimeString().replace(/:/g,'-')}.html`;
    document.body.appendChild(a);
    a.click();
    
    alert("✅ Courses terminées ! Le rapport a été téléchargé.");
}

function afficherBoutonDemarrage() {
    const oldPanel = document.getElementById("moulinex-panel");
    if (oldPanel) oldPanel.remove();

    const btn = document.createElement("button");
    btn.id = "btn-moulinex-start";
    btn.innerText = "🤖 IMPORTER LISTE MOULINEX";
    btn.style.cssText = "position:fixed; top:150px; right:10px; z-index:9999; padding:15px; background:#e04f00; color:white; font-weight:bold; border:none; border-radius:8px; cursor:pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.3); font-family: sans-serif;";
    document.body.appendChild(btn);

    btn.onclick = async () => {
        btn.innerText = "⏳ Chargement...";
        btn.disabled = true;

        try {
            const response = await fetch("http://127.0.0.1:8000/recuperer-liste");
            const data = await response.json();
            const listeBrute = data.items;

            if (!listeBrute || listeBrute.length === 0) {
                alert("Liste vide !");
                btn.disabled = false;
                btn.innerText = "❌ Vide";
                return;
            }

            const listeFiltree = listeBrute.filter(item => 
                !["eau", "sel", "poivre", "huile"].some(x => item.recherche.toLowerCase().includes(x))
            );

            chrome.storage.local.set({ 
                courseQueue: listeFiltree, 
                totalItems: listeFiltree.length, 
                isActive: true,
                isPaused: false,
                courseHistory: [] // Reset de l'historique
            }, () => {
                btn.remove();
                gererEtapeCourante(listeFiltree, []);
            });

        } catch (err) {
            alert("Erreur connexion Python !");
            btn.disabled = false;
        }
    };
}

function afficherPanneauControle(restant, total, isPaused, lastLog) {
    const oldPanel = document.getElementById("moulinex-panel");
    if (oldPanel) oldPanel.remove();
    const oldBtn = document.getElementById("btn-moulinex-start");
    if (oldBtn) oldBtn.remove();

    const fait = total - restant;
    const pourcent = Math.round((fait / total) * 100);

    const panel = document.createElement("div");
    panel.id = "moulinex-panel";
    panel.style.cssText = "position:fixed; top:120px; right:10px; z-index:9999; width: 280px; background:white; border-radius:10px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); padding:15px; font-family: sans-serif; border: 1px solid #ddd; font-size:13px;";

    // Si on a une info sur le dernier choix, on l'affiche
    let infoChoix = "";
    if (lastLog) {
        infoChoix = `
        <div style="background:#f9f9f9; padding:8px; border-radius:5px; margin-bottom:10px; border-left: 3px solid #2980b9;">
            <div style="font-weight:bold; color:#2980b9; font-size:11px;">DERNIER CHOIX :</div>
            <div style="font-size:11px;">👉 ${lastLog.choix}</div>
            <div style="font-style:italic; font-size:10px; color:#555; margin-top:2px;">"${lastLog.raison}"</div>
        </div>`;
    }

    panel.innerHTML = `
        <div style="font-weight:bold; margin-bottom:10px; color:#333; font-size:15px;">🤖 Assistant Moulinex</div>
        
        <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:5px;">
            <span>Progression</span>
            <span>${fait} / ${total}</span>
        </div>
        <div style="background:#eee; height:8px; border-radius:5px; overflow:hidden; margin-bottom:15px;">
            <div style="background:#e04f00; height:100%; width:${pourcent}%; transition: width 0.5s;"></div>
        </div>

        ${infoChoix}

        <div id="moulinex-status" style="font-size:12px; color:#666; margin-bottom:15px; font-weight:bold; min-height:18px;">
            ${isPaused ? "⏸️ En Pause" : "En cours..."}
        </div>

        <div style="display:flex; gap:10px;">
            <button id="btn-pause-resume" style="flex:1; padding:8px; border:none; border-radius:5px; cursor:pointer; font-weight:bold; color:white; background:${isPaused ? '#27ae60' : '#f39c12'};">
                ${isPaused ? "▶ REPRENDRE" : "⏸ PAUSE"}
            </button>
            <button id="btn-stop" style="flex:1; padding:8px; border:none; border-radius:5px; cursor:pointer; font-weight:bold; color:white; background:#c0392b;">
                🛑 STOP
            </button>
        </div>
    `;

    document.body.appendChild(panel);

    document.getElementById("btn-pause-resume").onclick = () => {
        const newStatus = !isPaused;
        chrome.storage.local.set({ isPaused: newStatus }, () => {
            window.location.reload(); 
        });
    };

    document.getElementById("btn-stop").onclick = () => {
        if(confirm("Tout arrêter ?")) {
            chrome.storage.local.set({ isActive: false, isPaused: false, courseQueue: [] }, () => {
                window.location.reload();
            });
        }
    };
}

async function scrollerPourChargerTout() {
    console.log("⬇️ Scroll pour charger tous les produits...");
    
    // On descend par paliers pour être sûr que Leclerc détecte le mouvement
    // (Un saut direct en bas ne marche pas toujours sur certains sites)
    let totalHeight = 0;
    let distance = 500; // Paliers de 500 pixels
    
    while (totalHeight < document.body.scrollHeight) {
        window.scrollBy(0, distance);
        totalHeight += distance;
        await wait(100); // Petite pause très rapide entre chaque scroll
    }

    // On attend un peu que le site finisse de charger les derniers éléments
    await wait(1000);

    // On remonte tout en haut pour que l'utilisateur (et le script) s'y retrouve
    window.scrollTo(0, 0);
    console.log("⬆️ Remontée en haut de page.");
    await wait(500);
}

function updateStatusText(text) {
    const el = document.getElementById("moulinex-status");
    if (el) el.innerText = text;
}