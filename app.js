// App Notes Simple

let currentNoteId = null;
const editor = document.getElementById('editor');

// Sauvegarder une note
function saveNote() {
    const content = editor.value.trim();
    if (!content) {
        alert('Rien à sauver !');
        return;
    }
    
    const noteId = currentNoteId || 'note_' + Date.now();
    const title = content.split('\n')[0].substring(0, 50) || 'Note sans titre';
    
    const note = {
        id: noteId,
        title: title,
        content: content,
        date: new Date().toISOString()
    };
    
    localStorage.setItem(noteId, JSON.stringify(note));
    currentNoteId = noteId;
    
    alert('Note sauvée !');
}

// Charger une note
function loadNote(noteId) {
    const noteData = localStorage.getItem(noteId);
    if (noteData) {
        const note = JSON.parse(noteData);
        editor.value = note.content;
        currentNoteId = noteId;
        document.title = note.title;
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    console.log('App Notes chargée !');
});
