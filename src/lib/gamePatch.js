export function usesUnifiedLifesteal(patchVersion) {
  const match = String(patchVersion || '').trim().match(/^(\d+)\.(\d+)/);
  if (!match) return false;

  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major > 7 || (major === 7 && minor >= 3);
}
