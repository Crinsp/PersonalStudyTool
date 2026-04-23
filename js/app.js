import { listSets, getSet, saveSet, deleteSet, pruneProgress, newId, cardId } from './storage.js';
import { parseInput } from './parser.js';
import { el, clear } from './learn/ui.js';

const view = document.getElementById('view');

function renderLibrary() {
  clear(view);
  const sets = listSets();

  const header = el('div', { class: 'lib-header' }, [
    el('h1', {}, 'Your study sets'),
    el('div', { class: 'lib-actions' }, [
      el('button', { class: 'primary-btn', onclick: () => renderNewSet() }, '+ New set'),
      el('label', { class: 'link-btn file-btn' }, [
        'Import JSON',
        el('input', {
          type: 'file',
          accept: '.json,application/json',
          style: { display: 'none' },
          onchange: handleImportJson,
        }),
      ]),
    ]),
  ]);
  view.appendChild(header);

  if (sets.length === 0) {
    view.appendChild(el('div', { class: 'empty' }, [
      el('p', {}, 'No sets yet.'),
      el('p', { class: 'muted' }, 'Click "New set" and paste tab-separated term/definition pairs to get started.'),
    ]));
    return;
  }

  const list = el('ul', { class: 'set-list' });
  for (const s of sets) {
    list.appendChild(el('li', { class: 'set-card' }, [
      el('a', { class: 'set-main', href: `study.html?set=${encodeURIComponent(s.id)}` }, [
        el('div', { class: 'set-name' }, s.name),
        el('div', { class: 'set-meta muted' }, `${s.cardCount} card${s.cardCount === 1 ? '' : 's'}`),
      ]),
      el('div', { class: 'set-actions' }, [
        el('button', { class: 'link-btn', onclick: () => renderEditSet(s.id) }, 'Edit'),
        el('button', { class: 'link-btn', onclick: () => handleExport(s.id) }, 'Export'),
        el('button', { class: 'link-btn danger', onclick: () => handleDelete(s.id) }, 'Delete'),
      ]),
    ]));
  }
  view.appendChild(list);
}

function handleDelete(id) {
  const set = getSet(id);
  if (!set) return;
  if (!confirm(`Delete "${set.name}" and all its progress? This can't be undone.`)) return;
  deleteSet(id);
  renderLibrary();
}

function handleExport(id) {
  const set = getSet(id);
  if (!set) return;
  const payload = JSON.stringify({ name: set.name, cards: set.cards.map((c) => ({ term: c.term, definition: c.definition })) }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${set.name.replace(/[^\w-]+/g, '_') || 'set'}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function handleImportJson(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      if (!data || !Array.isArray(data.cards)) throw new Error('Missing cards array');
      const cards = data.cards
        .filter((c) => c && c.term && c.definition)
        .map((c) => ({ term: String(c.term).trim(), definition: String(c.definition).trim() }));
      if (!cards.length) throw new Error('No valid cards');
      renderEditor({
        mode: 'create',
        initialName: data.name || file.name.replace(/\.[^.]+$/, ''),
        initialCards: cards,
      });
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function renderNewSet() {
  clear(view);
  const nameInput = el('input', { type: 'text', class: 'field', placeholder: 'Set name (e.g. "Bio Chapter 4")' });
  const textarea = el('textarea', {
    class: 'field paste-area',
    rows: '12',
    placeholder: 'Paste tab-separated flashcards here. One per line:\n\nMitochondria\tPowerhouse of the cell\nOsmosis\tMovement of water across a semipermeable membrane',
  });
  const fileInput = el('input', {
    type: 'file',
    accept: '.txt,.tsv,.csv,text/plain',
    onchange: (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!nameInput.value) nameInput.value = file.name.replace(/\.[^.]+$/, '');
      const reader = new FileReader();
      reader.onload = () => { textarea.value = String(reader.result); };
      reader.readAsText(file);
    },
  });
  const errorBox = el('div', { class: 'error-box', style: { display: 'none' } });

  const onParse = () => {
    const { cards, errors } = parseInput(textarea.value);
    if (!cards.length) {
      errorBox.style.display = 'block';
      clear(errorBox);
      errorBox.appendChild(el('div', {}, 'No cards parsed. Make sure each line has a tab (or " - " / " — " / ": ") between term and definition.'));
      return;
    }
    errorBox.style.display = 'none';
    renderEditor({
      mode: 'create',
      initialName: nameInput.value.trim() || 'Untitled set',
      initialCards: cards,
      parseErrors: errors,
    });
  };

  view.appendChild(el('div', { class: 'panel' }, [
    el('div', { class: 'panel-header' }, [
      el('h1', {}, 'New set'),
      el('button', { class: 'link-btn', onclick: renderLibrary }, '← Back'),
    ]),
    el('label', { class: 'field-label' }, 'Name'),
    nameInput,
    el('label', { class: 'field-label' }, 'Paste Claude output (tab-separated)'),
    textarea,
    el('div', { class: 'row-between' }, [
      el('label', { class: 'link-btn file-btn' }, ['Or load a .txt / .tsv file', fileInput]),
    ]),
    errorBox,
    el('div', { class: 'panel-footer' }, [
      el('button', { class: 'primary-btn', onclick: onParse }, 'Next: review & edit cards →'),
    ]),
  ]));

  setTimeout(() => nameInput.focus(), 0);
}

function renderEditSet(id) {
  const set = getSet(id);
  if (!set) {
    renderLibrary();
    return;
  }
  renderEditor({
    mode: 'edit',
    setId: id,
    initialName: set.name,
    initialCards: set.cards.map((c) => ({ id: c.id, term: c.term, definition: c.definition })),
  });
}

function renderEditor({ mode, setId = null, initialName, initialCards, parseErrors = [] }) {
  clear(view);
  const state = {
    name: initialName,
    rows: initialCards.map((c) => ({ id: c.id || cardId(), term: c.term, definition: c.definition })),
  };

  const nameInput = el('input', { type: 'text', class: 'field', value: state.name });
  nameInput.addEventListener('input', () => { state.name = nameInput.value; });

  const table = el('div', { class: 'editor-table' });
  const countLabel = el('span', { class: 'count-label' });

  const renderTable = () => {
    clear(table);
    table.appendChild(el('div', { class: 'editor-head' }, [
      el('div', {}, '#'),
      el('div', {}, 'Term'),
      el('div', {}, 'Definition'),
      el('div', {}, ''),
    ]));
    state.rows.forEach((row, i) => {
      const termInput = el('textarea', { class: 'cell', rows: '1' });
      termInput.value = row.term;
      termInput.addEventListener('input', () => { row.term = termInput.value; });

      const defInput = el('textarea', { class: 'cell', rows: '1' });
      defInput.value = row.definition;
      defInput.addEventListener('input', () => { row.definition = defInput.value; });

      const moveUp = el('button', {
        class: 'icon-btn',
        title: 'Move up',
        disabled: i === 0,
        onclick: () => { swap(i, i - 1); },
      }, '↑');
      const moveDown = el('button', {
        class: 'icon-btn',
        title: 'Move down',
        disabled: i === state.rows.length - 1,
        onclick: () => { swap(i, i + 1); },
      }, '↓');
      const del = el('button', {
        class: 'icon-btn danger',
        title: 'Delete row',
        onclick: () => { state.rows.splice(i, 1); renderTable(); updateCount(); },
      }, '✕');

      table.appendChild(el('div', { class: 'editor-row' }, [
        el('div', { class: 'row-num' }, String(i + 1)),
        termInput,
        defInput,
        el('div', { class: 'row-actions' }, [moveUp, moveDown, del]),
      ]));
    });
  };

  const swap = (i, j) => {
    [state.rows[i], state.rows[j]] = [state.rows[j], state.rows[i]];
    renderTable();
  };

  const updateCount = () => {
    countLabel.textContent = `${state.rows.length} card${state.rows.length === 1 ? '' : 's'}`;
  };

  const addRow = () => {
    state.rows.push({ id: cardId(), term: '', definition: '' });
    renderTable();
    updateCount();
    const rows = table.querySelectorAll('.editor-row');
    const last = rows[rows.length - 1];
    if (last) {
      const firstInput = last.querySelector('textarea');
      firstInput?.focus();
    }
  };

  const save = () => {
    const cleaned = state.rows
      .map((r) => ({ id: r.id, term: r.term.trim(), definition: r.definition.trim() }))
      .filter((r) => r.term && r.definition);
    if (!cleaned.length) {
      alert('Need at least one card with both term and definition.');
      return;
    }
    const name = (state.name || '').trim() || 'Untitled set';
    if (mode === 'edit') {
      const existing = getSet(setId);
      const updated = { ...existing, name, cards: cleaned };
      saveSet(updated);
      pruneProgress(setId, cleaned.map((c) => c.id));
    } else {
      saveSet({ id: newId(), name, cards: cleaned });
    }
    renderLibrary();
  };

  const cancel = () => {
    if (confirm('Discard changes?')) renderLibrary();
  };

  view.appendChild(el('div', { class: 'panel' }, [
    el('div', { class: 'panel-header' }, [
      el('h1', {}, mode === 'edit' ? 'Edit set' : 'Review & edit cards'),
      el('button', { class: 'link-btn', onclick: cancel }, '← Cancel'),
    ]),
    parseErrors.length
      ? el('div', { class: 'warn-box' }, [
          el('strong', {}, `Skipped ${parseErrors.length} line${parseErrors.length === 1 ? '' : 's'}:`),
          el('ul', {}, parseErrors.slice(0, 10).map((err) =>
            el('li', {}, `Line ${err.line}: ${err.reason} (“${err.text.slice(0, 60)}${err.text.length > 60 ? '…' : ''}”)`)
          )),
          parseErrors.length > 10 ? el('div', { class: 'muted' }, `…and ${parseErrors.length - 10} more`) : null,
          el('div', { class: 'muted' }, 'You can add these manually below using "+ Add row".'),
        ])
      : null,
    el('label', { class: 'field-label' }, 'Name'),
    nameInput,
    el('div', { class: 'row-between editor-controls' }, [
      countLabel,
      el('button', { class: 'secondary-btn', onclick: addRow }, '+ Add row'),
    ]),
    table,
    el('div', { class: 'panel-footer' }, [
      el('button', { class: 'primary-btn', onclick: save }, mode === 'edit' ? 'Save changes' : 'Save set'),
      el('button', { class: 'link-btn', onclick: cancel }, 'Cancel'),
    ]),
  ]));

  renderTable();
  updateCount();
}

renderLibrary();
