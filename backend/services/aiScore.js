export function calculateAiScore(gift) {
  const floorTon = Number(gift.floorTon) || 0;
  const floorGapPercent =
    floorTon > 0 ? ((floorTon - gift.priceTon) / floorTon) * 100 : 0;

  const rarityScore = Math.min(gift.rarity, 100);
  const undervaluedScore = Math.max(Math.min(floorGapPercent * 2, 100), 0);
  const salesScore = Math.min(gift.sales24h * 5, 100);
  const growthScore = Math.max(Math.min(gift.volumeGrowth + 50, 100), 0);

  const score =
    rarityScore * 0.35 +
    undervaluedScore * 0.3 +
    salesScore * 0.2 +
    growthScore * 0.15;

  let signal = "Neutral";
  if (score >= 80) signal = "Strong Buy";
  else if (score >= 65) signal = "Watch";
  else if (score < 45) signal = "Risky";

  return {
    aiScore: Math.round(score),
    undervaluedPercent: Math.round(floorGapPercent),
    signal,
    explanation: generateExplanation(gift, Math.round(score), Math.round(floorGapPercent)),
  };
}

function generateExplanation(gift, score, gap) {
  if (score >= 80) {
    return `Quanton desk — ${gift.name} reads ~${gap}% rich to the reference floor; rarity and tape prints look supportive.`;
  }

  if (score >= 65) {
    return `Quanton desk — ${gift.name} is watch-list quality; verify liquidity and 24h prints before you size.`;
  }

  return `Quanton desk — ${gift.name} reads soft; reward/risk skew is not in your favor on this tape.`;
}
