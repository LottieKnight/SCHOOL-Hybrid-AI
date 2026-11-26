import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateLearnerCancel,
  calculateNoShowLearner,
  calculateNoShowTutor,
  calculateResolution,
  calculateTutorCancel,
  isDisputeWindowOpen,
} from "../src/lib/tutor-policy.js";

test("learner cancellation >= window gives full refund", () => {
  const outcome = calculateLearnerCancel(500, 7);
  assert.equal(outcome.refundAmount, 500);
  assert.equal(outcome.payoutEligibleAmount, 0);
});

test("learner cancellation < window pays 30% to tutor", () => {
  const outcome = calculateLearnerCancel(1000, 2);
  assert.equal(outcome.payoutEligibleAmount, 300);
  assert.equal(outcome.refundAmount, 700);
});

test("tutor cancellation always refunds learner", () => {
  const outcome = calculateTutorCancel(800, 1);
  assert.equal(outcome.refundAmount, 800);
  assert.equal(outcome.payoutEligibleAmount, 0);
});

test("no-show learner pays 50% to tutor", () => {
  const outcome = calculateNoShowLearner(1000);
  assert.equal(outcome.payoutEligibleAmount, 500);
  assert.equal(outcome.refundAmount, 500);
});

test("no-show tutor refunds full amount", () => {
  const outcome = calculateNoShowTutor(1000);
  assert.equal(outcome.refundAmount, 1000);
  assert.equal(outcome.payoutEligibleAmount, 0);
});

test("dispute window enforcement", () => {
  const now = new Date();
  const within = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const outside = new Date(now.getTime() - 72 * 60 * 60 * 1000);
  assert.equal(isDisputeWindowOpen(within, now), true);
  assert.equal(isDisputeWindowOpen(outside, now), false);
});

test("resolution math returns payout and refund", () => {
  const outcome = calculateResolution(1000, 250);
  assert.equal(outcome.refundAmount, 250);
  assert.equal(outcome.payoutEligibleAmount, 750);
});
