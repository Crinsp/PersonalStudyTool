export const MASTERY = { NOT_STARTED: 0, LEARNING: 1, MASTERED: 2 };
export const ROUND_SIZE = 7;
export const STREAK_TO_MASTER = 2;

export function makeRng(seed) {
  if (seed == null) return Math.random;
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function shuffle(arr, rng = Math.random) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pickRandom(arr, n, rng = Math.random) {
  return shuffle(arr, rng).slice(0, n);
}

export function initProgress(cards, progress = {}) {
  const fresh = { ...progress };
  for (const c of cards) {
    if (!fresh[c.id]) {
      fresh[c.id] = {
        mastery: MASTERY.NOT_STARTED,
        seen: 0,
        correctStreak: 0,
        wrongCount: 0,
        lastSeenRound: -1,
      };
    }
  }
  return fresh;
}

export function stats(cards, progress) {
  let notStarted = 0, learning = 0, mastered = 0;
  for (const c of cards) {
    const m = progress[c.id]?.mastery ?? 0;
    if (m === MASTERY.MASTERED) mastered++;
    else if (m === MASTERY.LEARNING) learning++;
    else notStarted++;
  }
  return { notStarted, learning, mastered, total: cards.length };
}

export function isComplete(cards, progress) {
  return cards.length > 0 && cards.every((c) => progress[c.id]?.mastery === MASTERY.MASTERED);
}

export function buildRound(cards, progress, roundNum, rng = Math.random) {
  const byMastery = { 0: [], 1: [], 2: [] };
  for (const c of cards) {
    const m = progress[c.id]?.mastery ?? 0;
    byMastery[m].push(c);
  }
  const notStartedShuf = shuffle(byMastery[0], rng);
  const learningShuf = shuffle(byMastery[1], rng);
  const masteredShuf = shuffle(byMastery[2], rng);

  const picked = [];
  const want = Math.min(ROUND_SIZE, cards.length);

  while (picked.length < want && (notStartedShuf.length || learningShuf.length)) {
    if (notStartedShuf.length && (picked.length % 2 === 0 || !learningShuf.length)) {
      picked.push(notStartedShuf.shift());
    } else if (learningShuf.length) {
      picked.push(learningShuf.shift());
    } else if (notStartedShuf.length) {
      picked.push(notStartedShuf.shift());
    }
  }

  const includeMastered = roundNum > 0 && roundNum % 3 === 0;
  if ((picked.length < want || includeMastered) && masteredShuf.length) {
    const room = want - picked.length;
    const reviewCount = includeMastered ? Math.min(2, masteredShuf.length, room + 2) : room;
    picked.push(...masteredShuf.slice(0, reviewCount));
  }

  return shuffle(picked, rng);
}

export function makeQuestion(card, allCards, progress, direction, rng = Math.random) {
  const mastery = progress[card.id]?.mastery ?? 0;
  const showDef = direction === 'def-to-term';
  const prompt = showDef ? card.definition : card.term;
  const answer = showDef ? card.term : card.definition;

  const useMC = mastery === MASTERY.NOT_STARTED;

  if (useMC) {
    const answerField = showDef ? 'term' : 'definition';
    const pool = allCards.filter((c) => c.id !== card.id).map((c) => c[answerField]);
    const uniquePool = Array.from(new Set(pool.filter((v) => v !== answer)));
    const distractors = pickRandom(uniquePool, 3, rng);
    while (distractors.length < 3) distractors.push('—');
    const choices = shuffle([answer, ...distractors], rng);
    const correctIndex = choices.indexOf(answer);
    return {
      type: 'mc',
      cardId: card.id,
      prompt,
      answer,
      choices,
      correctIndex,
      direction,
    };
  }

  return {
    type: 'typed',
    cardId: card.id,
    prompt,
    answer,
    direction,
  };
}

function normalize(s) {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .replace(/^(the|a|an)\s+/, '')
    .replace(/[.,;:!?()[\]{}"']/g, '')
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

export function gradeTyped(response, answer) {
  const a = normalize(response);
  const b = normalize(answer);
  if (!a) return { correct: false, close: false };
  if (a === b) return { correct: true, close: false };
  const tolerance = b.length >= 8 ? 2 : b.length >= 4 ? 1 : 0;
  const dist = levenshtein(a, b);
  if (dist <= tolerance) return { correct: true, close: true };
  return { correct: false, close: false };
}

export function applyResult(progress, cardId, correct, questionType, roundNum) {
  const next = { ...progress };
  const prev = next[cardId] || { mastery: 0, seen: 0, correctStreak: 0, wrongCount: 0, lastSeenRound: -1 };
  const state = { ...prev, seen: prev.seen + 1, lastSeenRound: roundNum };
  if (correct) {
    if (questionType === 'mc') {
      if (state.mastery < MASTERY.LEARNING) state.mastery = MASTERY.LEARNING;
      state.correctStreak = Math.max(state.correctStreak, 0);
    } else {
      state.correctStreak = prev.correctStreak + 1;
      if (state.correctStreak >= STREAK_TO_MASTER) state.mastery = MASTERY.MASTERED;
      else if (state.mastery < MASTERY.LEARNING) state.mastery = MASTERY.LEARNING;
    }
  } else {
    state.wrongCount = prev.wrongCount + 1;
    state.correctStreak = 0;
    state.mastery = MASTERY.LEARNING;
  }
  next[cardId] = state;
  return next;
}

export function requeueIndex(currentIdx, queueLength, rng = Math.random) {
  const minOffset = 2;
  const tail = queueLength - currentIdx - 1;
  if (tail <= minOffset) return queueLength;
  const span = tail - minOffset;
  const offset = minOffset + Math.floor(rng() * (span + 1));
  return currentIdx + offset;
}
