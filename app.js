// Variables globales
let currentNoteId = null;
let notes = JSON.parse(localStorage.getItem('notes')) || {};
let toolbarVisible = false;
let selectedImage = null;
let currentFontSize = 16;
let isDarkMode = localStorage.getItem('darkMode') === 'true';
let undoHistory = [];
let maxUndoSteps = 20;

// Debug pour mobile
function showDebugInfo() {
    const info = {
        userAgent: navigator.userAgent,
        touchSupport: 'ontouchstart' in window,
        viewport: window.innerWidth + 'x' + window.innerHeight,
        devicePixelRatio: window.devicePixelRatio
    };
    console.log('Device Info:', info);
}

// Initialisation de l'app
document.addEventListener('DOMContentLoaded', function() {
    showDebugInfo();
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
    
    // Gestion du focus sur l'éditeur (mobile et desktop)
    editor.addEventListener('focus', showToolbarOnFocus);
    editor.addEventListener('blur', hideToolbarOnBlur);
    
    // Gestion spéciale pour mobile
    editor.addEventListener('touchstart', function(e) {
        console.log('Editor touched');
        this.focus();
        
        // Forcer l'apparition du clavier sur iOS
        const mobileTextarea = document.getElementById('mobile-textarea');
        if (mobileTextarea) {
            mobileTextarea.focus();
            setTimeout(() => {
                editor.focus();
            }, 100);
        }
        
        showToolbarOnFocus();
    });
    
    editor.addEventListener('click', function(e) {
        console.log('Editor clicked');
        this.focus();
        showToolbarOnFocus();
    });
    
    // Gestion des changements de format
    fontSelect.addEventListener('change', applyFontFamily);
    sizeSelect.addEventListener('change', applyFontSize);
    colorInput.addEventListener('change', applyTextColor);
    
    // Améliorer les interactions tactiles
    const toolbarButtons = document.querySelectorAll('.toolbar-container button');
    toolbarButtons.forEach(button => {
        // Touch events pour mobile
        button.addEventListener('touchstart', function(e) {
            this.style.transform = 'scale(0.95)';
            this.style.opacity = '0.8';
            e.stopPropagation();
        }, { passive: false });
        
        button.addEventListener('touchend', function(e) {
            this.style.transform = 'scale(1)';
            this.style.opacity = '1';
            e.stopPropagation();
        }, { passive: false });
        
        // Click direct pour mobile
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            
            // Gestion des commandes de formatage
            const command = this.getAttribute('data-command');
            const action = this.getAttribute('data-action');
            
            if (command) {
                toggleFormat(command);
            } else if (action === 'image') {
                document.getElementById('file-input').click();
            } else if (this.onclick) {
                this.onclick();
            } else if (this.getAttribute('onclick')) {
                try {
                    eval(this.getAttribute('onclick'));
                } catch (error) {
                    console.log('Button action error:', error);
                }
            }
        });
        
        // Empêcher la perte de focus
        button.addEventListener('mousedown', function(e) {
            e.preventDefault();
        });
    });
    
    // Améliorer les selects pour mobile
    const toolbarSelects = document.querySelectorAll('.toolbar-container select');
    toolbarSelects.forEach(select => {
        select.addEventListener('focus', function() {
            const toolbarContainer = document.getElementById('toolbar-container');
            toolbarContainer.classList.add('show');
        });
        
        // Améliorer la réactivité tactile
        select.addEventListener('touchstart', function() {
            this.style.transform = 'scale(1.02)';
        });
        
        select.addEventListener('touchend', function() {
            this.style.transform = 'scale(1)';
        });
    });
    
    // Gestion des images
    fileInput.addEventListener('change', handleImageUpload);
    
    // Sauvegarde automatique
    editor.addEventListener('input', debounce(autoSave, 1000));
    
    // Améliorer les boutons de l'en-tête pour mobile
    const headerButtons = document.querySelectorAll('.header button');
    headerButtons.forEach(button => {
        button.addEventListener('touchstart', function(e) {
            this.style.transform = 'scale(0.95)';
            this.style.background = 'rgba(255,255,255,0.4)';
        });
        
        button.addEventListener('touchend', function(e) {
            this.style.transform = 'scale(1)';
            this.style.background = 'rgba(255,255,255,0.2)';
        });
    });
    
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
        if (toolbarContainer) {
            toolbarContainer.classList.add('show');
            toolbarVisible = true;
        }
    }, 500); // Délai plus long pour mobile
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
    if (toolbarContainer) {
        toolbarContainer.classList.toggle('show');
        toolbarVisible = !toolbarVisible;
        
        // Forcer le focus sur l'éditeur si on affiche la toolbar
        if (toolbarVisible) {
            setTimeout(() => {
                const editor = document.getElementById('editor');
                if (editor) {
                    editor.focus();
                }
            }, 100);
        }
    }
}

// Fonctions de formatage de texte
function toggleFormat(command) {
    try {
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
            const editor = document.getElementById('editor');
            if (editor) {
                editor.focus();
            }
        }, 50);
        
        // Sauvegarder les changements
        autoSave();
    } catch (error) {
        console.log('Format error:', error);
    }
}

function applyFontFamily() {
    try {
        const fontSelect = document.getElementById('font-select');
        if (!fontSelect) return;
        
        const fontFamily = fontSelect.value;
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
        if (editor) {
            editor.style.fontFamily = fontFamily;
        }
    }
    
    // Forcer le focus sur l'éditeur
    setTimeout(() => {
        const editor = document.getElementById('editor');
        if (editor) {
            editor.focus();
        }
        autoSave(); // Sauvegarder les changements
    }, 50);
    } catch (error) {
        console.log('Font family error:', error);
    }
}

function applyFontSize() {
    const sizeSelect = document.getElementById('size-select');
    const fontSize = sizeSelect.value;
    currentFontSize = parseInt(fontSize);
    

    
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
    img.style.cursor = 'move';
    img.draggable = false; // Empêcher le drag natif du navigateur
    
    // Wrapper pour rendre l'image déplaçable et redimensionnable
    const wrapper = document.createElement('div');
    wrapper.className = 'resizable-image';
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';
    wrapper.style.margin = '5px';
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
    
    // Événements pour l'image (déplacement + redimensionnement)
    setupImageEvents(wrapper, img, resizeHandle);
    
    // Sauvegarde automatique
    autoSave();
}

function setupImageEvents(wrapper, img, resizeHandle) {
    let isResizing = false;
    let isDragging = false;
    let startX, startY, startWidth, startHeight;
    let dragStartX, dragStartY, wrapperStartX, wrapperStartY;
    
    // Sélection d'image
    img.addEventListener('click', function(e) {
        e.stopPropagation();
        selectImage(wrapper);
    });
    
    // Déplacement de l'image (touch et mouse)
    img.addEventListener('mousedown', startDrag);
    img.addEventListener('touchstart', startDrag, { passive: false });
    
    // Redimensionnement
    resizeHandle.addEventListener('mousedown', startResize);
    resizeHandle.addEventListener('touchstart', startResize, { passive: false });
    
    function startDrag(e) {
        if (e.target === resizeHandle) return; // Ne pas déplacer si on redimensionne
        
        isDragging = true;
        selectImage(wrapper);
        
        const clientX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
        const clientY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
        
        dragStartX = clientX;
        dragStartY = clientY;
        
        const rect = wrapper.getBoundingClientRect();
        wrapperStartX = rect.left;
        wrapperStartY = rect.top;
        
        document.addEventListener('mousemove', doDrag);
        document.addEventListener('touchmove', doDrag, { passive: false });
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchend', stopDrag);
        
        e.preventDefault();
    }
    
    function doDrag(e) {
        if (!isDragging) return;
        
        const clientX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
        const clientY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
        
        const deltaX = clientX - dragStartX;
        const deltaY = clientY - dragStartY;
        
        // Convertir en position relative par rapport à l'éditeur
        const editor = document.getElementById('editor');
        const editorRect = editor.getBoundingClientRect();
        
        const newX = Math.max(0, Math.min(editorRect.width - wrapper.offsetWidth, wrapperStartX - editorRect.left + deltaX));
        const newY = Math.max(0, wrapperStartY - editorRect.top + deltaY);
        
        wrapper.style.position = 'absolute';
        wrapper.style.left = newX + 'px';
        wrapper.style.top = newY + 'px';
        wrapper.style.zIndex = '10';
        
        e.preventDefault();
    }
    
    function stopDrag() {
        isDragging = false;
        document.removeEventListener('mousemove', doDrag);
        document.removeEventListener('touchmove', doDrag);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchend', stopDrag);
        autoSave();
    }
    
    function startResize(e) {
        isResizing = true;
        selectImage(wrapper);
        
        startX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
        startY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
        startWidth = parseInt(window.getComputedStyle(img).width, 10);
        startHeight = parseInt(window.getComputedStyle(img).height, 10);
        
        document.addEventListener('mousemove', doResize);
        document.addEventListener('touchmove', doResize, { passive: false });
        document.addEventListener('mouseup', stopResize);
        document.addEventListener('touchend', stopResize);
        
        e.preventDefault();
        e.stopPropagation();
    }
    
    function doResize(e) {
        if (!isResizing) return;
        
        const clientX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
        const clientY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
        
        const newWidth = Math.max(50, startWidth + clientX - startX);
        const newHeight = Math.max(50, startHeight + clientY - startY);
        
        img.style.width = newWidth + 'px';
        img.style.height = newHeight + 'px';
        
        e.preventDefault();
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
        img.classList.remove('selected');
    });
    
    // Sélectionner cette image
    wrapper.classList.add('selected');
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
    
    // Réinitialiser l'historique pour la nouvelle note
    undoHistory = [];
    saveToUndoHistory();
    
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
    saveToUndoHistory();
    saveCurrentNote();
}

// Système d'annulation (Undo)
function saveToUndoHistory() {
    const editor = document.getElementById('editor');
    const currentState = {
        content: editor.innerHTML,
        timestamp: Date.now()
    };
    
    // Éviter de sauvegarder le même état
    if (undoHistory.length === 0 || undoHistory[undoHistory.length - 1].content !== currentState.content) {
        undoHistory.push(currentState);
        
        // Limiter la taille de l'historique
        if (undoHistory.length > maxUndoSteps) {
            undoHistory.shift();
        }
    }
}

function undoLastAction() {
    if (undoHistory.length <= 1) {
        // Feedback visuel si pas d'historique
        const undoBtn = document.querySelector('.undo-btn');
        const originalText = undoBtn.textContent;
        undoBtn.textContent = '✗';
        undoBtn.style.background = 'rgba(255,59,48,0.3)';
        
        setTimeout(() => {
            undoBtn.textContent = originalText;
            undoBtn.style.background = 'rgba(255,255,255,0.2)';
        }, 1000);
        return;
    }
    
    // Retirer l'état actuel
    undoHistory.pop();
    
    // Récupérer l'état précédent
    const previousState = undoHistory[undoHistory.length - 1];
    
    if (previousState) {
        const editor = document.getElementById('editor');
        editor.innerHTML = previousState.content;
        
        // Feedback visuel de succès
        const undoBtn = document.querySelector('.undo-btn');
        const originalText = undoBtn.textContent;
        undoBtn.textContent = '✓';
        undoBtn.style.background = 'rgba(52,199,89,0.3)';
        
        setTimeout(() => {
            undoBtn.textContent = originalText;
            undoBtn.style.background = 'rgba(255,255,255,0.2)';
        }, 1000);
        
        // Rétablir les événements sur les images restaurées
        setTimeout(() => {
            const images = editor.querySelectorAll('.resizable-image');
            images.forEach(wrapper => {
                const img = wrapper.querySelector('img');
                const resizeHandle = wrapper.querySelector('.resize-handle');
                if (img && resizeHandle) {
                    setupImageEvents(wrapper, img, resizeHandle);
                }
            });
        }, 100);
        
        // Sauvegarder la note modifiée
        saveCurrentNote();
    }
}

function loadNote(noteId) {
    if (!notes[noteId]) return;
    
    currentNoteId = noteId;
    const note = notes[noteId];
    const editor = document.getElementById('editor');
    editor.innerHTML = note.content;
    
    // Réinitialiser l'historique pour la nouvelle note
    undoHistory = [];
    saveToUndoHistory();
    
    // Rétablir les événements sur les images
    setTimeout(() => {
        const images = editor.querySelectorAll('.resizable-image');
        images.forEach(wrapper => {
            const img = wrapper.querySelector('img');
            const resizeHandle = wrapper.querySelector('.resize-handle');
            if (img && resizeHandle) {
                setupImageEvents(wrapper, img, resizeHandle);
            }
        });
    }, 100);
    
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
            case 'z':
                e.preventDefault();
                undoLastAction();
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
