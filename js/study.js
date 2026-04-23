import { getSet, getProgress, saveProgress, resetProgress, getSettings, saveSettings } from './storage.js';
import {
  MASTERY,
  initProgress,
  stats,
  isComplete,
  buildRound,
  makeQuestion,
  gradeTyped,
  applyResult,
  requeueIndex,
} from './learn/engine.js';
import {
  renderProgressBar,
  renderMC,
  renderTyped,
  renderFeedback,
  renderRoundSummary,
  renderComplete,
} from './learn/ui.js';

const params = new URLSearchParams(location.search);
const setId = params.get('set');

const state = {
  set: null,
  progress: {},
  settings: { direction: 'def-to-term' },
  roundNum: 0,
  roundQueue: [],
  roundIdx: 0,
  roundStartStats: null,
  currentQuestion: null,
};

const stage = document.getElementById('stage');
const progressEl = document.getElementById('progress');
const setNameEl = document.getElementById('set-name');
const directionBtn = document.getElementById('direction-toggle');
const resetBtn = document.getElementById('reset-btn');

function persist() {
  saveProgress(state.set.id, state.progress);
}

function refreshProgressBar() {
  renderProgressBar(progressEl, stats(state.set.cards, state.progress));
}

function showCurrent() {
  if (isComplete(state.set.cards, state.progress)) {
    renderComplete(stage, {
      stats: stats(state.set.cards, state.progress),
      onReset: handleReset,
      onHome: () => { location.href = 'index.html'; },
    });
    refreshProgressBar();
    return;
  }

  if (state.roundIdx >= state.roundQueue.length) {
    const endStats = stats(state.set.cards, state.progress);
    const startStats = state.roundStartStats;
    const masteredThisRound = Math.max(0, endStats.mastered - startStats.mastered);
    const learnedThisRound = Math.max(0, (endStats.learning + endStats.mastered) - (startStats.learning + startStats.mastered));
    renderRoundSummary(stage, {
      roundNum: state.roundNum,
      masteredThisRound,
      learnedThisRound,
      stats: endStats,
      onContinue: startRound,
    });
    refreshProgressBar();
    return;
  }

  const card = state.roundQueue[state.roundIdx];
  const question = makeQuestion(card, state.set.cards, state.progress, state.settings.direction);
  state.currentQuestion = question;

  if (question.type === 'mc') {
    renderMC(stage, question,
      (choiceIdx) => handleAnswer({ choiceIdx, userAnswer: question.choices[choiceIdx] }),
      () => handleDontKnow()
    );
  } else {
    renderTyped(stage, question,
      (response) => handleAnswer({ response, userAnswer: response }),
      () => handleDontKnow()
    );
  }
}

function handleAnswer({ choiceIdx, response, userAnswer }) {
  const q = state.currentQuestion;
  let correct = false;
  let close = false;
  if (q.type === 'mc') {
    correct = choiceIdx === q.correctIndex;
  } else {
    const grade = gradeTyped(response, q.answer);
    correct = grade.correct;
    close = grade.close;
  }

  const card = state.set.cards.find((c) => c.id === q.cardId);
  state.progress = applyResult(state.progress, q.cardId, correct, q.type, state.roundNum);

  if (!correct) {
    const newIdx = requeueIndex(state.roundIdx, state.roundQueue.length);
    state.roundQueue.splice(newIdx, 0, card);
  }

  persist();
  refreshProgressBar();

  renderFeedback(stage, {
    correct,
    close,
    question: q,
    userAnswer,
    onContinue: () => {
      state.roundIdx++;
      showCurrent();
    },
    onOverride: correct ? null : () => overrideCorrect(q),
  });
}

function overrideCorrect(q) {
  const card = state.set.cards.find((c) => c.id === q.cardId);
  const lastIdx = state.roundQueue.lastIndexOf(card);
  if (lastIdx > state.roundIdx) {
    state.roundQueue.splice(lastIdx, 1);
  }
  const undo = state.progress[q.cardId];
  const prevState = { ...undo, wrongCount: Math.max(0, (undo.wrongCount || 0) - 1) };
  state.progress[q.cardId] = prevState;
  state.progress = applyResult(state.progress, q.cardId, true, q.type, state.roundNum);
  persist();
  refreshProgressBar();
  state.roundIdx++;
  showCurrent();
}

function handleDontKnow() {
  const q = state.currentQuestion;
  const card = state.set.cards.find((c) => c.id === q.cardId);
  state.progress = applyResult(state.progress, q.cardId, false, q.type, state.roundNum);
  const newIdx = requeueIndex(state.roundIdx, state.roundQueue.length);
  state.roundQueue.splice(newIdx, 0, card);
  persist();
  refreshProgressBar();
  renderFeedback(stage, {
    correct: false,
    close: false,
    question: q,
    userAnswer: null,
    onContinue: () => {
      state.roundIdx++;
      showCurrent();
    },
    onOverride: null,
  });
}

function startRound() {
  state.roundNum++;
  state.roundQueue = buildRound(state.set.cards, state.progress, state.roundNum);
  state.roundIdx = 0;
  state.roundStartStats = stats(state.set.cards, state.progress);
  refreshProgressBar();
  showCurrent();
}

function handleReset() {
  if (!confirm('Reset progress for this set? All mastery will be cleared.')) return;
  resetProgress(state.set.id);
  state.progress = initProgress(state.set.cards, {});
  state.roundNum = 0;
  startRound();
}

function toggleDirection() {
  state.settings.direction = state.settings.direction === 'def-to-term' ? 'term-to-def' : 'def-to-term';
  saveSettings(state.set.id, state.settings);
  updateDirectionLabel();
  showCurrent();
}

function updateDirectionLabel() {
  directionBtn.textContent = state.settings.direction === 'def-to-term'
    ? 'Answer with: Term'
    : 'Answer with: Definition';
}

function boot() {
  if (!setId) {
    stage.textContent = 'No set selected.';
    return;
  }
  const set = getSet(setId);
  if (!set) {
    stage.textContent = 'Set not found.';
    return;
  }
  state.set = set;
  state.settings = getSettings(setId);
  state.progress = initProgress(set.cards, getProgress(setId));
  persist();
  setNameEl.textContent = set.name;
  document.title = `Study · ${set.name}`;
  updateDirectionLabel();
  directionBtn.addEventListener('click', toggleDirection);
  resetBtn.addEventListener('click', handleReset);
  refreshProgressBar();
  if (isComplete(set.cards, state.progress)) {
    showCurrent();
  } else {
    startRound();
  }
}

boot();
