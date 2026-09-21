export function isPatchAtLeast(patchVersion, targetMajor, targetMinor) {
  const match = String(patchVersion || '').trim().match(/^(\d+)\.(\d+)/);
  if (!match) return false;

  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major > targetMajor || (major === targetMajor && minor >= targetMinor);
}

export function usesUnifiedLifesteal(patchVersion) {
  return isPatchAtLeast(patchVersion, 7, 3);
}
