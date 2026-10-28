import { baseMessages, lookup, tr } from '../i18n/uiI18n.js';

// Las ramas se guardan en español (Dominación, Precisión...): solo se traduce lo que se muestra.
export const runeBranchLabel = branch =>
  (branch && lookup(baseMessages, `runeBranches.${branch}`) ? tr(`runeBranches.${branch}`) : branch);
