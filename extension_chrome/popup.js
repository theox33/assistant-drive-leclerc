document.addEventListener('DOMContentLoaded', () => {
    // 1. GESTION CLÉ API
    const viewSettings = document.getElementById('view-settings');
    const viewMain = document.getElementById('view-main');
    const btnSettings = document.getElementById('btnSettings');
    const btnSaveKey = document.getElementById('btnSaveKey');
    const btnCancel = document.getElementById('btnCancelSettings');
    const apiKeyInput = document.getElementById('apiKeyInput');
    
    chrome.storage.local.get(['geminiApiKey'], (result) => {
        if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
            showMain();
        } else {
            showSettings(false);
        }
    });

    btnSettings.addEventListener('click', () => showSettings(true));
    btnCancel.addEventListener('click', () => showMain());

    function showSettings(canGoBack) {
        viewMain.classList.remove('active');
        viewSettings.classList.add('active');
        btnCancel.style.display = canGoBack ? 'block' : 'none';
        btnSettings.style.visibility = 'hidden';
    }

    function showMain() {
        viewSettings.classList.remove('active');
        viewMain.classList.add('active');
        btnSettings.style.visibility = 'visible';
    }

    btnSaveKey.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key.length < 10) {
            alert("Clé invalide.");
            return;
        }
        chrome.storage.local.set({ geminiApiKey: key }, () => {
            btnSaveKey.innerText = "✅ Sauvegardé !";
            setTimeout(() => {
                btnSaveKey.innerText = "💾 Sauvegarder";
                showMain();
            }, 800);
        });
    });

    // 2. ONGLETS
    const tabs = document.querySelectorAll('.tab');
    const subviews = {
        'img-section': document.getElementById('img-section'),
        'txt-section': document.getElementById('txt-section')
    };
    let mode = 'image';

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            Object.values(subviews).forEach(el => el.style.display = 'none');
            subviews[tab.dataset.target].style.display = 'block';
            mode = tab.dataset.target === 'img-section' ? 'image' : 'texte';
        });
    });

    const fileInput = document.getElementById('fileInput');
    const fileText = document.getElementById('fileText');
    const fileIcon = document.getElementById('fileName');
    
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            fileText.innerText = fileInput.files[0].name;
            fileText.style.color = "#27ae60";
            fileText.style.fontWeight = "bold";
            fileIcon.innerText = "✅";
        }
    });

    // 3. LANCEMENT (MODIFIÉ)
    const btnGo = document.getElementById('go');
    const statusDiv = document.getElementById('status');

    btnGo.addEventListener('click', async () => {
        const API_KEY = apiKeyInput.value.trim();
        
        // --- MODIFICATION ICI : VÉRIFICATION DE L'ONGLET ---
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // On vérifie qu'on est bien sur un site Leclerc Drive
        if (!tab.url.includes("leclercdrive.fr")) {
            alert("⚠️ Attention !\n\nTu dois être sur le site de ton Leclerc Drive (et connecté) pour lancer l'assistant.\n\nVa sur le site et réessaie !");
            return;
        }
        // ----------------------------------------------------

        btnGo.disabled = true;
        statusDiv.innerHTML = '<span class="spinner"></span> IA en cours...';

        try {
            let promptBase = `Tu es un assistant expert en courses.
            Ta mission :
            1. Identifie tous les ingrédients alimentaires.
            2. Ignore les ustensiles.
            3. Pour chaque ingrédient, donne un terme de recherche générique pour un Drive (E.Leclerc).
            4. Estime la quantité (ex: 200g, 1kg, 6 pots).
            Renvoie UNIQUEMENT un tableau JSON strict :
            [{"nom_original": "...", "recherche": "...", "quantite_estimee": "..."}]`;

            let contentParts = [];

            if (mode === 'image') {
                if (fileInput.files.length === 0) throw new Error("Sélectionne une image !");
                const base64Data = await fileToBase64(fileInput.files[0]);
                contentParts = [
                    { text: promptBase },
                    { inlineData: { mimeType: fileInput.files[0].type, data: base64Data } }
                ];
            } else {
                const textVal = document.getElementById('textInput').value;
                if (!textVal.trim()) throw new Error("Texte vide !");
                contentParts = [{ text: promptBase + `\n\nLISTE BRUTE : "${textVal}"` }];
            }

            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: contentParts }] })
            });

            if (!response.ok) throw new Error("Erreur API Google");
            
            const result = await response.json();
            const textResponse = result.candidates[0].content.parts[0].text;
            const cleanJson = textResponse.replace(/```json|```/g, '').trim();
            
            let liste;
            try {
                liste = JSON.parse(cleanJson);
            } catch (e) {
                throw new Error("Réponse IA invalide.");
            }

            const listeFiltree = liste.filter(item => 
                !["eau", "sel", "poivre", "huile"].some(x => item.recherche.toLowerCase().includes(x))
            );

            statusDiv.innerText = `✅ Prêt ! Démarrage...`;

            chrome.storage.local.set({ 
                courseQueue: listeFiltree, 
                totalItems: listeFiltree.length, 
                isActive: true, 
                isPaused: false,
                courseHistory: [],
                geminiApiKey: API_KEY,
                isFirstRun: true  // <--- LIGNE AJOUTÉE ICI
            }, () => {
                chrome.tabs.reload(tab.id);
                window.close();
            });
            
        } catch (err) {
            console.error(err);
            statusDiv.innerText = "❌ " + err.message;
            statusDiv.style.color = "#c0392b";
            btnGo.disabled = false;
        }
    });
});

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}