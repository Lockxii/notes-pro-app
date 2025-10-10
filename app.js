// Variables globales
let currentNoteId = null;
let notes = JSON.parse(localStorage.getItem('notes')) || {};
let toolbarVisible = false;

// Debug chargement initial
console.log('CHARGEMENT INITIAL - localStorage notes:', localStorage.getItem('notes'));
console.log('CHARGEMENT INITIAL - notes parsées:', notes);
console.log('CHARGEMENT INITIAL - nombre de notes:', Object.keys(notes).length);
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
    
    // Initialiser la détection du clavier iOS
    initKeyboardDetection();
    
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
    // Toolbar toujours visible maintenant
    
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
        // Marquer que l'utilisateur a interagi
        userInteracted = true;
    });
    
    // Approche simple : double-clic pour éditer
    const readingView = document.getElementById('reading-view');
    const noteContent = document.getElementById('note-content');
    let isEditing = false;
    let clickCount = 0;
    let clickTimer = null;
    
    // Mettre à jour l'affichage de lecture
    function updateReadingView() {
        const content = editor.innerHTML;
        if (content.trim() && content !== '<br>') {
            // Afficher le contenu formaté (HTML) en mode lecture
            noteContent.innerHTML = content;
            noteContent.classList.remove('empty');
        } else {
            noteContent.textContent = 'Double-tapez pour commencer à écrire...';
            noteContent.classList.add('empty');
        }
    }
    
    // Fonction pour basculer entre affichage formaté et texte brut
    function toggleReadingMode() {
        const content = editor.innerHTML;
        if (content.trim() && content !== '<br>') {
            if (noteContent.innerHTML === content) {
                // Actuellement en mode formaté, passer en mode texte brut
                noteContent.textContent = editor.textContent || editor.innerText || '';
                noteContent.style.fontFamily = 'monospace';
                noteContent.style.backgroundColor = '#f5f5f5';
                noteContent.style.padding = '15px';
                noteContent.style.borderRadius = '5px';
            } else {
                // Actuellement en mode texte brut, passer en mode formaté
                noteContent.innerHTML = content;
                noteContent.style.fontFamily = '';
                noteContent.style.backgroundColor = '';
                noteContent.style.padding = '20px';
                noteContent.style.borderRadius = '';
            }
        }
    }
    
    // Copie exacte du code qui marche sur la page de test
    let lastTapTime = 0;
    let tapCount = 0;
    let doubleTapTimer = null;
    
    // Méthode 1: touchstart avec timing (comme page de test)
    readingView.addEventListener('touchstart', function(e) {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTapTime;
        
        console.log(`Touch start - Délai depuis dernier tap: ${tapLength}ms`);
        
        if (tapLength < 300 && tapLength > 0) {
            console.log('*** DOUBLE TAP DÉTECTÉ SUR PAGE PRINCIPALE ! ***');
            e.preventDefault();
            enterEditMode();
        } else {
            console.log('Premier tap ou tap trop espacé');
        }
        
        lastTapTime = currentTime;
    });
    
    // Méthode 2: click avec compteur (comme page de test)
    readingView.addEventListener('click', function(e) {
        tapCount++;
        console.log(`Click ${tapCount} sur page principale`);
        
        if (tapCount === 1) {
            doubleTapTimer = setTimeout(() => {
                tapCount = 0;
                console.log('Simple click - timeout');
            }, 300);
        } else if (tapCount === 2) {
            clearTimeout(doubleTapTimer);
            tapCount = 0;
            console.log('*** DOUBLE CLICK DÉTECTÉ SUR PAGE PRINCIPALE ! ***');
            enterEditMode();
        }
    });
    
    // Méthode 3: dblclick natif (comme page de test)
    readingView.addEventListener('dblclick', function(e) {
        console.log('*** DBLCLICK NATIF DÉTECTÉ SUR PAGE PRINCIPALE ! ***');
        enterEditMode();
    });
    
    // Passer en mode édition
    function enterEditMode() {
        console.log('*** MODE ÉDITION ACTIVÉ SUR PAGE PRINCIPALE ***');
        
        if (isEditing) {
            console.log('Déjà en mode édition, ignoré');
            return;
        }
        
        isEditing = true;
        
        // Pas de feedback visuel - transition directe
        readingView.style.display = 'none';
        editor.classList.remove('hidden');
        
        // Focus immédiat pour iOS
        setTimeout(() => {
            editor.focus();
            console.log('Éditeur focusé sur page principale');
        }, 50);
    }
    
    // Sortir du mode édition
    function exitEditMode() {
        console.log('Sortie du mode édition');
        isEditing = false;
        
        // Blur l'éditeur
        editor.blur();
        
        // Masquer l'éditeur
        editor.classList.add('hidden');
        
        // Remettre la vue de lecture
        readingView.style.display = 'block';
        
        // Mettre à jour l'affichage
        updateReadingView();
        
        // Sauvegarder
        saveCurrentNote();
    }
    
    // Écouter les changements dans l'éditeur
    editor.addEventListener('input', function() {
        // Auto-save pendant l'édition
        clearTimeout(window.autoSaveTimeout);
        window.autoSaveTimeout = setTimeout(() => {
            saveCurrentNote();
        }, 2000);
    });
    
    // Sortir du mode édition automatiquement
    editor.addEventListener('blur', function() {
        setTimeout(() => {
            if (isEditing) {
                exitEditMode();
            }
        }, 200);
    });
    
    // Sortir aussi si on clique ailleurs
    document.addEventListener('click', function(e) {
        if (isEditing && !editor.contains(e.target) && e.target !== editor) {
            exitEditMode();
        }
    });
    
    // Initialiser l'affichage
    updateReadingView();
    
    // Gestion des changements de format avec prévention de désélection
    fontSelect.addEventListener('change', applyFontFamily);
    sizeSelect.addEventListener('change', applyFontSize);
    colorInput.addEventListener('change', applyTextColor);
    
    // Empêcher la désélection lors du clic sur les contrôles
    [fontSelect, sizeSelect, colorInput].forEach(control => {
        control.addEventListener('mousedown', (e) => {
            // Empêcher la perte de focus
            e.stopPropagation();
        });
        
        control.addEventListener('touchstart', (e) => {
            // Empêcher la perte de focus sur mobile
            e.stopPropagation();
        }, { passive: true });
    });
    
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
    
    // Event listeners spécifiques pour les boutons du header
    document.getElementById('undo-btn').addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Undo cliqué');
        undoLastAction();
    });

    document.getElementById('theme-btn').addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Theme cliqué');
        toggleTheme();
    });

    document.getElementById('save-btn').addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Save button cliqué - début');
        saveCurrentNote();
        console.log('Save button cliqué - fin');
    });

    document.querySelector('.notes-btn').addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Notes cliqué');
        toggleNotesModal();
    });

    // Event listeners tactiles pour les boutons header
    document.getElementById('undo-btn').addEventListener('touchend', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Undo touchend');
        undoLastAction();
    });

    document.getElementById('theme-btn').addEventListener('touchend', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Theme touchend');
        toggleTheme();
    });

    document.getElementById('save-btn').addEventListener('touchend', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Save touchend');
        saveCurrentNote();
    });

    // Bouton œil supprimé

    document.querySelector('.notes-btn').addEventListener('touchend', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Notes touchend');
        toggleNotesModal();
    });
    
    // Plus besoin de bouton éditer - utilisation du double-clic
    
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
    
    // Sauvegarder comme dernière note ouverte
    localStorage.setItem('lastOpenedNote', noteId);
    
    // Vider l'éditeur et rester en mode lecture
    const editor = document.getElementById('editor');
    const readingView = document.getElementById('reading-view');
    
    editor.innerHTML = '';
    isEditing = false;
    editor.classList.add('hidden');
    readingView.style.display = 'block';
    
    // Mettre à jour l'affichage de lecture
    updateReadingView();
    
    console.log('Nouvelle note créée:', noteId);
    
    // Réinitialiser l'historique pour la nouvelle note
    undoHistory = [];
    saveToUndoHistory();
    
    saveToStorage();
    hideNotesList();
}

function saveCurrentNote() {
    const editor = document.getElementById('editor');
    const content = editor.innerHTML; // Utiliser .innerHTML pour contenteditable
    
    // Si pas de note courante, créer une nouvelle note
    if (!currentNoteId) {
        currentNoteId = 'note_' + Date.now();
        console.log('Création nouvelle note:', currentNoteId);
    }
    
    // Extraire un titre (premiers mots du contenu, sans HTML)
    const textContent = editor.textContent || editor.innerText || '';
    const title = textContent.substring(0, 50).trim() || 'Note sans titre';
    
    notes[currentNoteId] = {
        id: currentNoteId,
        title: title,
        content: content,
        created: notes[currentNoteId]?.created || new Date().toISOString(),
        modified: new Date().toISOString()
    };
    
    // Sauvegarder comme dernière note ouverte
    localStorage.setItem('lastOpenedNote', currentNoteId);
    
    console.log('Note sauvée:', title, content.length + ' caractères');
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
        content: editor.innerHTML, // Utiliser .innerHTML pour contenteditable
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
        editor.innerHTML = previousState.content; // Utiliser .innerHTML pour contenteditable
        
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
    console.log('loadNote appelée avec noteId:', noteId);
    console.log('loadNote - notes disponibles:', Object.keys(notes));
    console.log('loadNote - note existe?', !!notes[noteId]);
    
    if (!notes[noteId]) {
        console.error('Note non trouvée:', noteId);
        return;
    }
    
    currentNoteId = noteId;
    const note = notes[noteId];
    const editor = document.getElementById('editor');
    const readingView = document.getElementById('reading-view');
    
    editor.innerHTML = note.content; // Utiliser .innerHTML pour contenteditable
    
    // Sauvegarder cette note comme dernière ouverte
    localStorage.setItem('lastOpenedNote', noteId);
    
    console.log('Note chargée:', note.title, note.content.length + ' caractères');
    
    // Forcer le retour en mode lecture
    isEditing = false;
    editor.classList.add('hidden');
    readingView.style.display = 'block';
    
    // Mettre à jour l'affichage de lecture
    updateReadingView();
    
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
        // Essayer de charger la dernière note ouverte
        const lastOpenedNoteId = localStorage.getItem('lastOpenedNote');
        
        if (lastOpenedNoteId && notes[lastOpenedNoteId]) {
            // Charger la dernière note ouverte si elle existe encore
            loadNote(lastOpenedNoteId);
            console.log('Chargement de la dernière note ouverte:', lastOpenedNoteId);
        } else {
            // Sinon, charger la note la plus récemment modifiée
            const lastNoteId = noteIds.reduce((latest, current) => {
                return notes[current].modified > notes[latest].modified ? current : latest;
            });
            loadNote(lastNoteId);
            console.log('Chargement de la note la plus récente:', lastNoteId);
        }
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
    console.log('saveToStorage - Sauvegarde de', Object.keys(notes).length, 'notes');
    console.log('saveToStorage - Contenu:', notes);
    localStorage.setItem('notes', JSON.stringify(notes));
    console.log('saveToStorage - Sauvé dans localStorage');
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
    
    console.log('displayNotesList - Nombre de notes:', Object.keys(notes).length);
    console.log('displayNotesList - Notes:', notes);
    
    const sortedNotes = Object.values(notes).sort((a, b) => 
        new Date(b.modified) - new Date(a.modified)
    );
    
    console.log('displayNotesList - Notes triées:', sortedNotes);
    
    if (sortedNotes.length === 0) {
        notesList.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Aucune note trouvée</div>';
        return;
    }
    
    sortedNotes.forEach(note => {
        const noteItem = document.createElement('div');
        noteItem.className = 'note-item';
        
        // Créer la preview
        const notePreview = document.createElement('div');
        notePreview.className = 'note-preview';
        notePreview.innerHTML = `
            <div class="note-title">${note.title}</div>
            <div class="note-content">${note.content.replace(/<[^>]*>/g, '').substring(0, 100)}...</div>
            <small>${new Date(note.modified).toLocaleDateString('fr-FR')}</small>
        `;
        // Event listener supprimé - utilisation du bouton Ouvrir maintenant
        
        // Créer les boutons d'action
        const actionsContainer = document.createElement('div');
        actionsContainer.style.display = 'flex';
        actionsContainer.style.gap = '8px';
        actionsContainer.style.alignItems = 'center';
        
        // Bouton ouvrir
        const openBtn = document.createElement('button');
        openBtn.className = 'note-open';
        openBtn.textContent = '📂 Ouvrir';
        openBtn.style.background = '#34C759';
        openBtn.style.color = 'white';
        openBtn.style.border = 'none';
        openBtn.style.padding = '10px 16px';
        openBtn.style.borderRadius = '8px';
        openBtn.style.cursor = 'pointer';
        openBtn.style.fontSize = '16px';
        openBtn.style.fontWeight = '600';
        openBtn.style.minWidth = '80px';
        openBtn.style.whiteSpace = 'nowrap';
        openBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('Ouverture de la note:', note.id);
            loadNote(note.id);
            hideNotesList();
        });
        
        // Créer le bouton de suppression
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'note-delete';
        deleteBtn.textContent = '🗑️ Sup.';
        deleteBtn.style.background = '#FF3B30';
        deleteBtn.style.color = 'white';
        deleteBtn.style.border = 'none';
        deleteBtn.style.padding = '10px 16px';
        deleteBtn.style.borderRadius = '8px';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.fontSize = '16px';
        deleteBtn.style.fontWeight = '600';
        deleteBtn.style.minWidth = '80px';
        deleteBtn.style.whiteSpace = 'nowrap';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('Suppression de la note:', note.id);
            deleteNote(note.id);
        });
        
        actionsContainer.appendChild(openBtn);
        actionsContainer.appendChild(deleteBtn);
        
        noteItem.appendChild(notePreview);
        noteItem.appendChild(actionsContainer);
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

// ============== SYSTÈME VISUAL VIEWPORT API POUR iOS ==============
// COPIE EXACTE de debug-toolbar.html qui fonctionne parfaitement
let keyboardHeight = 0;
let initialViewportHeight = window.innerHeight;

function adjustForKeyboard() {
    const toolbarContainer = document.getElementById('toolbar-container');
    if (!toolbarContainer) return;
    
    if (!window.visualViewport) {
        console.log('Visual Viewport API non supporté');
        return;
    }
    
    const viewport = window.visualViewport;
    keyboardHeight = window.innerHeight - viewport.height;
    
    if (keyboardHeight > 100) {
        // Clavier ouvert
        toolbarContainer.style.bottom = `${keyboardHeight}px`;
        toolbarContainer.classList.add('animated');
        console.log(`Clavier: ${keyboardHeight}px - Toolbar ajustée`);
    } else {
        // Clavier fermé
        toolbarContainer.style.bottom = '0px';
        toolbarContainer.classList.remove('animated');
        console.log('Clavier fermé - Toolbar en bas');
    }
}

// Initialisation du système de détection du clavier
function initKeyboardDetection() {
    // ÉVÉNEMENTS - IDENTIQUES À debug-toolbar.html
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', adjustForKeyboard);
        window.visualViewport.addEventListener('scroll', adjustForKeyboard);
        console.log('Visual Viewport API activé');
    } else {
        console.log('Visual Viewport API non disponible');
    }
    
    const editor = document.getElementById('editor');
    if (editor) {
        editor.addEventListener('focus', () => {
            console.log('Éditeur focusé');
            setTimeout(adjustForKeyboard, 300);
        });
        
        editor.addEventListener('blur', () => {
            console.log('Éditeur perdu focus');
            setTimeout(() => {
                const toolbarContainer = document.getElementById('toolbar-container');
                if (toolbarContainer) {
                    toolbarContainer.style.bottom = '0px';
                    toolbarContainer.classList.remove('animated');
                }
            }, 100);
        });
    }
    
    // Changement d'orientation
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            initialViewportHeight = window.innerHeight;
            console.log(`Orientation changée - Nouvelle hauteur: ${initialViewportHeight}px`);
            adjustForKeyboard();
        }, 500);
    });
    
    // Debug périodique - comme debug-toolbar.html
    setInterval(() => {
        if (document.activeElement === document.getElementById('editor')) {
            adjustForKeyboard();
        }
    }, 1000);
    
    // Initialisation
    window.addEventListener('load', () => {
        initialViewportHeight = window.innerHeight;
        console.log(`Chargé - H: ${initialViewportHeight}px, UA: ${navigator.userAgent.includes('iPhone') ? 'iPhone' : 'Autre'}`);
    });
}
