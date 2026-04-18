// --- 1. Supabase Initialisierung ---
const SUPABASE_URL = 'https://bdiinqdvzvhynyjhaele.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zNW_Gi3rJ4bsZSOgVD3azg_oP431x6k';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 2. Globale Variablen ---
let currentUser = null;
let userRole = null;
let currentChecklist = null;

// --- 3. DOM Elemente laden ---
const loginSection = document.getElementById('login-section');
const adminSection = document.getElementById('admin-section');
const userSection = document.getElementById('user-section');
const activeChecklistSection = document.getElementById('active-checklist-section');
const checklistBuilderSection = document.getElementById('checklist-builder-section');
const userInfo = document.getElementById('user-info');
const userEmailSpan = document.getElementById('user-email');

// --- 4. Authentifizierung ---
document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;
    
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    
    if (error) {
        alert('Login fehlgeschlagen: ' + error.message);
    } else {
        checkUser();
    }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    location.reload(); 
});

async function checkUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
        currentUser = user;
        userEmailSpan.textContent = user.email;
        userInfo.classList.remove('hidden');
        loginSection.classList.add('hidden');
        
        // Rolle abrufen 
        const { data: profile } = await supabaseClient.from('profiles').select('role').eq('id', user.id).single();
        userRole = profile ? profile.role : 'user';
        
        loadDashboard();
    } else {
        loginSection.classList.remove('hidden');
    }
}

// --- 5. Dashboard laden ---
function loadDashboard() {
    // Alles erstmal verstecken
    adminSection.classList.add('hidden');
    userSection.classList.add('hidden');
    activeChecklistSection.classList.add('hidden');
    checklistBuilderSection.classList.add('hidden');

    // Je nach Rolle einblenden
    if (userRole === 'admin') {
        adminSection.classList.remove('hidden');
    }
    userSection.classList.remove('hidden');
    loadAvailableChecklists();
}

// --- 6. Checklisten abrufen und rendern ---
async function loadAvailableChecklists() {
    const { data: checklists, error } = await supabaseClient.from('checklists').select('*');
    const container = document.getElementById('user-checklists-list');
    container.innerHTML = '';
    
    if (checklists && checklists.length > 0) {
        checklists.forEach(cl => {
            const btn = document.createElement('button');
            btn.textContent = cl.title + " starten";
            btn.style.marginRight = "10px";
            btn.style.marginBottom = "10px";
            btn.addEventListener('click', () => startChecklist(cl));
            container.appendChild(btn);
        });
    } else {
        container.innerHTML = '<p>Bisher sind keine Checklisten verfügbar.</p>';
    }
}

async function startChecklist(checklist) {
    currentChecklist = checklist;
    document.getElementById('active-checklist-title').textContent = checklist.title;
    userSection.classList.add('hidden');
    adminSection.classList.add('hidden');
    activeChecklistSection.classList.remove('hidden');
    
    // Items laden
    const { data: items } = await supabaseClient.from('checklist_items').select('*').eq('checklist_id', checklist.id);
    const form = document.getElementById('checklist-form');
    form.innerHTML = ''; 
    
    items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'checklist-item';
        
        let html = `<h3>${item.item_text}</h3>`;
        
        if (item.item_type === 'yes_no_na') {
            html += `
                <div class="radio-group">
                    <label><input type="radio" name="item_${item.id}" value="Ja" required> Ja</label>
                    <label><input type="radio" name="item_${item.id}" value="Nein"> Nein</label>
                    <label><input type="radio" name="item_${item.id}" value="Nicht beantwortbar"> N/A</label>
                </div>
                <input type="text" name="comment_${item.id}" placeholder="Kommentar (optional)">
            `;
        } else if (item.item_type === 'number_unit') {
            let unitOptions = item.allowed_units.map(u => `<option value="${u}">${u}</option>`).join('');
            html += `
                <div class="input-group">
                    <input type="number" step="0.01" name="number_${item.id}" placeholder="Wert eintragen" required>
                    <select name="unit_${item.id}">
                        ${unitOptions}
                    </select>
                </div>
                <input type="text" name="comment_${item.id}" placeholder="Kommentar (optional)" style="margin-top:10px;">
            `;
        }
        
        itemDiv.innerHTML = html;
        form.appendChild(itemDiv);
    });
}

// User bricht aktive Checkliste ab
document.getElementById('btn-cancel-checklist').addEventListener('click', () => {
    loadDashboard();
});

// --- 7. Checkliste speichern (User füllt aus) ---
document.getElementById('btn-submit-checklist').addEventListener('click', async () => {
    const form = document.getElementById('checklist-form');
    if (!form.checkValidity()) {
        alert("Bitte fülle alle Pflichtfelder aus!");
        return;
    }
    
    const { data: completedRecord, error: err1 } = await supabaseClient
        .from('completed_checklists')
        .insert([{ checklist_id: currentChecklist.id, user_id: currentUser.id }])
        .select()
        .single();
        
    if (err1) {
        alert("Fehler beim Speichern der Checkliste!");
        return;
    }

    const { data: items } = await supabaseClient.from('checklist_items').select('id, item_type').eq('checklist_id', currentChecklist.id);
    
    const responses = [];
    
    items.forEach(item => {
        let responseObj = {
            completed_checklist_id: completedRecord.id,
            item_id: item.id
        };
        
        if (item.item_type === 'yes_no_na') {
            const radio = document.querySelector(`input[name="item_${item.id}"]:checked`);
            responseObj.answer_status = radio ? radio.value : null;
            responseObj.comment = document.querySelector(`input[name="comment_${item.id}"]`).value;
        } else if (item.item_type === 'number_unit') {
            responseObj.answer_number = parseFloat(document.querySelector(`input[name="number_${item.id}"]`).value);
            responseObj.answer_unit = document.querySelector(`select[name="unit_${item.id}"]`).value;
            responseObj.comment = document.querySelector(`input[name="comment_${item.id}"]`).value;
        }
        
        responses.push(responseObj);
    });
    
    const { error: err2 } = await supabaseClient.from('checklist_responses').insert(responses);
    
    if (err2) {
        alert("Fehler beim Speichern der Antworten!");
    } else {
        alert("Checkliste erfolgreich gespeichert!");
        loadDashboard(); 
    }
});

// --- 8. Checklisten-Baukasten (Admin) ---
const builderItemsContainer = document.getElementById('builder-items');
let builderItems = [];

// Klick auf "Neue Checkliste erstellen"
document.getElementById('btn-create-checklist').addEventListener('click', () => {
    adminSection.classList.add('hidden');
    userSection.classList.add('hidden');
    checklistBuilderSection.classList.remove('hidden');
    
    // Formular zurücksetzen
    document.getElementById('new-checklist-title').value = '';
    document.getElementById('new-item-text').value = '';
    document.getElementById('new-item-units').value = '';
    document.getElementById('new-item-units').classList.add('hidden');
    document.getElementById('new-item-type').value = 'yes_no_na';
    builderItems = [];
    renderBuilderItems();
});

// Art des Prüfpunktes wechseln (Einheiten-Feld ein/ausblenden)
document.getElementById('new-item-type').addEventListener('change', (e) => {
    const unitsInput = document.getElementById('new-item-units');
    if (e.target.value === 'number_unit') {
        unitsInput.classList.remove('hidden');
    } else {
        unitsInput.classList.add('hidden');
    }
});

// Punkt zur Liste hinzufügen
document.getElementById('btn-add-item').addEventListener('click', () => {
    const text = document.getElementById('new-item-text').value;
    const type = document.getElementById('new-item-type').value;
    const unitsStr = document.getElementById('new-item-units').value;

    if (!text) return alert('Bitte einen Text für den Prüfpunkt eingeben!');

    let allowed_units = [];
    if (type === 'number_unit') {
        if (!unitsStr) return alert('Bitte Einheiten angeben (z.B. Bar, °C)');
        allowed_units = unitsStr.split(',').map(u => u.trim()); 
    }

    builderItems.push({ item_text: text, item_type: type, allowed_units: allowed_units });
    
    // Felder wieder leeren
    document.getElementById('new-item-text').value = '';
    document.getElementById('new-item-units').value = '';
    renderBuilderItems();
});

// Baukasten-Liste anzeigen
function renderBuilderItems() {
    builderItemsContainer.innerHTML = '';
    builderItems.forEach((item, index) => {
        const div = document.createElement('div');
        div.style.padding = '10px';
        div.style.borderBottom = '1px solid #ccc';
        div.style.marginBottom = '10px';
        
        let typeInfo = item.item_type === 'yes_no_na' ? 'Ja / Nein / N.A.' : `Zahl (${item.allowed_units.join(', ')})`;
        div.innerHTML = `<strong>${index + 1}. ${item.item_text}</strong> <br><small>Typ: ${typeInfo}</small>`;
        builderItemsContainer.appendChild(div);
    });
}

// Abbrechen
document.getElementById('btn-cancel-builder').addEventListener('click', () => {
    loadDashboard();
});

// Checkliste endgültig in Datenbank speichern
document.getElementById('btn-save-new-checklist').addEventListener('click', async () => {
    const title = document.getElementById('new-checklist-title').value;
    if (!title) return alert('Bitte einen Titel für die Checkliste vergeben!');
    if (builderItems.length === 0) return alert('Bitte füge mindestens einen Prüfpunkt hinzu!');

    // 1. Die Haupt-Checkliste anlegen
    const { data: clData, error: clErr } = await supabaseClient
        .from('checklists')
        .insert([{ title: title }])
        .select()
        .single();

    if (clErr) return alert('Fehler beim Erstellen der Checkliste!');

    // 2. Die einzelnen Prüfpunkte anlegen
    const itemsToInsert = builderItems.map(item => ({
        checklist_id: clData.id,
        item_text: item.item_text,
        item_type: item.item_type,
        allowed_units: item.item_type === 'number_unit' ? item.allowed_units : null
    }));

    const { error: itemErr } = await supabaseClient.from('checklist_items').insert(itemsToInsert);

    if (itemErr) return alert('Fehler beim Speichern der Prüfpunkte!');

    alert('Checkliste erfolgreich erstellt!');
    loadDashboard(); // Lädt das Dashboard neu, die neue Liste ist sofort sichtbar
});

// Start-Check
checkUser();
