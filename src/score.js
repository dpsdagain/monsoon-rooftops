import { CONFIG } from './constants.js';

// Forward speed never changes on a clean run, so two clears share a time.
// The line people post is distance, cells, and how many roof lips they cut.

export const SCORE = {
  DISTANCE_PER_M: 10,
  CELL: 2500,
  CLEAR_BONUS: 5000,
  STEADY_BASE: 120,
  RAZOR_BASE: 700,
  S_PLUS_RAZORS: 8,
};

export function createRun() {
  return { chain: 0, razors: 0, steadies: 0, landingPoints: 0 };
}

export function classifyMargin(margin) {
  return margin <= CONFIG.RAZOR_MARGIN ? 'razor' : 'steady';
}

export function applyLanding(run, kind) {
  const chain = run.chain + 1;
  const razor = kind === 'razor';
  return {
    chain,
    razors: run.razors + (razor ? 1 : 0),
    steadies: run.steadies + (razor ? 0 : 1),
    landingPoints: run.landingPoints + (razor ? SCORE.RAZOR_BASE : SCORE.STEADY_BASE) * chain,
  };
}

export function totalScore({ distance, cells, landingPoints, victory }) {
  const dist = Math.max(0, Math.min(Number(distance) || 0, CONFIG.FINISH_Z));
  const safeCells = Math.max(0, Math.min(CONFIG.TOTAL_CELLS, Number(cells) || 0));
  return Math.floor(dist) * SCORE.DISTANCE_PER_M
    + safeCells * SCORE.CELL
    + (Number(landingPoints) || 0)
    + (victory ? SCORE.CLEAR_BONUS : 0);
}

export function gradeRun({ victory, cells, razors }) {
  if (!victory) return { rank: 'D', title: 'DOWNED IN THE MONSOON' };
  if (cells >= CONFIG.TOTAL_CELLS && razors >= SCORE.S_PLUS_RAZORS) {
    return { rank: 'S+', title: 'RAZOR COURIER' };
  }
  if (cells >= CONFIG.TOTAL_CELLS) return { rank: 'S', title: 'OVERCHARGED COURIER' };
  if (cells >= 3) return { rank: 'A', title: 'VETERAN RUNNER' };
  return { rank: 'B', title: 'SURVIVOR' };
}

export function buildResult({ distance, timeSeconds, cells, totalCells, run, victory, rival, bestScore }) {
  const safeCells = Math.max(0, Math.min(totalCells || CONFIG.TOTAL_CELLS, Number(cells) || 0));
  const razors = run ? run.razors : 0;
  const grade = gradeRun({ victory: !!victory, cells: safeCells, razors });
  const score = totalScore({
    distance,
    cells: safeCells,
    landingPoints: run ? run.landingPoints : 0,
    victory: !!victory,
  });
  const rivalScore = rival ? rival.score : null;
  return {
    distance: Math.max(0, Math.min(Number(distance) || 0, CONFIG.FINISH_Z)),
    timeSeconds: timeSeconds || 0,
    cells: safeCells,
    totalCells: totalCells || CONFIG.TOTAL_CELLS,
    razors,
    chain: run ? run.chain : 0,
    victory: !!victory,
    score,
    rank: grade.rank,
    title: grade.title,
    rival: rival || null,
    rivalBeaten: rivalScore != null && score > rivalScore,
    isNewBest: bestScore == null || score > bestScore,
  };
}

export function formatScore(n) {
  const value = Math.max(0, Math.floor(Number(n) || 0));
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function encodeLine(result) {
  const rank = result.rank === 'S+' ? 'SP' : result.rank;
  const cells = Math.max(0, Math.min(CONFIG.TOTAL_CELLS, result.cells || 0));
  const razors = Math.max(0, Math.min(30, result.razors || 0));
  return `${Math.floor(result.score)}.${cells}.${razors}.${rank}`;
}

export function parseLine(param) {
  if (typeof param !== 'string') return null;
  const match = param.trim().match(/^(\d{1,9})\.([0-5])\.(\d{1,2})\.(SP|S|A|B|D)$/);
  if (!match) return null;
  const razors = Number(match[3]);
  if (razors > 30) return null;
  return {
    score: Number(match[1]),
    cells: Number(match[2]),
    razors,
    rank: match[4] === 'SP' ? 'S+' : match[4],
  };
}

export function readChallenge(search) {
  if (!search) return null;
  const query = search.charAt(0) === '?' ? search.slice(1) : search;
  return parseLine(new URLSearchParams(query).get('line'));
}

export function describeLine(line) {
  if (!line) return '';
  const rank = line.rank === 'D' ? 'A FALL' : `RANK ${line.rank}`;
  return `${formatScore(line.score)} · ${rank} · ${line.cells}/5 · ${line.razors} RAZORS`;
}

export function describeBest(best) {
  if (!best) return 'NO LINE YET · land in the gold lip to set one';
  const rank = best.rank === 'D' ? 'A FALL' : `RANK ${best.rank}`;
  return `YOUR BEST · ${formatScore(best.score)} · ${rank} · ${best.razors} RAZORS`;
}

export function resultNote(result) {
  const bits = [];
  if (result.isNewBest) bits.push('NEW BEST');
  if (result.rival && result.rivalBeaten) bits.push('LINE TAKEN');
  else if (result.rival && result.score === result.rival.score) bits.push('TIED THE LINE');
  else if (result.rival) bits.push(`SHORT BY ${formatScore(result.rival.score - result.score)}`);
  return bits.join(' · ');
}

export function buildShareText(result) {
  const where = result.victory
    ? 'Cleared Helipad 01'
    : `Downed at ${Math.floor(result.distance)}m`;
  const rankBit = result.victory ? `RANK ${result.rank}` : 'DOWNED';
  const razorWord = result.razors === 1 ? 'razor landing' : 'razor landings';
  const lines = [
    `${where} · ${formatScore(result.score)} · ${rankBit}`,
    `${result.cells}/5 cells · ${result.razors} ${razorWord}`,
  ];
  if (result.rival && result.rivalBeaten) {
    lines.push(`Took the line over ${formatScore(result.rival.score)}`);
  } else if (result.rival && result.score === result.rival.score) {
    lines.push(`Tied the line at ${formatScore(result.rival.score)}`);
  } else if (result.rival) {
    lines.push(`Short of ${formatScore(result.rival.score)}`);
  }
  lines.push('Monsoon Rooftops · Neo-Mumbai 2088');
  lines.push('');
  lines.push('Beat this line');
  return lines.join('\n');
}
