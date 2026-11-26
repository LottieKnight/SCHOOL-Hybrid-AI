export function calculateRequiredMark(currentMark: number, weightPercent: number, target: number): number {
  const w = weightPercent / 100;
  const required = (target - currentMark * w) / (1 - w);
  return Math.round(required * 10) / 10;
}
