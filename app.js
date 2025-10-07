// Variables globales
let currentNoteId = null;
let notes = JSON.parse(localStorage.getItem('notes')) || {};
let toolbarVisible = false;
let selectedImage = null;
let currentFontSize = 16;
let isDarkMode = localStorage.getItem('darkMode') === 'true';

// Initialisation de l'app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadLastNote();
});

function initializeApp() {
    // Registrer le service worker pour PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js');
    }
    
    // Appliquer le thème sauvegardé
    applyTheme();
    
    // Créer une première note si aucune n'existe
    if (Object.keys(notes).length === 0) {
        createNewNote();
    }
}

function setupEventListeners() {
    const editor = document.getElementById('editor');
    const fontSelect = document.getElementById('font-select');
    const sizeSelect = document.getElementById('size-select');
    const colorInput = document.getElementById('color-input');
    const fileInput = document.getElementById('file-input');
    
    // Gestion du focus sur l'éditeur
    editor.addEventListener('focus', showToolbarOnFocus);
    editor.addEventListener('blur', hideToolbarOnBlur);
    
    // Gestion des changements de format
    fontSelect.addEventListener('change', applyFontFamily);
    sizeSelect.addEventListener('change', applyFontSize);
    colorInput.addEventListener('change', applyTextColor);
    
    // Éviter la perte de focus lors de l'interaction avec la barre d'outils
    const toolbarButtons = document.querySelectorAll('.toolbar-container button');
    toolbarButtons.forEach(button => {
        button.addEventListener('mousedown', function(e) {
            e.preventDefault(); // Empêcher la perte de focus de l'éditeur
        });
        button.addEventListener('touchstart', function(e) {
            e.preventDefault(); // Empêcher la perte de focus sur mobile
        });
    });
    
    // Pour les selects, on garde le comportement normal mais on gère différemment
    const toolbarSelects = document.querySelectorAll('.toolbar-container select');
    toolbarSelects.forEach(select => {
        select.addEventListener('focus', function() {
            // Garder la barre d'outils visible quand on utilise un select
            const toolbarContainer = document.getElementById('toolbar-container');
            toolbarContainer.classList.add('show');
        });
    });
    
    // Gestion des images
    fileInput.addEventListener('change', handleImageUpload);
    
    // Sauvegarde automatique
    editor.addEventListener('input', debounce(autoSave, 1000));
    
    // Gestion des touches clavier
    document.addEventListener('keydown', handleKeyboard);
    
    // Prévenir le zoom sur double tap
    document.addEventListener('touchend', function(e) {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
            e.preventDefault();
        }
    });
}

// Gestion de la barre d'outils
function showToolbarOnFocus() {
    setTimeout(() => {
        const toolbarContainer = document.getElementById('toolbar-container');
        toolbarContainer.classList.add('show');
        toolbarVisible = true;
    }, 300); // Délai pour laisser le clavier apparaître
}

function hideToolbarOnBlur() {
    setTimeout(() => {
        // Ne pas cacher la barre d'outils si on interagit avec elle
        const activeElement = document.activeElement;
        const isToolbarElement = activeElement && (
            activeElement.closest('.toolbar-container') ||
            activeElement.classList.contains('font-select') ||
            activeElement.classList.contains('size-select') ||
            activeElement.classList.contains('color-input')
        );
        
        if (!isToolbarElement) {
            const toolbarContainer = document.getElementById('toolbar-container');
            toolbarContainer.classList.remove('show');
            toolbarVisible = false;
        }
    }, 200);
}

function toggleToolbar() {
    const toolbarContainer = document.getElementById('toolbar-container');
    toolbarContainer.classList.toggle('show');
    toolbarVisible = !toolbarVisible;
}

// Fonctions de formatage de texte
function toggleFormat(command) {
    const selection = window.getSelection();
    const savedSelection = saveSelection();
    
    document.execCommand(command, false, null);
    updateToolbarState();
    
    // Restaurer la sélection si elle existait
    if (savedSelection && selection.rangeCount > 0 && !selection.isCollapsed) {
        setTimeout(() => {
            restoreSelection(savedSelection);
        }, 10);
    }
    
    setTimeout(() => {
        document.getElementById('editor').focus();
    }, 10);
}

function applyFontFamily() {
    const fontSelect = document.getElementById('font-select');
    const fontFamily = fontSelect.value;
    
    console.log('Applying font family:', fontFamily); // Debug
    
    const selection = window.getSelection();
    const savedSelection = saveSelection();
    
    if (selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const span = document.createElement('span');
        span.style.fontFamily = fontFamily;
        
        try {
            range.surroundContents(span);
        } catch (e) {
            const contents = range.extractContents();
            span.appendChild(contents);
            range.insertNode(span);
        }
        
        // Restaurer la sélection
        restoreSelection(savedSelection);
    } else {
        // Pour le prochain texte
        const editor = document.getElementById('editor');
        editor.style.fontFamily = fontFamily;
    }
    
    // Forcer le focus sur l'éditeur
    setTimeout(() => {
        const editor = document.getElementById('editor');
        editor.focus();
        autoSave(); // Sauvegarder les changements
    }, 50);
}

function applyFontSize() {
    const sizeSelect = document.getElementById('size-select');
    const fontSize = sizeSelect.value;
    currentFontSize = parseInt(fontSize);
    
    console.log('Applying font size:', fontSize + 'px'); // Debug
    
    const selection = window.getSelection();
    const savedSelection = saveSelection();
    
    if (selection.rangeCount > 0 && !selection.isCollapsed) {
        // Appliquer à la sélection existante
        const range = selection.getRangeAt(0);
        const span = document.createElement('span');
        span.style.fontSize = fontSize + 'px';
        
        try {
            range.surroundContents(span);
        } catch (e) {
            // Si la sélection traverse plusieurs éléments
            const contents = range.extractContents();
            span.appendChild(contents);
            range.insertNode(span);
        }
        
        // Restaurer la sélection
        restoreSelection(savedSelection);
    } else {
        // Définir la taille pour le prochain texte en utilisant execCommand
        document.execCommand('fontSize', false, '7'); // Taille temporaire
        // Remplacer par la vraie taille
        setTimeout(() => {
            const editor = document.getElementById('editor');
            const fontElements = editor.querySelectorAll('font[size="7"]');
            fontElements.forEach(el => {
                const span = document.createElement('span');
                span.style.fontSize = fontSize + 'px';
                span.innerHTML = el.innerHTML;
                el.parentNode.replaceChild(span, el);
            });
        }, 10);
    }
    
    // Forcer le focus sur l'éditeur
    setTimeout(() => {
        const editor = document.getElementById('editor');
        editor.focus();
        autoSave(); // Sauvegarder les changements
    }, 50);
}

// Fonction pour sauvegarder la sélection
function saveSelection() {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        return {
            startOffset: range.startOffset,
            endOffset: range.endOffset,
            startContainer: range.startContainer,
            endContainer: range.endContainer,
            collapsed: range.collapsed
        };
    }
    return null;
}

// Fonction pour restaurer la sélection
function restoreSelection(savedSelection) {
    if (savedSelection && savedSelection.startContainer && savedSelection.endContainer) {
        const selection = window.getSelection();
        const range = document.createRange();
        try {
            range.setStart(savedSelection.startContainer, savedSelection.startOffset);
            range.setEnd(savedSelection.endContainer, savedSelection.endOffset);
            selection.removeAllRanges();
            selection.addRange(range);
        } catch (e) {
            // Ignore les erreurs de restauration si les noeuds n'existent plus
            console.log('Erreur lors de la restauration de la sélection:', e);
        }
    }
}

function applyTextColor() {
    const color = document.getElementById('color-input').value;
    const selection = window.getSelection();
    const savedSelection = saveSelection();
    
    if (selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const span = document.createElement('span');
        span.style.color = color;
        
        try {
            range.surroundContents(span);
        } catch (e) {
            const contents = range.extractContents();
            span.appendChild(contents);
            range.insertNode(span);
        }
        
        // Restaurer la sélection
        restoreSelection(savedSelection);
    } else {
        // Pour le prochain texte
        document.execCommand('foreColor', false, color);
    }
    
    setTimeout(() => {
        document.getElementById('editor').focus();
    }, 10);
}

function updateToolbarState() {
    // Mettre à jour l'état des boutons
    document.getElementById('bold-btn').classList.toggle('active', document.queryCommandState('bold'));
    document.getElementById('italic-btn').classList.toggle('active', document.queryCommandState('italic'));
    document.getElementById('underline-btn').classList.toggle('active', document.queryCommandState('underline'));
}

// Gestion des images
function handleImageUpload(event) {
    const files = event.target.files;
    for (let file of files) {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                insertImage(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    }
    event.target.value = ''; // Reset input
}

function insertImage(src) {
    const editor = document.getElementById('editor');
    const img = document.createElement('img');
    img.src = src;
    img.style.maxWidth = '300px';
    img.style.height = 'auto';
    img.style.margin = '10px';
    img.style.cursor = 'pointer';
    
    // Wrapper pour rendre l'image redimensionnable
    const wrapper = document.createElement('div');
    wrapper.className = 'resizable-image';
    wrapper.appendChild(img);
    
    // Handle de redimensionnement
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    wrapper.appendChild(resizeHandle);
    
    // Insertion dans l'éditeur
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.insertNode(wrapper);
        range.collapse(false);
    } else {
        editor.appendChild(wrapper);
    }
    
    // Événements pour l'image
    setupImageEvents(wrapper, img, resizeHandle);
    
    // Sauvegarde automatique
    autoSave();
}

function setupImageEvents(wrapper, img, resizeHandle) {
    let isResizing = false;
    let startX, startY, startWidth, startHeight;
    
    // Sélection d'image
    img.addEventListener('click', function(e) {
        e.stopPropagation();
        selectImage(wrapper);
    });
    
    // Redimensionnement
    resizeHandle.addEventListener('mousedown', startResize);
    resizeHandle.addEventListener('touchstart', startResize);
    
    function startResize(e) {
        isResizing = true;
        startX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
        startY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
        startWidth = parseInt(window.getComputedStyle(img).width, 10);
        startHeight = parseInt(window.getComputedStyle(img).height, 10);
        
        document.addEventListener('mousemove', doResize);
        document.addEventListener('touchmove', doResize);
        document.addEventListener('mouseup', stopResize);
        document.addEventListener('touchend', stopResize);
        
        e.preventDefault();
    }
    
    function doResize(e) {
        if (!isResizing) return;
        
        const clientX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
        const clientY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
        
        const newWidth = startWidth + clientX - startX;
        const newHeight = startHeight + clientY - startY;
        
        if (newWidth > 50 && newHeight > 50) {
            img.style.width = newWidth + 'px';
            img.style.height = newHeight + 'px';
        }
    }
    
    function stopResize() {
        isResizing = false;
        document.removeEventListener('mousemove', doResize);
        document.removeEventListener('touchmove', doResize);
        document.removeEventListener('mouseup', stopResize);
        document.removeEventListener('touchend', stopResize);
        autoSave();
    }
}

function selectImage(wrapper) {
    // Désélectionner toutes les autres images
    document.querySelectorAll('.resizable-image').forEach(img => {
        img.style.border = '2px dashed transparent';
    });
    
    // Sélectionner cette image
    wrapper.style.border = '2px dashed #007AFF';
    selectedImage = wrapper;
}

// Gestion des notes
function createNewNote() {
    const noteId = 'note_' + Date.now();
    const note = {
        id: noteId,
        title: 'Nouvelle note',
        content: '',
        created: new Date().toISOString(),
        modified: new Date().toISOString()
    };
    
    notes[noteId] = note;
    currentNoteId = noteId;
    
    // Vider l'éditeur
    document.getElementById('editor').innerHTML = '';
    
    saveToStorage();
    hideNotesList();
}

function saveCurrentNote() {
    if (!currentNoteId) return;
    
    const editor = document.getElementById('editor');
    const content = editor.innerHTML;
    const textContent = editor.textContent || editor.innerText || '';
    
    // Extraire un titre (premiers mots du contenu)
    const title = textContent.substring(0, 50).trim() || 'Note sans titre';
    
    notes[currentNoteId] = {
        ...notes[currentNoteId],
        title: title,
        content: content,
        modified: new Date().toISOString()
    };
    
    saveToStorage();
    
    // Feedback visuel
    const saveBtn = document.querySelector('.save-btn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = '✅ Sauvé';
    saveBtn.style.background = '#34C759';
    
    setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.style.background = 'rgba(255,255,255,0.2)';
    }, 1500);
}

function autoSave() {
    saveCurrentNote();
}

function loadNote(noteId) {
    if (!notes[noteId]) return;
    
    currentNoteId = noteId;
    const note = notes[noteId];
    document.getElementById('editor').innerHTML = note.content;
    hideNotesList();
}

function loadLastNote() {
    const noteIds = Object.keys(notes);
    if (noteIds.length > 0) {
        // Charger la note la plus récemment modifiée
        const lastNoteId = noteIds.reduce((latest, current) => {
            return notes[current].modified > notes[latest].modified ? current : latest;
        });
        loadNote(lastNoteId);
    }
}

function deleteNote(noteId) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette note ?')) {
        delete notes[noteId];
        saveToStorage();
        
        if (noteId === currentNoteId) {
            createNewNote();
        }
        
        displayNotesList();
    }
}

function saveToStorage() {
    localStorage.setItem('notes', JSON.stringify(notes));
}

// Interface des notes
function showNotesList() {
    displayNotesList();
    document.getElementById('notes-modal').style.display = 'block';
}

function hideNotesList() {
    document.getElementById('notes-modal').style.display = 'none';
}

function displayNotesList() {
    const notesList = document.getElementById('notes-list');
    notesList.innerHTML = '';
    
    const sortedNotes = Object.values(notes).sort((a, b) => 
        new Date(b.modified) - new Date(a.modified)
    );
    
    sortedNotes.forEach(note => {
        const noteItem = document.createElement('div');
        noteItem.className = 'note-item';
        noteItem.innerHTML = `
            <div class="note-preview" onclick="loadNote('${note.id}')">
                <div class="note-title">${note.title}</div>
                <div class="note-content">${note.content.replace(/<[^>]*>/g, '').substring(0, 100)}...</div>
                <small>${new Date(note.modified).toLocaleDateString('fr-FR')}</small>
            </div>
            <button class="note-delete" onclick="deleteNote('${note.id}')">🗑️</button>
        `;
        notesList.appendChild(noteItem);
    });
}

// Utilitaires
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

function handleKeyboard(e) {
    // Raccourcis clavier
    if (e.metaKey || e.ctrlKey) {
        switch(e.key) {
            case 'b':
                e.preventDefault();
                toggleFormat('bold');
                break;
            case 'i':
                e.preventDefault();
                toggleFormat('italic');
                break;
            case 'u':
                e.preventDefault();
                toggleFormat('underline');
                break;
            case 's':
                e.preventDefault();
                saveCurrentNote();
                break;
        }
    }
    
    // Supprimer l'image sélectionnée
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedImage) {
            selectedImage.remove();
            selectedImage = null;
            autoSave();
            e.preventDefault();
        }
    }
}

// Gestion du mode sombre
function toggleTheme() {
    isDarkMode = !isDarkMode;
    localStorage.setItem('darkMode', isDarkMode);
    applyTheme();
}

function applyTheme() {
    const body = document.body;
    const themeBtn = document.querySelector('.theme-btn');
    
    if (isDarkMode) {
        body.classList.add('dark-mode');
        if (themeBtn) themeBtn.textContent = '☀️';
    } else {
        body.classList.remove('dark-mode');
        if (themeBtn) themeBtn.textContent = '🌙';
    }
}

// Mise à jour de l'état de la barre d'outils quand la sélection change
document.addEventListener('selectionchange', updateToolbarState);
