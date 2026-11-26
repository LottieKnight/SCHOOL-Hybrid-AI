import { config } from "../config.js";
import { claimDueAssignmentReminders, storeAssignmentReminderNotifications } from "../db/messages.js";
import { publishEvent } from "./messageBus.js";

type LoggerLike = {
  info: (input: Record<string, unknown>, msg?: string) => void;
  error: (input: Record<string, unknown>, msg?: string) => void;
};

export type AssignmentReminderSchedulerHandle = {
  stop: () => void;
  runNow: () => Promise<void>;
};

export function startAssignmentReminderScheduler(logger: LoggerLike): AssignmentReminderSchedulerHandle {
  if (config.env === "test") {
    return {
      stop: () => undefined,
      runNow: async () => undefined,
    };
  }

  const intervalMs = config.assignmentReminderPollSeconds * 1000;
  const batchSize = config.assignmentReminderBatchSize;
  let isRunning = false;
  let isStopped = false;

  const runSweep = async () => {
    if (isStopped || isRunning) return;
    isRunning = true;
    try {
      const reminders = await claimDueAssignmentReminders({ limit: batchSize });
      if (!reminders.length) return;
      await storeAssignmentReminderNotifications(reminders);

      await Promise.all(
        reminders.map((reminder) =>
          publishEvent({
            event: "assignment_reminder",
            conversationId: reminder.conversation_id,
            participants: [reminder.user_id],
            userId: reminder.user_id,
            conversationName: reminder.conversation_name,
            assignmentTitle: reminder.assignment_title,
            assignmentDueAt: reminder.assignment_due_at,
            reminderKind: reminder.reminder_kind,
          })
        )
      );

      logger.info(
        {
          dispatchedCount: reminders.length,
          batchSize,
          intervalSeconds: config.assignmentReminderPollSeconds,
        },
        "Dispatched assignment reminders."
      );
    } catch (error) {
      const err =
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : {
              message: String(error),
            };

      logger.error(
        {
          err,
          batchSize,
          intervalSeconds: config.assignmentReminderPollSeconds,
        },
        "Assignment reminder sweep failed."
      );
    } finally {
      isRunning = false;
    }
  };

  const timer = setInterval(() => {
    void runSweep();
  }, intervalMs);
  timer.unref();

  void runSweep();

  return {
    stop: () => {
      isStopped = true;
      clearInterval(timer);
    },
    runNow: async () => {
      await runSweep();
    },
  };
}
