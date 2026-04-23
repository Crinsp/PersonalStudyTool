export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, '');
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  const list = Array.isArray(children) ? children : [children];
  for (const c of list) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function renderProgressBar(container, stats) {
  clear(container);
  const total = Math.max(1, stats.total);
  const seg = (cls, count, label) => {
    const pct = (count / total) * 100;
    return el('div', {
      class: `seg seg-${cls}`,
      style: { width: pct + '%' },
      title: `${label}: ${count}`,
    }, count > 0 ? [el('span', { class: 'seg-count' }, String(count))] : []);
  };
  container.appendChild(el('div', { class: 'progress-bar' }, [
    seg('not-started', stats.notStarted, 'Not started'),
    seg('learning', stats.learning, 'Learning'),
    seg('mastered', stats.mastered, 'Mastered'),
  ]));
  container.appendChild(el('div', { class: 'progress-legend' }, [
    el('span', { class: 'dot dot-not-started' }),
    el('span', {}, `${stats.notStarted} not started`),
    el('span', { class: 'dot dot-learning' }),
    el('span', {}, `${stats.learning} learning`),
    el('span', { class: 'dot dot-mastered' }),
    el('span', {}, `${stats.mastered} mastered`),
  ]));
}

export function renderMC(container, question, onAnswer, onDontKnow) {
  clear(container);
  const card = el('div', { class: 'qcard' }, [
    el('div', { class: 'qlabel' }, question.direction === 'def-to-term' ? 'Definition' : 'Term'),
    el('div', { class: 'qprompt' }, question.prompt),
    el('div', { class: 'qlabel qlabel-answer' }, 'Choose matching ' + (question.direction === 'def-to-term' ? 'term' : 'definition')),
    el('div', { class: 'choices' }, question.choices.map((choice, i) =>
      el('button', {
        class: 'choice',
        'data-idx': i,
        onclick: () => onAnswer(i),
      }, choice)
    )),
    el('div', { class: 'qfooter' }, [
      el('button', { class: 'link-btn', onclick: onDontKnow }, "Don't know"),
    ]),
  ]);
  container.appendChild(card);
}

export function renderTyped(container, question, onAnswer, onDontKnow) {
  clear(container);
  const input = el('input', {
    type: 'text',
    class: 'typed-input',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    placeholder: 'Type your answer…',
  });
  const submit = () => {
    const val = input.value;
    if (!val.trim()) return;
    onAnswer(val);
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });
  const card = el('div', { class: 'qcard' }, [
    el('div', { class: 'qlabel' }, question.direction === 'def-to-term' ? 'Definition' : 'Term'),
    el('div', { class: 'qprompt' }, question.prompt),
    el('div', { class: 'qlabel qlabel-answer' }, 'Type the ' + (question.direction === 'def-to-term' ? 'term' : 'definition')),
    input,
    el('div', { class: 'qfooter' }, [
      el('button', { class: 'primary-btn', onclick: submit }, 'Answer'),
      el('button', { class: 'link-btn', onclick: onDontKnow }, "Don't know"),
    ]),
  ]);
  container.appendChild(card);
  setTimeout(() => input.focus(), 0);
}

export function renderFeedback(container, { correct, close, question, userAnswer, onContinue, onOverride }) {
  clear(container);
  const cls = correct ? 'fb-correct' : 'fb-wrong';
  const head = correct ? (close ? 'Close enough — correct' : 'Correct') : "Don't worry, you'll see it again";
  const children = [
    el('div', { class: 'fb-head' }, head),
    el('div', { class: 'fb-row' }, [
      el('div', { class: 'fb-label' }, question.direction === 'def-to-term' ? 'Definition' : 'Term'),
      el('div', { class: 'fb-value' }, question.prompt),
    ]),
    el('div', { class: 'fb-row' }, [
      el('div', { class: 'fb-label' }, 'Answer'),
      el('div', { class: 'fb-value fb-answer' }, question.answer),
    ]),
  ];
  if (userAnswer != null && userAnswer !== question.answer) {
    children.push(el('div', { class: 'fb-row' }, [
      el('div', { class: 'fb-label' }, 'You said'),
      el('div', { class: 'fb-value' }, userAnswer || '(nothing)'),
    ]));
  }
  const actions = [el('button', { class: 'primary-btn', onclick: onContinue }, 'Continue')];
  if (!correct && onOverride) {
    actions.push(el('button', { class: 'link-btn', onclick: onOverride }, 'Override: I was right'));
  }
  children.push(el('div', { class: 'qfooter' }, actions));
  container.appendChild(el('div', { class: `qcard feedback ${cls}` }, children));

  const continueBtn = container.querySelector('.primary-btn');
  if (continueBtn) setTimeout(() => continueBtn.focus(), 0);
}

export function renderRoundSummary(container, { roundNum, masteredThisRound, learnedThisRound, stats, onContinue }) {
  clear(container);
  container.appendChild(el('div', { class: 'qcard summary' }, [
    el('div', { class: 'summary-head' }, `Round ${roundNum} complete`),
    el('div', { class: 'summary-stats' }, [
      el('div', {}, [el('strong', {}, String(masteredThisRound)), ' mastered this round']),
      el('div', {}, [el('strong', {}, String(learnedThisRound)), ' moved to learning']),
      el('div', {}, [el('strong', {}, String(stats.mastered)), ' / ', String(stats.total), ' mastered overall']),
    ]),
    el('div', { class: 'qfooter' }, [
      el('button', { class: 'primary-btn', onclick: onContinue }, 'Keep going'),
    ]),
  ]));
  const btn = container.querySelector('.primary-btn');
  if (btn) setTimeout(() => btn.focus(), 0);
}

export function renderComplete(container, { stats, onReset, onHome }) {
  clear(container);
  container.appendChild(el('div', { class: 'qcard complete' }, [
    el('div', { class: 'complete-head' }, "You've mastered this set!"),
    el('div', { class: 'complete-sub' }, `${stats.mastered} of ${stats.total} terms mastered.`),
    el('div', { class: 'qfooter' }, [
      el('button', { class: 'primary-btn', onclick: onHome }, 'Back to library'),
      el('button', { class: 'link-btn', onclick: onReset }, 'Reset progress & study again'),
    ]),
  ]));
}
