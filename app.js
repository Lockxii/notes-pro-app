// App Notes - Interface iOS Style avec Slugs

let currentNoteId = null;
let editor = null;
let noteTitle = null;
let toolbar = null;

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    editor = document.getElementById('editor');
    noteTitle = document.getElementById('note-title');
    toolbar = document.querySelector('.toolbar');
    
    // Initialiser les event listeners
    initEventListeners();
    
    // Initialiser le système clavier
    initKeyboardHandling();
    
    // Gérer les routes (slugs)
    handleRouting();
    
    // Auto-sauvegarde en tapant
    editor.addEventListener('input', debounce(autoSave, 1000));
    
    console.log('App Notes chargée !');
});

// Initialiser tous les event listeners
function initEventListeners() {
    // Boutons header
    document.getElementById('notes-btn').addEventListener('click', showNotes);
    document.getElementById('save-btn').addEventListener('click', () => saveNote());
    
    // Boutons toolbar
    document.getElementById('bullet-btn').addEventListener('click', () => insertText('• '));
    document.getElementById('arrow-btn').addEventListener('click', () => insertText('→ '));
    document.getElementById('bold-btn').addEventListener('click', toggleBold);
    document.getElementById('italic-btn').addEventListener('click', toggleItalic);
    document.getElementById('underline-btn').addEventListener('click', toggleUnderline);
    
    // Modal notes
    document.getElementById('notes-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'notes-overlay') hideNotes();
    });
    document.getElementById('close-notes-btn').addEventListener('click', hideNotes);
    document.getElementById('new-note-btn').addEventListener('click', createNewNote);
    
    // Modal édition titre
    document.getElementById('edit-modal').addEventListener('click', (e) => {
        if (e.target.id === 'edit-modal') hideEditModal();
    });
    document.getElementById('edit-cancel').addEventListener('click', hideEditModal);
    document.getElementById('edit-save').addEventListener('click', saveEditedTitle);
    
    // Écouter les changements d'URL
    window.addEventListener('popstate', handleRouting);
}

// Système de routing avec slugs
function handleRouting() {
    const path = window.location.pathname;
    const slug = path.split('/').pop();
    
    if (slug && slug !== '' && slug !== 'index.html') {
        // Charger la note basée sur le slug
        loadNoteBySlug(slug);
    } else {
        // Charger la note par défaut ou dernière note
        loadLastNote();
    }
}

// Créer un slug à partir d'un titre
function createSlug(title) {
    return title
        .toLowerCase()
        .replace(/[àáâäã]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôöõ]/g, 'o')
        .replace(/[ùúûü]/g, 'u')
        .replace(/[ç]/g, 'c')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 50);
}

// Naviguer vers une note avec slug
function navigateToNote(noteId, title) {
    const slug = createSlug(title);
    const url = `/${slug}`;
    
    // Mettre à jour l'URL sans recharger la page
    window.history.pushState({ noteId, slug }, title, url);
    
    // Charger la note
    loadNote(noteId);
}

// Charger une note par slug
function loadNoteBySlug(slug) {
    const notes = getAllNotes();
    const note = notes.find(n => createSlug(n.title) === slug);
    
    if (note) {
        loadNote(note.id);
    } else {
        // Si pas trouvé, charger la note par défaut
        loadLastNote();
    }
}

// Gestion du clavier iOS avec Visual Viewport API
function initKeyboardHandling() {
    if (!window.visualViewport) {
        console.log('Visual Viewport API non supporté');
        return;
    }

    function adjustForKeyboard() {
        const viewport = window.visualViewport;
        const keyboardHeight = window.innerHeight - viewport.height;
        
        if (keyboardHeight > 100) {
            // Clavier ouvert - déplacer la toolbar au-dessus
            toolbar.style.transform = `translateY(-${keyboardHeight}px)`;
            
            // Ajuster l'editor pour éviter que la toolbar le couvre
            editor.style.paddingBottom = `${toolbar.offsetHeight + 20}px`;
        } else {
            // Clavier fermé - remettre la toolbar en bas
            toolbar.style.transform = 'translateY(0)';
            editor.style.paddingBottom = `${toolbar.offsetHeight + 20}px`;
        }
    }

    // Écouter les changements du clavier
    window.visualViewport.addEventListener('resize', adjustForKeyboard);
    window.visualViewport.addEventListener('scroll', adjustForKeyboard);
    
    // Ajustement initial
    setTimeout(adjustForKeyboard, 100);
}

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
    
    // Mettre à jour l'URL avec le slug
    const slug = createSlug(title);
    const newUrl = `/${slug}`;
    if (window.location.pathname !== newUrl) {
        window.history.replaceState({ noteId, slug }, title, newUrl);
    }
    
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
        
        // Mettre à jour l'URL
        const slug = createSlug(note.title);
        const newUrl = `/${slug}`;
        if (window.location.pathname !== newUrl) {
            window.history.replaceState({ noteId, slug }, note.title, newUrl);
        }
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
            
            const date = new Date(note.date).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            noteItem.innerHTML = `
                <div class="note-main">
                    <div class="note-title">${note.title}</div>
                    <div class="note-preview">${note.content.substring(0, 100)}...</div>
                    <div class="note-date">${date}</div>
                </div>
                <div class="note-actions">
                    <button class="note-action-btn edit" data-note-id="${note.id}">✏️</button>
                    <button class="note-action-btn delete" data-note-id="${note.id}">🗑️</button>
                </div>
            `;
            
            // Event listener pour ouvrir la note
            const noteMain = noteItem.querySelector('.note-main');
            noteMain.addEventListener('click', () => {
                navigateToNote(note.id, note.title);
                hideNotes();
            });
            
            // Event listener pour éditer le titre
            const editBtn = noteItem.querySelector('.edit');
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                editNoteTitle(note.id, note.title);
            });
            
            // Event listener pour supprimer
            const deleteBtn = noteItem.querySelector('.delete');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteNote(note.id, note.title);
            });
            
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

// ============ NOUVELLES FONCTIONNALITÉS ============

let editingNoteId = null;

// Créer une nouvelle note
function createNewNote() {
    // Sauver la note actuelle avant de créer une nouvelle
    if (editor.value.trim()) {
        saveNote(true);
    }
    
    // Créer une nouvelle note vide
    currentNoteId = null;
    editor.value = '';
    noteTitle.textContent = 'Nouvelle note';
    
    // Mettre à jour l'URL
    window.history.pushState({ noteId: null }, 'Nouvelle note', '/nouvelle-note');
    
    // Fermer le modal et focus sur l'editor
    hideNotes();
    editor.focus();
    
    showToast('Nouvelle note créée ✓');
}

// Éditer le titre d'une note
function editNoteTitle(noteId, currentTitle) {
    editingNoteId = noteId;
    
    const editModal = document.getElementById('edit-modal');
    const editInput = document.getElementById('edit-input');
    
    editInput.value = currentTitle;
    editModal.classList.add('show');
    
    // Focus et sélection du texte
    setTimeout(() => {
        editInput.focus();
        editInput.select();
    }, 100);
}

// Sauvegarder le titre édité
function saveEditedTitle() {
    const newTitle = document.getElementById('edit-input').value.trim();
    
    if (!newTitle) {
        showToast('Le titre ne peut pas être vide');
        return;
    }
    
    // Récupérer la note
    const noteData = localStorage.getItem(editingNoteId);
    if (noteData) {
        const note = JSON.parse(noteData);
        note.title = newTitle;
        note.date = new Date().toISOString(); // Mettre à jour la date
        
        // Sauvegarder
        localStorage.setItem(editingNoteId, JSON.stringify(note));
        
        // Si c'est la note actuelle, mettre à jour l'interface
        if (currentNoteId === editingNoteId) {
            noteTitle.textContent = newTitle;
            
            // Mettre à jour l'URL
            const slug = createSlug(newTitle);
            window.history.replaceState({ noteId: editingNoteId, slug }, newTitle, `/${slug}`);
        }
        
        // Fermer le modal
        hideEditModal();
        
        // Rafraîchir la liste des notes
        showNotes();
        
        showToast('Titre modifié ✓');
    }
}

// Masquer le modal d'édition
function hideEditModal() {
    document.getElementById('edit-modal').classList.remove('show');
    editingNoteId = null;
}

// Supprimer une note
function deleteNote(noteId, noteTitle) {
    const confirmDelete = confirm(`Supprimer la note "${noteTitle}" ?\n\nCette action est irréversible.`);
    
    if (confirmDelete) {
        // Supprimer de localStorage
        localStorage.removeItem(noteId);
        
        // Si c'est la note actuellement ouverte, créer une nouvelle note
        if (currentNoteId === noteId) {
            createNewNote();
        }
        
        // Si c'était la dernière note ouverte, nettoyer
        if (localStorage.getItem('lastNoteId') === noteId) {
            localStorage.removeItem('lastNoteId');
        }
        
        // Rafraîchir la liste
        showNotes();
        
        showToast('Note supprimée ✓');
    }
}

// Les fonctions sont maintenant attachées via addEventListener, plus besoin de window
