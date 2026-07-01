const PATCH_PATTERN = /^(\d+)(?:\.(\d+))?([a-z])?$/i;

export function parsePatch(value) {
  const raw = String(value || '')
    .trim()
    .replace(/^(?:parche|patch)\s*/i, '')
    .replace(/^v\s*/i, '');
  const match = raw.match(PATCH_PATTERN);

  if (!match) return null;

  const major = Number(match[1]);
  const minor = match[2] === undefined ? null : Number(match[2]);
  const letter = (match[3] || '').toLowerCase();

  return {
    major,
    minor,
    letter,
    normalized: `${major}${minor === null ? '' : `.${minor}`}${letter}`,
  };
}

export function patchMatchesSelection(patch, selection) {
  if (!selection) return true;

  const candidate = parsePatch(patch);
  const selected = parsePatch(selection);

  if (!candidate || !selected) {
    return String(patch || '').trim().toLowerCase() === String(selection).trim().toLowerCase();
  }

  if (candidate.major !== selected.major) return false;
  if (selected.minor === null) return true;
  if (candidate.minor !== selected.minor) return false;
  if (!selected.letter) return true;

  return candidate.letter === selected.letter;
}

export function buildPatchOptions(values) {
  const options = new Map();

  values.forEach(value => {
    const parsed = parsePatch(value);

    if (!parsed) {
      const raw = String(value || '').trim();
      if (raw) options.set(`raw:${raw.toLowerCase()}`, { value: raw, label: raw, depth: 0, raw: true });
      return;
    }

    const majorValue = String(parsed.major);
    options.set(`version:${majorValue}`, {
      value: majorValue,
      label: majorValue,
      depth: 0,
      version: { major: parsed.major, minor: null, letter: '' },
    });

    if (parsed.minor === null) return;

    const minorValue = `${parsed.major}.${parsed.minor}`;
    options.set(`version:${minorValue}`, {
      value: minorValue,
      label: minorValue,
      depth: 1,
      version: { major: parsed.major, minor: parsed.minor, letter: '' },
    });

  });

  return [...options.values()].sort((a, b) => {
    if (a.raw || b.raw) {
      if (a.raw && b.raw) return a.label.localeCompare(b.label, undefined, { numeric: true });
      return a.raw ? 1 : -1;
    }

    return b.version.major - a.version.major
      || (a.version.minor === null ? -1 : b.version.minor === null ? 1 : b.version.minor - a.version.minor)
      || a.depth - b.depth
      || b.version.letter.localeCompare(a.version.letter);
  });
}

export function filterByPatch(records, selection) {
  return selection
    ? records.filter(record => patchMatchesSelection(record?.patch, selection))
    : records;
}
