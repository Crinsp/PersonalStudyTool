const FALLBACK_SEPARATORS = [
  { re: /\s+[—–]\s+/, label: 'em/en dash' },
  { re: /\s+-\s+/, label: 'hyphen' },
  { re: /\s*:\s+/, label: 'colon' },
];

function stripBullet(line) {
  return line.replace(/^\s*(?:[-*+•]|\d+[.)])\s+/, '');
}

function stripMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function splitLine(raw) {
  const line = stripBullet(raw);
  const tabIdx = line.indexOf('\t');
  if (tabIdx >= 0) {
    return [line.slice(0, tabIdx), line.slice(tabIdx + 1)];
  }
  for (const { re } of FALLBACK_SEPARATORS) {
    const match = re.exec(line);
    if (match) {
      return [line.slice(0, match.index), line.slice(match.index + match[0].length)];
    }
  }
  return null;
}

export function parseInput(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const cards = [];
  const errors = [];
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const split = splitLine(line);
    if (!split) {
      errors.push({ line: i + 1, text: line, reason: 'No separator found (expected tab, " - ", " — ", or ": ")' });
      return;
    }
    const term = stripMarkdown(split[0]).trim();
    const definition = stripMarkdown(split[1]).trim();
    if (!term || !definition) {
      errors.push({ line: i + 1, text: line, reason: 'Term or definition empty' });
      return;
    }
    cards.push({ term, definition });
  });
  return { cards, errors };
}
