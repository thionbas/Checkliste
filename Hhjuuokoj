// --- 1. Supabase Initialisierung ---
const SUPABASE_URL = 'https://bdiinqdvzvhynyjhaele.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zNW_Gi3rJ4bsZSOgVD3azg_oP431x6k';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 2. Globale Variablen ---
let currentUser = null;
let userRole = null;
let currentChecklist = null;

// --- 3. DOM Elemente laden ---
const loginSection = document.getElementById('login-section');
const adminSection = document.getElementById('admin-section');
const userSection = document.getElementById('user-section');
const activeChecklistSection = document.getElementById('active-checklist-section');
const userInfo = document.getElementById('user-info');
const userEmailSpan = document.getElementById('user-email');

// --- 4. Authentifizierung ---
document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
        alert('Login fehlgeschlagen: ' + error.message);
    } else {
        checkUser();
    }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    location.reload(); // App neu laden
});

async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        currentUser = user;
        userEmailSpan.textContent = user.email;
        userInfo.classList.remove('hidden');
        loginSection.classList.add('hidden');
        
        // Rolle abrufen (aus der profiles Tabelle)
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        userRole = profile ? profile.role : 'user';
        
        loadDashboard();
    } else {
        loginSection.classList.remove('hidden');
    }
}

// --- 5. Dashboard laden ---
function loadDashboard() {
    if (userRole === 'admin') {
        adminSection.classList.remove('hidden');
        // Hier kann später die Logik für Admins zum Erstellen von Checklisten im Frontend ergänzt werden
    }
    
    userSection.classList.remove('hidden');
    loadAvailableChecklists();
}

// --- 6. Checklisten abrufen und rendern ---
async function loadAvailableChecklists() {
    const { data: checklists, error } = await supabase.from('checklists').select('*');
    const container = document.getElementById('user-checklists-list');
    container.innerHTML = '';
    
    if (checklists) {
        checklists.forEach(cl => {
            const btn = document.createElement('button');
            btn.textContent = cl.title + " starten";
            btn.style.marginRight = "10px";
            btn.style.marginBottom = "10px";
            btn.addEventListener('click', () => startChecklist(cl));
            container.appendChild(btn);
        });
    }
}

async function startChecklist(checklist) {
    currentChecklist = checklist;
    document.getElementById('active-checklist-title').textContent = checklist.title;
    userSection.classList.add('hidden');
    adminSection.classList.add('hidden');
    activeChecklistSection.classList.remove('hidden');
    
    // Items laden
    const { data: items } = await supabase.from('checklist_items').select('*').eq('checklist_id', checklist.id);
    const form = document.getElementById('checklist-form');
    form.innerHTML = ''; // Reset
    
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
            // Dropdown für Einheiten generieren
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

// --- 7. Checkliste speichern ---
document.getElementById('btn-submit-checklist').addEventListener('click', async () => {
    const form = document.getElementById('checklist-form');
    if (!form.checkValidity()) {
        alert("Bitte fülle alle Pflichtfelder aus!");
        return;
    }
    
    // 1. Eintrag in completed_checklists erstellen
    const { data: completedRecord, error: err1 } = await supabase
        .from('completed_checklists')
        .insert([{ checklist_id: currentChecklist.id, user_id: currentUser.id }])
        .select()
        .single();
        
    if (err1) {
        alert("Fehler beim Speichern der Checkliste!");
        return;
    }

    // 2. Antworten sammeln und in checklist_responses speichern
    const { data: items } = await supabase.from('checklist_items').select('id, item_type').eq('checklist_id', currentChecklist.id);
    
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
    
    const { error: err2 } = await supabase.from('checklist_responses').insert(responses);
    
    if (err2) {
        alert("Fehler beim Speichern der Antworten!");
    } else {
        alert("Checkliste erfolgreich gespeichert!");
        activeChecklistSection.classList.add('hidden');
        loadDashboard(); // Zurück zur Übersicht
    }
});

// Start-Check
checkUser();
