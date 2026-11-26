export function daysUntilExam(dateStr: string, now: number = Date.now()): number {
  return Math.ceil((new Date(dateStr).getTime() - now) / (1000 * 60 * 60 * 24));
}
