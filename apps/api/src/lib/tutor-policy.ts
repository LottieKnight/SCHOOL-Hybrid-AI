import { config } from "../config.js";

export type PolicyOutcome = {
  status:
    | "cancelled_by_learner"
    | "cancelled_by_tutor"
    | "no_show_learner"
    | "no_show_tutor"
    | "completed"
    | "resolved";
  payoutEligibleAmount: number;
  refundAmount: number;
  platformFeeAmount: number;
  tutorPayoutAmount: number;
  commissionAmount: number;
};

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function commission(amount: number) {
  return roundMoney(amount * config.commissionRate);
}

export function calculateLearnerCancel(price: number, hoursBefore: number) {
  if (hoursBefore >= config.cancellationWindowHours) {
    const payoutEligibleAmount = 0;
    const refundAmount = price;
    return {
      status: "cancelled_by_learner",
      payoutEligibleAmount,
      refundAmount,
      platformFeeAmount: 0,
      tutorPayoutAmount: 0,
      commissionAmount: 0,
    } satisfies PolicyOutcome;
  }

  const paidPortion = price * config.cancellationFeePercent;
  const refundAmount = price - paidPortion;
  const commissionAmount = commission(paidPortion);
  const tutorPayoutAmount = roundMoney(paidPortion - commissionAmount);
  return {
    status: "cancelled_by_learner",
    payoutEligibleAmount: roundMoney(paidPortion),
    refundAmount: roundMoney(refundAmount),
    platformFeeAmount: commissionAmount,
    tutorPayoutAmount,
    commissionAmount,
  } satisfies PolicyOutcome;
}

export function calculateTutorCancel(price: number, _hoursBefore: number) {
  const refundAmount = price;
  return {
    status: "cancelled_by_tutor",
    payoutEligibleAmount: 0,
    refundAmount: roundMoney(refundAmount),
    platformFeeAmount: 0,
    tutorPayoutAmount: 0,
    commissionAmount: 0,
  } satisfies PolicyOutcome;
}

export function calculateNoShowLearner(price: number) {
  const paidPortion = price * config.noShowPayoutPercent;
  const refundAmount = price - paidPortion;
  const commissionAmount = commission(paidPortion);
  const tutorPayoutAmount = roundMoney(paidPortion - commissionAmount);
  return {
    status: "no_show_learner",
    payoutEligibleAmount: roundMoney(paidPortion),
    refundAmount: roundMoney(refundAmount),
    platformFeeAmount: commissionAmount,
    tutorPayoutAmount,
    commissionAmount,
  } satisfies PolicyOutcome;
}

export function calculateNoShowTutor(price: number) {
  return {
    status: "no_show_tutor",
    payoutEligibleAmount: 0,
    refundAmount: roundMoney(price),
    platformFeeAmount: 0,
    tutorPayoutAmount: 0,
    commissionAmount: 0,
  } satisfies PolicyOutcome;
}

export function calculateCompletion(price: number) {
  const commissionAmount = commission(price);
  const tutorPayoutAmount = roundMoney(price - commissionAmount);
  return {
    status: "completed",
    payoutEligibleAmount: roundMoney(price),
    refundAmount: 0,
    platformFeeAmount: commissionAmount,
    tutorPayoutAmount,
    commissionAmount,
  } satisfies PolicyOutcome;
}

export function calculateResolution(price: number, refundAmount: number) {
  const payoutEligible = Math.max(0, price - refundAmount);
  const commissionAmount = commission(payoutEligible);
  const tutorPayoutAmount = roundMoney(payoutEligible - commissionAmount);
  return {
    status: "resolved",
    payoutEligibleAmount: roundMoney(payoutEligible),
    refundAmount: roundMoney(refundAmount),
    platformFeeAmount: commissionAmount,
    tutorPayoutAmount,
    commissionAmount,
  } satisfies PolicyOutcome;
}

export function isDisputeWindowOpen(completedAt: Date, now = new Date()) {
  const diffHours = (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60);
  return diffHours <= config.disputeWindowHours;
}

export function isNoShowWindowOpen(scheduledStartAt: Date, now = new Date()) {
  const graceMs = config.noShowGraceMinutes * 60 * 1000;
  return now.getTime() >= scheduledStartAt.getTime() + graceMs;
}
