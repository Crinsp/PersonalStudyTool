const INDEX_KEY = 'studytool.sets';
const SET_KEY = (id) => `studytool.set.${id}`;
const PROGRESS_KEY = (id) => `studytool.progress.${id}`;
const SETTINGS_KEY = (id) => `studytool.settings.${id}`;

export function newId() {
  return 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export function cardId() {
  return 'c_' + Math.random().toString(36).slice(2, 10);
}

export function listSets() {
  const raw = localStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveIndex(index) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export function getSet(id) {
  const raw = localStorage.getItem(SET_KEY(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveSet(set) {
  if (!set.id) set.id = newId();
  if (!set.createdAt) set.createdAt = Date.now();
  set.updatedAt = Date.now();
  for (const card of set.cards) {
    if (!card.id) card.id = cardId();
  }
  localStorage.setItem(SET_KEY(set.id), JSON.stringify(set));

  const index = listSets();
  const existing = index.findIndex((s) => s.id === set.id);
  const summary = {
    id: set.id,
    name: set.name,
    cardCount: set.cards.length,
    createdAt: set.createdAt,
    updatedAt: set.updatedAt,
  };
  if (existing >= 0) index[existing] = summary;
  else index.unshift(summary);
  saveIndex(index);
  return set;
}

export function deleteSet(id) {
  localStorage.removeItem(SET_KEY(id));
  localStorage.removeItem(PROGRESS_KEY(id));
  localStorage.removeItem(SETTINGS_KEY(id));
  const index = listSets().filter((s) => s.id !== id);
  saveIndex(index);
}

export function getProgress(id) {
  const raw = localStorage.getItem(PROGRESS_KEY(id));
  if (!raw) return {};
  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

export function saveProgress(id, progress) {
  localStorage.setItem(PROGRESS_KEY(id), JSON.stringify(progress));
}

export function resetProgress(id) {
  localStorage.removeItem(PROGRESS_KEY(id));
}

export function pruneProgress(setId, keepCardIds) {
  const progress = getProgress(setId);
  const keep = new Set(keepCardIds);
  let changed = false;
  for (const key of Object.keys(progress)) {
    if (!keep.has(key)) {
      delete progress[key];
      changed = true;
    }
  }
  if (changed) saveProgress(setId, progress);
}

export function getSettings(id) {
  const raw = localStorage.getItem(SETTINGS_KEY(id));
  if (!raw) return { direction: 'def-to-term' };
  try {
    return { direction: 'def-to-term', ...(JSON.parse(raw) || {}) };
  } catch {
    return { direction: 'def-to-term' };
  }
}

export function saveSettings(id, settings) {
  localStorage.setItem(SETTINGS_KEY(id), JSON.stringify(settings));
}
