const STORAGE_KEY = 'monsoon-rooftops-best-v1';

export function loadBest() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.score !== 'number' || !Number.isFinite(data.score)) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function saveBest(result) {
  const snapshot = {
    score: result.score,
    cells: result.cells,
    razors: result.razors,
    distance: result.distance,
    victory: result.victory,
    rank: result.rank,
    title: result.title,
  };
  try {
    if (typeof localStorage === 'undefined') return { best: snapshot, isNew: false };
    const prev = loadBest();
    if (prev && prev.score >= snapshot.score) return { best: prev, isNew: false };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    return { best: snapshot, isNew: true };
  } catch (e) {
    return { best: snapshot, isNew: false };
  }
}
