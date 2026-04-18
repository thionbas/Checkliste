// --- 1. Supabase Initialisierung ---
const SUPABASE_URL = 'https://bdiinqdvzvhynyjhaele.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zNW_Gi3rJ4bsZSOgVD3azg_oP431x6k';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 2. Globale Variablen ---
let currentUser = null;
let userRole = null;
let currentChecklist = null;
let builderItems = [];

// --- 3. DOM Elemente ---
const loginSection = document.getElementById('login-section');
const adminSection = document.getElementById('admin-section');
const userSection = document.getElementById('user-section');
const activeChecklistSection = document.getElementById('active-checklist-section');
const checklistBuilderSection = document.getElementById('checklist-builder-section');
const resultsSection = document.getElementById('results-section');
const userInfo = document.getElementById('user-info');
const userEmailSpan = document.getElementById('user-email');

// --- 4. Login & Auth ---
document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) alert('Login fehlgeschlagen: ' + error.message);
    else checkUser();
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
        
        const { data: profile } = await supabaseClient.from('profiles').select('role').eq('id', user.id).single();
        userRole = profile ? profile.role : 'user';
        loadDashboard();
    } else {
        loginSection.classList.remove('hidden');
    }
}

function loadDashboard() {
    [adminSection, userSection, activeChecklistSection, checklistBuilderSection, resultsSection].forEach(s => s.classList.add('hidden'));
    if (userRole === 'admin') adminSection.classList.remove('hidden');
    userSection.classList.remove('hidden');
    loadAvailableChecklists();
}

// --- 5. Checklisten-Logik (User) ---
async function loadAvailableChecklists() {
    const { data: checklists } = await supabaseClient.from('checklists').select('*');
    const container = document.getElementById('user-checklists-list');
    container.innerHTML = checklists && checklists.length > 0 ? '' : '<p>Keine Checklisten verfügbar.</p>';
    if (checklists) {
        checklists.forEach(cl => {
            const btn = document.createElement('button');
            btn.textContent = cl.title + " starten";
            btn.style.marginRight = "10px";
            btn.addEventListener('click', () => startChecklist(cl));
            container.appendChild(btn);
        });
    }
}

async function startChecklist(checklist) {
    currentChecklist = checklist;
    document.getElementById('active-checklist-title').textContent = checklist.title;
    [userSection, adminSection].forEach(s => s.classList.add('hidden'));
    activeChecklistSection.classList.remove('hidden');
    
    const { data: items } = await supabaseClient.from('checklist_items').select('*').eq('checklist_id', checklist.id);
    const form = document.getElementById('checklist-form');
    form.innerHTML = ''; 
    
    items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'checklist-item';
        let html = `<h3>${item.item_text}</h3>`;
        if (item.item_type === 'yes_no_na') {
            html += `<div class="radio-group">
                <label><input type="radio" name="item_${item.id}" value="Ja" required> Ja</label>
                <label><input type="radio" name="item_${item.id}" value="Nein"> Nein</label>
                <label><input type="radio" name="item_${item.id}" value="Nicht beantwortbar"> N/A</label>
            </div>`;
        } else {
            let units = item.allowed_units.map(u => `<option value="${u}">${u}</option>`).join('');
            html += `<div class="input-group">
                <input type="number" step="0.01" name="number_${item.id}" placeholder="Wert" required>
                <select name="unit_${item.id}">${units}</select>
            </div>`;
        }
        html += `<input type="text" name="comment_${item.id}" placeholder="Kommentar (optional)">`;
        itemDiv.innerHTML = html;
        form.appendChild(itemDiv);
    });
}

document.getElementById('btn-submit-checklist').addEventListener('click', async () => {
    const form = document.getElementById('checklist-form');
    if (!form.checkValidity()) return alert("Pflichtfelder fehlen!");
    
    const { data: run } = await supabaseClient.from('completed_checklists').insert([{ checklist_id: currentChecklist.id, user_id: currentUser.id }]).select().single();
    const { data: items } = await supabaseClient.from('checklist_items').select('id, item_type').eq('checklist_id', currentChecklist.id);
    
    const resps = items.map(item => {
        let r = { completed_checklist_id: run.id, item_id: item.id };
        if (item.item_type === 'yes_no_na') {
            r.answer_status = document.querySelector(`input[name="item_${item.id}"]:checked`).value;
        } else {
            r.answer_number = parseFloat(document.querySelector(`input[name="number_${item.id}"]`).value);
            r.answer_unit = document.querySelector(`select[name="unit_${item.id}"]`).value;
        }
        r.comment = document.querySelector(`input[name="comment_${item.id}"]`).value;
        return r;
    });
    
    await supabaseClient.from('checklist_responses').insert(resps);
    alert("Erfolgreich gespeichert!");
    loadDashboard();
});

document.getElementById('btn-cancel-checklist').addEventListener('click', loadDashboard);

// --- 6. Admin: Baukasten ---
document.getElementById('btn-create-checklist').addEventListener('click', () => {
    [adminSection, userSection].forEach(s => s.classList.add('hidden'));
    checklistBuilderSection.classList.remove('hidden');
    builderItems = [];
    document.getElementById('builder-items').innerHTML = '';
});

document.getElementById('new-item-type').addEventListener('change', (e) => {
    document.getElementById('new-item-units').classList.toggle('hidden', e.target.value !== 'number_unit');
});

document.getElementById('btn-add-item').addEventListener('click', () => {
    const text = document.getElementById('new-item-text').value;
    const type = document.getElementById('new-item-type').value;
    const units = document.getElementById('new-item-units').value;
    if (!text) return alert("Text fehlt!");
    builderItems.push({ item_text: text, item_type: type, allowed_units: type === 'number_unit' ? units.split(',').map(u => u.trim()) : null });
    renderBuilder();
    document.getElementById('new-item-text').value = '';
});

function renderBuilder() {
    const cont = document.getElementById('builder-items');
    cont.innerHTML = builderItems.map((it, i) => `<div class="checklist-item">${i+1}. ${it.item_text} (${it.item_type})</div>`).join('');
}

document.getElementById('btn-save-new-checklist').addEventListener('click', async () => {
    const title = document.getElementById('new-checklist-title').value;
    if (!title || builderItems.length === 0) return alert("Titel oder Punkte fehlen!");
    const { data: cl } = await supabaseClient.from('checklists').insert([{ title }]).select().single();
    const items = builderItems.map(it => ({ ...it, checklist_id: cl.id }));
    await supabaseClient.from('checklist_items').insert(items);
    alert("Checkliste erstellt!");
    loadDashboard();
});

document.getElementById('btn-cancel-builder').addEventListener('click', loadDashboard);

// --- 7. Admin: Ergebnisse & PDF Export ---
document.getElementById('btn-view-results').addEventListener('click', async () => {
    [adminSection, userSection].forEach(s => s.classList.add('hidden'));
    resultsSection.classList.remove('hidden');
    const { data: runs } = await supabaseClient.from('completed_checklists').select(`id, completed_at, checklists(title)` ).order('completed_at', { ascending: false });
    const cont = document.getElementById('results-list');
    cont.innerHTML = '';
    runs.forEach(r => {
        const d = document.createElement('div');
        d.className = 'checklist-item';
        d.innerHTML = `<strong>${r.checklists.title}</strong><br><small>${new Date(r.completed_at).toLocaleString()}</small> <button onclick="showDetails('${r.id}')" style="float:right">Details & PDF</button>`;
        cont.appendChild(d);
    });
});

window.showDetails = async (id) => {
    // 1. Daten der Checkliste abrufen
    const { data: run } = await supabaseClient.from('completed_checklists').select(`id, completed_at, checklists(title)`).eq('id', id).single();
    
    // 2. Die Antworten abrufen
    const { data: res } = await supabaseClient.from('checklist_responses').select('answer_status, answer_number, answer_unit, comment, checklist_items(item_text)').eq('completed_checklist_id', id);
    
    const confirmDownload = confirm("Möchten Sie den Prüfbericht für '" + run.checklists.title + "' als PDF herunterladen?");
    
    if (confirmDownload) {
        generatePDF(run, res);
    }
};

function generatePDF(run, responses) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // --- KOPFZEILE (Dunkelblauer Balken) ---
    doc.setFillColor(0, 0, 139); // Dunkelblau
    doc.rect(0, 0, pageWidth, 40, 'F'); // Balken, 40mm hoch

    // --- LOGO (Quadratisch, Top Rechts) ---
    const logoSize = 30; // Quadrat
    doc.setFillColor(255, 255, 255); // Weißer Hintergrund
    doc.rect(pageWidth - logoSize - 5, 5, logoSize, logoSize, 'F');
    
    // Logo Text ("TEST" und "The Test Company")
    doc.setTextColor(0, 0, 0); // Schwarz
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("TEST", pageWidth - logoSize / 2 - 5, 17, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("The Test Company", pageWidth - logoSize / 2 - 5, 22, { align: "center" });

    // --- TEXTE IM BLAUEN BALKEN ---
    doc.setTextColor(255, 255, 255); // Weiße Schrift
    
    // Ganz dünn oben: Checkliste
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Checkliste", 10, 8);

    // Mitte: Überschrift und Laufende Nummer
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    const title = run.checklists.title;
    const runNo = "Nr. " + run.id.toString().padStart(5, '0');
    // Zentriert, wir lassen das Logo rechts etwas aus der Berechnung raus
    doc.text(title + " | " + runNo, pageWidth / 2 - 10, 22, { align: "center" });

    // Unten im Balken: Ersteller, Freigabe, Freigabedatum
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const dateStr = new Date(run.completed_at).toLocaleDateString();
    
    // In drei Spalten aufteilen
    doc.text(`Ersteller: ${currentUser.email}`, 10, 35);
    doc.text(`Freigabe: Administrator`, 80, 35);
    doc.text(`Datum: ${dateStr}`, 150, 35);

    // --- TABELLEN-INHALT ---
    const tableBody = responses.map(r => {
        let ergebnis = r.answer_status ? r.answer_status : r.answer_number;
        let einheit = r.answer_unit ? r.answer_unit : "-";
        if(r.comment) einheit += `\n(${r.comment})`; // Kommentar unter die Einheit packen
        
        return [
            r.checklist_items.item_text,
            ergebnis,
            einheit,
            "" // Leeres Feld für die Unterschrift
        ];
    });

    doc.autoTable({
        startY: 50,
        head: [['Aufgabe / Prüfpunkt', 'Ergebnis', 'Einheit / Kommentar', 'Unterschrift']],
        body: tableBody,
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 4, valign: 'middle', halign: 'center', lineColor: [50, 50, 50], lineWidth: 0.1 },
        columnStyles: {
            0: { halign: 'left', cellWidth: 70 }, // Aufgabe
            1: { cellWidth: 40 }, // Ergebnis
            2: { cellWidth: 40 }, // Einheit/Kommentar
            3: { cellWidth: 35, minCellHeight: 15 } // Unterschrift (Extra hoch, damit Platz für den Stift ist)
        }
    });

    // --- DIGITALE UNTERSCHRIFT (Abschluss) ---
    const finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(0, 0, 0);
    doc.text("Dieses Dokument wurde digital durch die AP Checklisten App validiert.", 10, finalY);
    doc.text("Die digitale Unterschrift durch " + currentUser.email + " ersetzt die handschriftliche Freigabe.", 10, finalY + 5);

    // PDF im Browser herunterladen
    doc.save(`Checkliste_${run.checklists.title}_${runNo}.pdf`);
}

document.getElementById('btn-close-results').addEventListener('click', loadDashboard);

// Start-Check
checkUser();
