import "server-only";

import { unstable_cache } from "next/cache";
import { queryPlannerDb } from "@/lib/server/plannerDb";
import { redis } from "@/lib/redis";

export type GrowthSnapshot = {
  totalUsers: number;
  newThisWeek: number;
  paidUsers: number;
  activeToday: number;
  activeThisWeek: number;
  aiCallsToday: number;
};

function todayKey() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function weekKey() {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}W${String(week).padStart(2, "0")}`;
}

async function fetchDbMetrics(): Promise<Pick<GrowthSnapshot, "totalUsers" | "newThisWeek" | "paidUsers">> {
  const result = await queryPlannerDb<{
    total_users: string;
    new_this_week: string;
    paid_users: string;
  }>(
    `
      SELECT
        COUNT(*)::text                                                          AS total_users,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::text  AS new_this_week,
        COUNT(*) FILTER (WHERE plan_type != 'free' AND plan_status = 'active')::text AS paid_users
      FROM users
    `,
    []
  );

  const row = result.rows[0];
  return {
    totalUsers: parseInt(row?.total_users ?? "0", 10),
    newThisWeek: parseInt(row?.new_this_week ?? "0", 10),
    paidUsers: parseInt(row?.paid_users ?? "0", 10),
  };
}

async function fetchRedisMetrics(): Promise<Pick<GrowthSnapshot, "activeToday" | "activeThisWeek" | "aiCallsToday">> {
  if (!redis) return { activeToday: 0, activeThisWeek: 0, aiCallsToday: 0 };
  try {
    const [activeToday, activeWeek, aiToday] = await Promise.all([
      redis.get(`active:users:${todayKey()}`).then((v) => parseInt(v ?? "0", 10)),
      redis.get(`active:users:week:${weekKey()}`).then((v) => parseInt(v ?? "0", 10)),
      redis.get(`ai:calls:${todayKey()}`).then((v) => parseInt(v ?? "0", 10)),
    ]);
    return { activeToday, activeThisWeek: activeWeek, aiCallsToday: aiToday };
  } catch {
    return { activeToday: 0, activeThisWeek: 0, aiCallsToday: 0 };
  }
}

export const getGrowthSnapshot = unstable_cache(
  async (): Promise<GrowthSnapshot> => {
    const [db, rd] = await Promise.all([fetchDbMetrics(), fetchRedisMetrics()]);
    return { ...db, ...rd };
  },
  ["growth-snapshot"],
  { revalidate: 300 }
);

export async function recordActiveUser(userId: string) {
  if (!redis || !userId) return;
  try {
    const day = todayKey();
    const week = weekKey();
    await Promise.all([
      redis.incr(`active:users:${day}`).then(() => redis!.expire(`active:users:${day}`, 86400 * 2)),
      redis.incr(`active:users:week:${week}`).then(() => redis!.expire(`active:users:week:${week}`, 86400 * 9)),
    ]);
  } catch { /* best-effort */ }
}

export async function recordAiCall() {
  if (!redis) return;
  try {
    const day = todayKey();
    await redis.incr(`ai:calls:${day}`).then(() => redis!.expire(`ai:calls:${day}`, 86400 * 2));
  } catch { /* best-effort */ }
}
