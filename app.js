// App Notes - Interface iOS Style

let currentNoteId = null;
let editor = null;
let noteTitle = null;

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    editor = document.getElementById('editor');
    noteTitle = document.getElementById('note-title');
    
    // Charger la dernière note ou créer une nouvelle
    loadLastNote();
    
    // Auto-sauvegarde en tapant
    editor.addEventListener('input', debounce(autoSave, 1000));
    
    console.log('App Notes chargée !');
});

// Debounce pour éviter trop de sauvegardes
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Auto-sauvegarde
function autoSave() {
    const content = editor.value.trim();
    if (content) {
        saveNote(true); // true = sauvegarde silencieuse
    }
}

// Sauvegarder une note
function saveNote(silent = false) {
    const content = editor.value.trim();
    if (!content) {
        if (!silent) showToast('Rien à sauver !');
        return;
    }
    
    const noteId = currentNoteId || 'note_' + Date.now();
    const title = content.split('\n')[0].substring(0, 30) || 'Note sans titre';
    
    const note = {
        id: noteId,
        title: title,
        content: content,
        date: new Date().toISOString()
    };
    
    localStorage.setItem(noteId, JSON.stringify(note));
    localStorage.setItem('lastNoteId', noteId);
    
    currentNoteId = noteId;
    noteTitle.textContent = title;
    
    if (!silent) {
        showToast('Note sauvée ✓');
    }
}

// Charger une note
function loadNote(noteId) {
    const noteData = localStorage.getItem(noteId);
    if (noteData) {
        const note = JSON.parse(noteData);
        editor.value = note.content;
        currentNoteId = noteId;
        noteTitle.textContent = note.title;
        localStorage.setItem('lastNoteId', noteId);
    }
}

// Charger la dernière note
function loadLastNote() {
    const lastNoteId = localStorage.getItem('lastNoteId');
    if (lastNoteId) {
        loadNote(lastNoteId);
    } else {
        // Exemple de contenu par défaut
        editor.value = `identité hors ligne = Personnage de tous les jours.

identité en ligne : Personnage en ligne dont pseudo, limiter les infos sur nous existantes


Pour choisir un username :

• Pas de nom complet / partie d'adresse ou de numéro de téléphone
• Pas nom d'utilisateur de messagerie
• Jamais les mêmes noms d'utilisateur

Données perso :

• Nom / Prénom
• Numéro de sécurité sociale
• Numéro de permis
• Date / Lieu de naissance
• Nom de jeune fille maman
• photos / messages envoyés


Photos / vidéos stockés sur des serveurs dans le monde

Bracelet connecté stocke des données personnelles

Hackers – veulent mon argent`;
        noteTitle.textContent = 'Cyber sécurité';
    }
}

// Afficher la liste des notes
function showNotes() {
    const overlay = document.getElementById('notes-overlay');
    const notesContent = document.getElementById('notes-content');
    
    // Récupérer toutes les notes
    const notes = getAllNotes();
    
    // Vider le contenu
    notesContent.innerHTML = '';
    
    if (notes.length === 0) {
        notesContent.innerHTML = '<div style="padding: 20px; text-align: center; color: #8E8E93;">Aucune note sauvée</div>';
    } else {
        notes.forEach(note => {
            const noteItem = document.createElement('div');
            noteItem.className = 'note-item';
            noteItem.onclick = () => {
                loadNote(note.id);
                hideNotes();
            };
            
            const date = new Date(note.date).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            noteItem.innerHTML = `
                <div class="note-title">${note.title}</div>
                <div class="note-preview">${note.content.substring(0, 100)}...</div>
                <div class="note-date">${date}</div>
            `;
            
            notesContent.appendChild(noteItem);
        });
    }
    
    overlay.classList.add('show');
    overlay.style.display = 'block';
}

// Masquer la liste des notes
function hideNotes() {
    const overlay = document.getElementById('notes-overlay');
    overlay.classList.remove('show');
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 300);
}

// Récupérer toutes les notes
function getAllNotes() {
    const notes = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('note_')) {
            const noteData = localStorage.getItem(key);
            if (noteData) {
                try {
                    notes.push(JSON.parse(noteData));
                } catch (e) {
                    console.error('Erreur parsing note:', e);
                }
            }
        }
    }
    
    // Trier par date (plus récent en premier)
    return notes.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// Fonctions de formatage
function insertText(text) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const value = editor.value;
    
    editor.value = value.slice(0, start) + text + value.slice(end);
    editor.selectionStart = editor.selectionEnd = start + text.length;
    editor.focus();
    
    autoSave();
}

function toggleBold() {
    // Simulation pour textarea (pour vraie app, utiliser contenteditable)
    insertText('**');
}

function toggleItalic() {
    insertText('*');
}

function toggleUnderline() {
    insertText('_');
}

// Toast notification
function showToast(message) {
    // Créer ou réutiliser le toast
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: #2C2C2E;
            color: white;
            padding: 12px 20px;
            border-radius: 20px;
            font-size: 14px;
            z-index: 3000;
            opacity: 0;
            transition: opacity 0.3s;
        `;
        document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.style.opacity = '1';
    
    setTimeout(() => {
        toast.style.opacity = '0';
    }, 2000);
}
