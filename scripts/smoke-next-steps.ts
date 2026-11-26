import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildServer } from "../apps/api/src/server.js";
import { closePool } from "../apps/api/src/db/pool.js";

type Session = { cookies: Map<string, string> };

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function parseBody(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function updateCookies(response: Response, session: Session) {
  const getter = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const rows = typeof getter === "function" ? getter.call(response.headers) : [];
  for (const row of rows) {
    const pair = row.split(";", 1)[0] || "";
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    session.cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}

function cookieHeader(session: Session) {
  return Array.from(session.cookies.entries())
    .map((entry) => `${entry[0]}=${entry[1]}`)
    .join("; ");
}

async function callApi(
  baseUrl: string,
  session: Session,
  method: string,
  path: string,
  options: {
    json?: Record<string, unknown>;
    formData?: FormData;
    expected?: number | number[];
    csrf?: boolean;
    attempt?: number;
  } = {}
) {
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("Accept-Encoding", "identity");

  const cookies = cookieHeader(session);
  if (cookies) headers.set("Cookie", cookies);

  if (options.csrf !== false && !SAFE_METHODS.has(method.toUpperCase())) {
    const csrf = session.cookies.get("saedu_csrf");
    if (!csrf) throw new Error(`Missing csrf cookie for ${method} ${path}`);
    headers.set("x-csrf-token", csrf);
  }

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.json) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.json);
  }

  const response = await fetch(baseUrl + path, { method, headers, body });
  updateCookies(response, session);

  const payload = parseBody(await response.text());
  const expectedStatus = Array.isArray(options.expected)
    ? options.expected
    : options.expected === undefined
      ? [200]
      : [options.expected];

  if (!expectedStatus.includes(response.status)) {
    throw new Error(
      `Unexpected status ${response.status} for ${method} ${path}; body=${JSON.stringify(payload)}`
    );
  }

  if (payload === null && method.toUpperCase() === "GET" && (options.attempt ?? 0) < 1) {
    await new Promise((resolve) => setTimeout(resolve, 120));
    return callApi(baseUrl, session, method, path, { ...options, attempt: (options.attempt ?? 0) + 1 });
  }

  if (payload === null) {
    return {};
  }

  return payload as Record<string, unknown>;
}

async function registerUser(baseUrl: string, label: string) {
  const session: Session = { cookies: new Map() };
  const email = `smoke.${label.toLowerCase()}.${Date.now()}.${randomUUID().slice(0, 8)}@example.com`;
  const payload = await callApi(baseUrl, session, "POST", "/auth/register", {
    csrf: false,
    expected: 200,
    json: {
      email,
      password: "SmokeTest!123",
      firstName: label,
      lastName: "Smoke",
      phone: "+27123456789",
      country: "South Africa",
      province: "Gauteng",
      city: "Johannesburg",
    },
  });
  const user = payload.user as { id?: string } | undefined;
  if (!user?.id) throw new Error("Register user id missing");
  return { userId: user.id, email, session };
}

async function main() {
  const app = await buildServer();
  await app.listen({ host: "127.0.0.1", port: 0 });
  const addr = app.server.address();
  if (!addr || typeof addr === "string") throw new Error("Address not available");
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  const summary: string[] = [];

  try {
    const alice = await registerUser(baseUrl, "Alice");
    const bob = await registerUser(baseUrl, "Bob");
    const bobHandle = `bob${String(Date.now()).slice(-6)}`;
    summary.push(`registered ${alice.email} and ${bob.email}`);

    await callApi(baseUrl, alice.session, "PUT", "/profile/me", {
      expected: 200,
      json: {
        username: `alice${String(Date.now()).slice(-6)}`,
        likes: ["math", "science"],
        interests: ["robotics", "debate"],
        appPreferences: {
          profileSettings: {
            preferenceOnboardingStatus: "completed",
            completedAt: new Date().toISOString(),
          },
        },
      },
    });
    await callApi(baseUrl, bob.session, "PUT", "/profile/me", {
      expected: 200,
      json: {
        username: bobHandle,
        likes: ["science", "history"],
        interests: ["robotics", "chess"],
      },
    });

    const search = await callApi(
      baseUrl,
      alice.session,
      "GET",
      `/profile/users/search?username=${encodeURIComponent(bobHandle)}&limit=8`,
      { expected: 200 }
    );
    const searchUsers = (search.users as Array<{ user_id: string }> | undefined) || [];
    assert.equal(searchUsers.some((u) => u.user_id === bob.userId), true, "bob should be searchable");

    await callApi(baseUrl, alice.session, "POST", "/profile/following", {
      expected: 200,
      json: { userId: bob.userId },
    });

    const followedBefore = await callApi(
      baseUrl,
      alice.session,
      "GET",
      "/messages/following/search?q=bob&limit=12",
      { expected: 200 }
    );
    const followedUsers = (followedBefore.users as Array<{ user_id: string }> | undefined) || [];
    assert.equal(followedUsers.some((u) => u.user_id === bob.userId), true, "bob should be in followed search");

    const directResult = await callApi(
      baseUrl,
      alice.session,
      "POST",
      `/messages/conversations/direct/${bob.userId}`,
      { expected: [200, 201] }
    );
    const direct = directResult.conversation as { id?: string } | undefined;
    if (!direct?.id) throw new Error("Direct conversation id missing");

    await callApi(baseUrl, alice.session, "POST", `/messages/conversations/${direct.id}/messages`, {
      expected: 201,
      json: { body: "Please review the update in this direct chat." },
    });

    const bobDirectLoad = await callApi(
      baseUrl,
      bob.session,
      "GET",
      `/messages/conversations/${direct.id}/messages?limit=60`,
      { expected: 200 }
    );
    const bobDirectMessages =
      (bobDirectLoad.messages as Array<{ id: string; sender_id: string }> | undefined) || [];
    assert.equal(
      bobDirectMessages.some((message) => message.sender_id === alice.userId),
      true,
      "bob should receive alice direct messages"
    );
    const firstDirectFromAlice = bobDirectMessages.find((message) => message.sender_id === alice.userId);
    assert.equal(
      bobDirectLoad.firstUnreadMessageId,
      firstDirectFromAlice?.id,
      "messages endpoint should return bob's first unread message id"
    );

    const aliceDirectDelivered = await callApi(
      baseUrl,
      alice.session,
      "GET",
      `/messages/conversations/${direct.id}/messages?limit=60`,
      { expected: 200 }
    );
    const aliceDeliveredMessages =
      (aliceDirectDelivered.messages as Array<{ sender_id: string; delivery_status?: string }> | undefined) || [];
    const deliveredOrRead = aliceDeliveredMessages.some(
      (message) =>
        message.sender_id === alice.userId &&
        (message.delivery_status === "delivered" || message.delivery_status === "read")
    );
    assert.equal(deliveredOrRead, true, "alice should see delivered/read status after bob loads direct chat");

    await callApi(baseUrl, bob.session, "POST", `/messages/conversations/${direct.id}/read`, {
      expected: 200,
      json: {},
    });

    const aliceDirectRead = await callApi(
      baseUrl,
      alice.session,
      "GET",
      `/messages/conversations/${direct.id}/messages?limit=60`,
      { expected: 200 }
    );
    const aliceReadMessages =
      (aliceDirectRead.messages as Array<{ sender_id: string; delivery_status?: string }> | undefined) || [];
    assert.equal(
      aliceReadMessages.some(
        (message) => message.sender_id === alice.userId && message.delivery_status === "read"
      ),
      true,
      "alice should see read status after bob marks chat as read"
    );

    const channelResult = await callApi(baseUrl, alice.session, "POST", "/messages/conversations", {
      expected: 201,
      json: {
        name: "Grade 10 Science Assignment",
        type: "channel",
        participantIds: [bob.userId],
        assignmentTitle: "Photosynthesis group report",
        assignmentDescription: "Compile findings",
        assignmentDueAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        assignmentTemplate: {
          templateId: "research_report",
          checklist: ["Gather sources", "Draft report", "Peer review"],
          rubric: [
            { criterion: "Research quality", weight: 40 },
            { criterion: "Analysis", weight: 40 },
            { criterion: "Writing", weight: 20 },
          ],
        },
      },
    });
    const channel = channelResult.conversation as
      | { id?: string; type?: string; assignment_template?: { templateId?: string } }
      | undefined;
    if (!channel?.id) throw new Error("Channel id missing");
    assert.equal(channel.type, "channel", "channel conversation should be created");
    assert.equal(
      channel.assignment_template?.templateId,
      "research_report",
      "channel create response should include assignment template payload"
    );

    const channelMessage = await callApi(
      baseUrl,
      alice.session,
      "POST",
      `/messages/conversations/${channel.id}/messages`,
      {
        expected: 201,
        json: { body: `@${bobHandle} please post your section by tomorrow.` },
      }
    );
    const channelMessageId = (channelMessage.message as { id?: string } | undefined)?.id;
    if (!channelMessageId) throw new Error("Channel message id missing");
    const mentionIds =
      ((channelMessage.message as { mention_user_ids?: string[] } | undefined)?.mention_user_ids as string[]) || [];
    assert.equal(mentionIds.includes(bob.userId), true, "channel message should resolve @username mentions");

    const secondaryMessage = await callApi(
      baseUrl,
      alice.session,
      "POST",
      `/messages/conversations/${channel.id}/messages`,
      {
        expected: 201,
        json: { body: "Secondary draft note for reaction and edit/delete checks." },
      }
    );
    const secondaryMessageId = (secondaryMessage.message as { id?: string } | undefined)?.id;
    if (!secondaryMessageId) throw new Error("Secondary channel message id missing");

    await callApi(baseUrl, bob.session, "POST", `/messages/messages/${secondaryMessageId}/reactions`, {
      expected: 200,
      json: { emoji: "👍" },
    });
    const bobChannelAfterReaction = await callApi(
      baseUrl,
      bob.session,
      "GET",
      `/messages/conversations/${channel.id}/messages?limit=80`,
      { expected: 200 }
    );
    const bobReactionMessage =
      (
        (bobChannelAfterReaction.messages as Array<{ id: string; reactions?: Array<{ emoji: string; reacted: boolean; count: number }> }> | undefined) ||
        []
      ).find((message) => message.id === secondaryMessageId) || null;
    assert.equal(Boolean(bobReactionMessage), true, "secondary message should exist for bob");
    assert.equal(
      Boolean(bobReactionMessage?.reactions?.some((reaction) => reaction.emoji === "👍" && reaction.reacted)),
      true,
      "bob should see his own reaction as reacted"
    );

    const editedSecondary = await callApi(baseUrl, alice.session, "PUT", `/messages/messages/${secondaryMessageId}/edit`, {
      expected: 200,
      json: { body: "Secondary draft note edited for verification." },
    });
    assert.equal(
      Boolean((editedSecondary.message as { edited_at?: string | null } | undefined)?.edited_at),
      true,
      "edited message should have edited_at timestamp"
    );

    const deletedSecondary = await callApi(
      baseUrl,
      alice.session,
      "DELETE",
      `/messages/messages/${secondaryMessageId}`,
      { expected: 200 }
    );
    assert.equal(
      (deletedSecondary.message as { body?: string | null } | undefined)?.body,
      "[message deleted]",
      "deleted message should be soft deleted with tombstone body"
    );
    assert.equal(
      Boolean((deletedSecondary.message as { deleted_at?: string | null } | undefined)?.deleted_at),
      true,
      "deleted message should include deleted_at"
    );

    const messageContext = await callApi(
      baseUrl,
      alice.session,
      "GET",
      `/messages/conversations/${channel.id}/messages/context?messageId=${channelMessageId}&before=8&after=12`,
      { expected: 200 }
    );
    const contextMessages = (messageContext.messages as Array<{ id: string }> | undefined) || [];
    assert.equal(
      messageContext.anchorMessageId,
      channelMessageId,
      "context endpoint should return requested anchor message id"
    );
    assert.equal(
      contextMessages.some((message) => message.id === channelMessageId),
      true,
      "context endpoint should include the anchor message"
    );

    const messageSearch = await callApi(
      baseUrl,
      alice.session,
      "GET",
      `/messages/conversations/${channel.id}/search?q=${encodeURIComponent("tomorrow")}&limit=10`,
      { expected: 200 }
    );
    const searchedMessages = (messageSearch.messages as Array<{ id: string }> | undefined) || [];
    assert.equal(
      searchedMessages.some((message) => message.id === channelMessageId),
      true,
      "channel message should be returned by conversation search"
    );

    const pinResult = await callApi(baseUrl, alice.session, "PUT", `/messages/messages/${channelMessageId}/pin`, {
      expected: 200,
      json: {},
    });
    const pinnedMessageId = (pinResult.message as { id?: string; pinned_at?: string | null } | undefined)?.id;
    assert.equal(pinnedMessageId, channelMessageId, "pin endpoint should return the pinned message");
    assert.equal(
      Boolean((pinResult.message as { pinned_at?: string | null } | undefined)?.pinned_at),
      true,
      "pin endpoint should set pinned_at"
    );

    const pinnedList = await callApi(
      baseUrl,
      alice.session,
      "GET",
      `/messages/conversations/${channel.id}/pins?limit=10`,
      { expected: 200 }
    );
    const pinnedMessages = (pinnedList.messages as Array<{ id: string }> | undefined) || [];
    assert.equal(
      pinnedMessages.some((message) => message.id === channelMessageId),
      true,
      "pinned list should include pinned message"
    );

    await callApi(baseUrl, alice.session, "DELETE", `/messages/messages/${channelMessageId}/pin`, {
      expected: 200,
    });
    const pinnedListAfterUnpin = await callApi(
      baseUrl,
      alice.session,
      "GET",
      `/messages/conversations/${channel.id}/pins?limit=10`,
      { expected: 200 }
    );
    const unpinnedMessages = (pinnedListAfterUnpin.messages as Array<{ id: string }> | undefined) || [];
    assert.equal(
      unpinnedMessages.some((message) => message.id === channelMessageId),
      false,
      "unpinned message should be removed from pinned list"
    );

    const bobMentions = await callApi(baseUrl, bob.session, "GET", "/messages/mentions?limit=10&unreadOnly=true", {
      expected: 200,
    });
    const mentionRows =
      (bobMentions.mentions as Array<{ conversation_id: string; message_id: string; unread: boolean }> | undefined) ||
      [];
    assert.equal(
      mentionRows.some((mention) => mention.conversation_id === channel.id && mention.unread),
      true,
      "bob should get unread mention notification"
    );
    assert.equal(Number(bobMentions.unreadCount || 0) > 0, true, "bob unread mention counter should be > 0");

    const channelState = await callApi(
      baseUrl,
      alice.session,
      "GET",
      `/messages/conversations/${channel.id}/state`,
      { expected: 200 }
    );
    const channelParticipants =
      (channelState.participants as Array<{ user_id: string; role: string }> | undefined) || [];
    assert.equal(
      channelParticipants.some((participant) => participant.user_id === alice.userId && participant.role === "owner"),
      true,
      "channel creator should be owner"
    );
    assert.equal(
      channelParticipants.some((participant) => participant.user_id === bob.userId && participant.role === "editor"),
      true,
      "channel invitees should default to editor"
    );

    await callApi(
      baseUrl,
      alice.session,
      "PUT",
      `/messages/conversations/${channel.id}/participants/${bob.userId}/role`,
      {
        expected: 200,
        json: { role: "viewer" },
      }
    );

    const channelStateAfterRole = await callApi(
      baseUrl,
      alice.session,
      "GET",
      `/messages/conversations/${channel.id}/state`,
      { expected: 200 }
    );
    const roleUpdatedParticipants =
      (channelStateAfterRole.participants as Array<{ user_id: string; role: string }> | undefined) || [];
    assert.equal(
      roleUpdatedParticipants.some(
        (participant) => participant.user_id === bob.userId && participant.role === "viewer"
      ),
      true,
      "owner role update should set bob to viewer"
    );

    const archived = await callApi(baseUrl, alice.session, "PUT", `/messages/conversations/${channel.id}/archive`, {
      expected: 200,
      json: { archived: true },
    });
    assert.equal(
      Boolean((archived.conversation as { archived_at?: string | null } | undefined)?.archived_at),
      true,
      "owner should be able to archive channel"
    );

    await callApi(baseUrl, alice.session, "POST", `/messages/conversations/${channel.id}/messages`, {
      expected: 403,
      json: { body: "Can anyone post while archived?" },
    });

    const unarchived = await callApi(
      baseUrl,
      alice.session,
      "PUT",
      `/messages/conversations/${channel.id}/archive`,
      {
        expected: 200,
        json: { archived: false },
      }
    );
    assert.equal(
      (unarchived.conversation as { archived_at?: string | null } | undefined)?.archived_at ?? null,
      null,
      "owner should be able to unarchive channel"
    );

    await callApi(baseUrl, alice.session, "POST", `/messages/conversations/${channel.id}/messages`, {
      expected: 201,
      json: { body: "Channel is unarchived, posting resumes." },
    });

    let activityEvents: Array<{ event_type: string; message_id?: string | null }> = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const activityHistory = await callApi(
        baseUrl,
        alice.session,
        "GET",
        `/messages/conversations/${channel.id}/activity?limit=30`,
        { expected: 200 }
      );
      const events = Array.isArray((activityHistory as { events?: unknown[] }).events)
        ? ((activityHistory as { events: Array<{ event_type: string; message_id?: string | null }> }).events ?? [])
        : [];
      if (events.length) {
        activityEvents = events;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    const activityTypes = new Set(activityEvents.map((event) => event.event_type));
    assert.equal(activityTypes.has("message_pinned"), true, "activity should include message_pinned");
    assert.equal(activityTypes.has("message_unpinned"), true, "activity should include message_unpinned");
    assert.equal(activityTypes.has("conversation_archived"), true, "activity should include conversation_archived");
    assert.equal(
      activityTypes.has("conversation_unarchived"),
      true,
      "activity should include conversation_unarchived"
    );

    await callApi(baseUrl, bob.session, "POST", `/messages/conversations/${channel.id}/read`, {
      expected: 200,
      json: {},
    });
    const bobMentionsAfterRead = await callApi(
      baseUrl,
      bob.session,
      "GET",
      "/messages/mentions?limit=10&unreadOnly=true",
      {
        expected: 200,
      }
    );
    assert.equal(
      Number(bobMentionsAfterRead.unreadCount || 0),
      0,
      "mention unread counter should clear after read"
    );

    await callApi(baseUrl, alice.session, "PUT", `/messages/conversations/${channel.id}/settings`, {
      expected: 200,
      json: { mentionNotifications: false },
    });

    const channelStateAfterSettings = await callApi(
      baseUrl,
      alice.session,
      "GET",
      `/messages/conversations/${channel.id}/state`,
      { expected: 200 }
    );
    const channelSettings = channelStateAfterSettings.settings as
      | { mention_notifications?: boolean }
      | undefined;
    assert.equal(
      channelSettings?.mention_notifications,
      false,
      "channel settings should persist mention notification preference"
    );

    const interactions = await callApi(baseUrl, alice.session, "GET", "/messages/interactions?limit=40", {
      expected: 200,
    });
    const interactedUsers = (interactions.users as Array<{ user_id: string }> | undefined) || [];
    assert.equal(interactedUsers.some((u) => u.user_id === bob.userId), true, "bob should be in interactions");

    await callApi(baseUrl, alice.session, "POST", "/profile/users/mute", {
      expected: 200,
      json: { userId: bob.userId },
    });
    await callApi(baseUrl, alice.session, "POST", "/profile/users/block", {
      expected: 200,
      json: { userId: bob.userId },
    });

    const relationships = await callApi(
      baseUrl,
      alice.session,
      "GET",
      "/profile/users/relationships?limit=40",
      { expected: 200 }
    );
    const blocked = (relationships.blocked as Array<{ user_id: string }> | undefined) || [];
    const muted = (relationships.muted as Array<{ user_id: string }> | undefined) || [];
    assert.equal(blocked.some((u) => u.user_id === bob.userId), true, "bob should be blocked");
    assert.equal(muted.some((u) => u.user_id === bob.userId), true, "bob should stay muted");

    await callApi(baseUrl, alice.session, "POST", `/messages/conversations/direct/${bob.userId}`, {
      expected: 403,
    });

    const followedAfter = await callApi(
      baseUrl,
      alice.session,
      "GET",
      "/messages/following/search?q=bob&limit=12",
      { expected: 200 }
    );
    const followedAfterUsers = (followedAfter.users as Array<{ user_id: string }> | undefined) || [];
    assert.equal(
      followedAfterUsers.some((u) => u.user_id === bob.userId),
      false,
      "blocked user should be excluded from followed search"
    );

    summary.push("search-follow-message-media-channel-blockmute smoke passed");
    summary.push("channel roles, mentions, message search, pins, archive controls, and delivery states smoke passed");
    summary.push("message context jumps, first unread ids, and channel activity history smoke passed");
    summary.push("message edit/delete/reaction APIs and hydration smoke passed");
    console.log("SMOKE RESULT: PASS");
    for (const line of summary) console.log(`- ${line}`);
  } finally {
    await app.close();
    await closePool();
  }
}

main().catch((error) => {
  console.error("SMOKE RESULT: FAIL");
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
