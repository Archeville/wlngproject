// Cost to advance from the displayed level to the next one.
export function levelCost(level) {
  if (level >= 31) return 10500 + (level - 31) * 100;
  if (level === 30) return 10343;
  return Math.round(100 * 1.175 ** (Math.max(1, level) - 1));
}
export function levelProgress(totalXp) {
  let xp = Math.max(0, Number.isFinite(totalXp) ? totalXp : 0), level = 1;
  while (level < 31 && xp >= levelCost(level)) { xp -= levelCost(level); level++; }
  if (level === 31) {
    // Sum of n requirements: n * 10500 + 50*n*(n-1).
    const n = Math.floor((-10450 + Math.sqrt(10450 ** 2 + 200 * xp)) / 100);
    xp -= n * 10500 + 50 * n * (n - 1); level += n;
  }
  return { level, intoLevel: xp, required: levelCost(level) };
}
