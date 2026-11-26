import { UserRecord } from "../db/users.js";

export type AccessStatus = {
  hasAccess: boolean;
  status: "trial" | "active" | "expired" | "canceled";
  reason?: string;
  daysLeft?: number;
  trialEndsAt: string | null;
  planType: string;
  planStatus: string;
  planExpiresAt: string | null;
};

export function getAccessStatus(user: UserRecord): AccessStatus {
  const now = new Date();
  const trialEndsAt = user.trial_ends_at ? new Date(user.trial_ends_at) : null;
  const planExpiresAt = user.plan_expires_at ? new Date(user.plan_expires_at) : null;

  if (user.plan_status === "active") {
    if (!planExpiresAt || planExpiresAt > now) {
      return {
        hasAccess: true,
        status: "active",
        daysLeft: planExpiresAt ? Math.ceil((planExpiresAt.getTime() - now.getTime()) / 86400000) : undefined,
        trialEndsAt: user.trial_ends_at,
        planType: user.plan_type,
        planStatus: user.plan_status,
        planExpiresAt: user.plan_expires_at,
      };
    }
    return {
      hasAccess: false,
      status: "expired",
      reason: "Plan expired.",
      trialEndsAt: user.trial_ends_at,
      planType: user.plan_type,
      planStatus: "expired",
      planExpiresAt: user.plan_expires_at,
    };
  }

  if (user.plan_status === "trialing") {
    if (trialEndsAt && trialEndsAt > now) {
      return {
        hasAccess: true,
        status: "trial",
        daysLeft: Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86400000),
        trialEndsAt: user.trial_ends_at,
        planType: user.plan_type,
        planStatus: user.plan_status,
        planExpiresAt: user.plan_expires_at,
      };
    }
    return {
      hasAccess: false,
      status: "expired",
      reason: "Trial ended.",
      trialEndsAt: user.trial_ends_at,
      planType: user.plan_type,
      planStatus: "expired",
      planExpiresAt: user.plan_expires_at,
    };
  }

  if (user.plan_status === "canceled") {
    return {
      hasAccess: false,
      status: "canceled",
      reason: "Plan canceled.",
      trialEndsAt: user.trial_ends_at,
      planType: user.plan_type,
      planStatus: user.plan_status,
      planExpiresAt: user.plan_expires_at,
    };
  }

  return {
    hasAccess: false,
    status: "expired",
    reason: "Access expired.",
    trialEndsAt: user.trial_ends_at,
    planType: user.plan_type,
    planStatus: user.plan_status,
    planExpiresAt: user.plan_expires_at,
  };
}
