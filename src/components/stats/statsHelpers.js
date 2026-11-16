// Cálculos y tonos de la página de Estadísticas (sin React).
import { parsePatch } from '@/utils/patches';
import { matchKda, winratePct } from '@/domain/matchStats';
import { tr } from '@/i18n/uiI18n';

export function calcWR(matches) {
  const wins = matches.filter(m => m.result === 'win').length;
  return winratePct(wins, matches.length);
}

export function calcMatchKDA(match) {
  return matchKda(Number(match.kills || 0), Number(match.deaths || 0), Number(match.assists || 0));
}

export function getKdaTone(avgKDA) {
  const kda = Number(avgKDA);

  if (!Number.isFinite(kda)) return 'text-cyan-400';
  if (kda < 2.5) return 'text-red-400';
  if (kda < 3) return 'text-yellow-400';
  if (kda < 3.5) return 'text-green-400';

  return 'text-blue-400';
}

export function getWrTone(wr) {
  const value = Number(wr);

  if (!Number.isFinite(value)) return 'text-muted-foreground';
  return value < 50 ? 'text-red-400' : 'text-green-400';
}

export const insightTone = {
  positive: 'border-green-500/25 bg-green-500/[0.04]',
  opportunity: 'border-cyan-500/25 bg-cyan-500/[0.04]',
  warning: 'border-yellow-500/25 bg-yellow-500/[0.04]',
  critical: 'border-red-500/25 bg-red-500/[0.04]',
  neutral: 'border-border/70 bg-background/25',
};

export const insightAccent = {
  positive: 'bg-green-400', opportunity: 'bg-cyan-400', warning: 'bg-yellow-400',
  critical: 'bg-red-400', neutral: 'bg-primary/60',
};

export const COACH_BOOK_URL = 'https://media.base44.com/images/public/6a04ac70fd92bb3979b654a9/83cce9c3d_ChatGPTImage19may202611_43_41pm.png';

export function getPatchFilterValue(value) {
  const parsed = parsePatch(value);

  if (!parsed) return String(value || '').trim();
  if (parsed.minor === null) return String(parsed.major);

  return `${parsed.major}.${parsed.minor}`;
}

export function getPoolGrade(score) {
  if (score >= 90) return 'S+';
  if (score >= 80) return 'S';
  if (score >= 70) return 'A';
  if (score >= 60) return 'B';
  if (score >= 45) return 'C';
  return 'D';
}

export function getPoolTone(score) {
  if (score >= 80) return 'text-purple-400';
  if (score >= 70) return 'text-blue-400';
  if (score >= 60) return 'text-green-400';
  if (score >= 45) return 'text-yellow-400';
  return 'text-red-400';
}

export function calculatePoolScore(champArr, totalMatches) {
  if (!totalMatches || champArr.length === 0) {
    return {
      score: 0,
      grade: '—',
      label: tr('dashboard.sinDatos'),
      tone: 'text-muted-foreground',
    };
  }

  const champsWithSample = champArr.filter(c => c.games >= 3);
  const reliableChamps = champsWithSample.length;

  const weightedWR =
    champArr.reduce((sum, c) => sum + (c.wr * c.games), 0) / totalMatches;

  const wrScore = Math.min(100, Math.max(0, weightedWR));

  const varietyScore = Math.min(100, (reliableChamps / 5) * 100);

  const volumeScore = Math.min(100, (totalMatches / 40) * 100);

  const score = Math.round(
    wrScore * 0.5 +
    varietyScore * 0.25 +
    volumeScore * 0.25
  );

  if (totalMatches < 10) {
    return {
      score,
      grade: tr('stats.inicial'),
      label: tr('stats.provisional', { totalMatches, value: tr(totalMatches === 1 ? 'stats.partidaOne' : 'goals.unit.partidas') }),
      tone: 'text-yellow-400',
    };
  }

  return {
    score,
    grade: getPoolGrade(score),
    label: `${score}/100`,
    tone: getPoolTone(score),
  };
}

export function getSampleStatus(total) {
  if (total === 1) return { label: tr('stats.datoInicial'), tone: 'text-yellow-300 border-yellow-500/25 bg-yellow-500/10' };
  if (total < 3) return { label: tr('stats.muestraBaja'), tone: 'text-yellow-300 border-yellow-500/25 bg-yellow-500/10' };
  if (total < 6) return { label: tr('stats.tendencia'), tone: 'text-cyan-300 border-cyan-500/25 bg-cyan-500/10' };
  return { label: tr('stats.mayorRespaldo'), tone: 'text-green-300 border-green-500/25 bg-green-500/10' };
}
