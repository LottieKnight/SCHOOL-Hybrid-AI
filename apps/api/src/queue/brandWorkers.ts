import { Queue, Worker } from "bullmq";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import {
  generateContent,
  getPlatformsForPillar,
  getNextPostTime,
  isPillarAllowed,
  type Pillar,
} from "@saedu/shared";

const redisUrl = new URL(config.redisUrl);
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || "6379"),
  password: redisUrl.password || undefined,
  // In tests there is no Redis service; without this the connection
  // retries forever and the open handle keeps the test process alive.
  ...(config.env === "test"
    ? { retryStrategy: () => null, enableOfflineQueue: false }
    : {}),
};

const BRAND_GENERATE_QUEUE = "brand-generate";
const BRAND_PUBLISH_QUEUE = "brand-publish";
const BRAND_ANALYTICS_QUEUE = "brand-analytics";

export const brandGenerateQueue = new Queue(BRAND_GENERATE_QUEUE, { connection });
export const brandPublishQueue = new Queue(BRAND_PUBLISH_QUEUE, { connection });
export const brandAnalyticsQueue = new Queue(BRAND_ANALYTICS_QUEUE, { connection });

async function publishToX(_content: unknown): Promise<string> {
  throw new Error(
    "TODO: implement X publisher — see https://developer.x.com/en/docs/x-api/tweets/manage-tweets/api-reference/post-tweets"
  );
}

async function publishToLinkedIn(_content: unknown): Promise<string> {
  throw new Error(
    "TODO: implement LinkedIn publisher — see https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/ugc-post-api"
  );
}

async function publishToInstagram(_content: unknown): Promise<string> {
  throw new Error(
    "TODO: implement Instagram publisher — see https://developers.facebook.com/docs/instagram-api/guides/content-publishing"
  );
}

async function publishToYouTube(_content: unknown): Promise<string> {
  throw new Error(
    "TODO: implement YouTube publisher — see https://developers.google.com/youtube/v3/docs/videos/insert"
  );
}

async function fetchPlatformAnalytics(
  _platform: string,
  _externalId: string
): Promise<{
  impressions: number;
  engagements: number;
  likes: number;
  reposts: number;
  comments: number;
}> {
  return {
    impressions: 0,
    engagements: 0,
    likes: 0,
    reposts: 0,
    comments: 0,
  };
}

const generateProcessor = async (job: { data: unknown }) => {
    const { signalId, source, rawContent, pillar } = job.data as {
      signalId: number;
      source: string;
      rawContent: string;
      pillar: Pillar;
    };

    const {
      rows: [voiceModel],
    } = await pool.query(
      "SELECT * FROM brand_voice_model WHERE active = TRUE LIMIT 1"
    );
    if (!voiceModel) {
      throw new Error(
        "No active voice model found. Create one via POST /brand/voice-model"
      );
    }

    const { rows: counts } = await pool.query(`
      SELECT s.pillar, COUNT(d.id) AS count
      FROM brand_drafts d
      JOIN brand_signals s ON s.id = d.signal_id
      WHERE d.created_at > NOW() - INTERVAL '7 days'
      GROUP BY s.pillar
    `);
    const weeklyPostCounts: Record<Pillar, number> = {
      trading: 0,
      school: 0,
      aura: 0,
      builder: 0,
    };
    for (const r of counts as Array<{ pillar: Pillar; count: string }>) {
      weeklyPostCounts[r.pillar] = parseInt(r.count, 10);
    }

    if (!isPillarAllowed(weeklyPostCounts, pillar)) {
      await pool.query(
        "UPDATE brand_signals SET processed = TRUE WHERE id = $1",
        [signalId]
      );
      return { skipped: true, reason: "pillar_limit" };
    }

    const platforms = getPlatformsForPillar(pillar);

    const content = await generateContent(
      { source: source as "github" | "trading" | "ideas" | "price" | "manual" | "telegram", rawContent, pillar },
      platforms,
      {
        version: voiceModel.version,
        systemPrompt: voiceModel.system_prompt,
        examples: voiceModel.examples ?? [],
      }
    );

    for (const platform of platforms) {
      const platformContent = content[platform];
      if (!platformContent) continue;

      const scheduledAt = getNextPostTime(platform);

      const {
        rows: [draft],
      } = await pool.query(
        `INSERT INTO brand_drafts (signal_id, platform, content, status, scheduled_at)
         VALUES ($1, $2, $3, 'scheduled', $4) RETURNING id`,
        [signalId, platform, JSON.stringify(platformContent), scheduledAt]
      );

      const delay = Math.max(0, scheduledAt.getTime() - Date.now());
      await brandPublishQueue.add(
        `publish:${platform}`,
        { draftId: draft.id, platform },
        { delay }
      );
    }

    await pool.query(
      "UPDATE brand_signals SET processed = TRUE WHERE id = $1",
      [signalId]
    );
    return { generated: platforms.length };
};

const publishProcessor = async (job: { data: unknown }) => {
    const { draftId, platform } = job.data as { draftId: number; platform: string };

    const {
      rows: [draft],
    } = await pool.query("SELECT * FROM brand_drafts WHERE id = $1", [
      draftId,
    ]);
    if (!draft) throw new Error(`Draft ${draftId} not found`);

    let externalId: string;
    const content = draft.content as Record<string, unknown>;

    switch (platform) {
      case "x":
        externalId = await publishToX(content);
        break;
      case "linkedin":
        externalId = await publishToLinkedIn(content);
        break;
      case "instagram":
        externalId = await publishToInstagram(content);
        break;
      case "youtube":
        externalId = await publishToYouTube(content);
        break;
      default:
        throw new Error(`Unknown platform: ${platform}`);
    }

    await pool.query(
      `UPDATE brand_drafts SET status = 'published', published_at = NOW(), external_id = $1 WHERE id = $2`,
      [externalId, draftId]
    );

    await brandAnalyticsQueue.add(
      "harvest",
      { draftId, platform, externalId },
      { delay: 24 * 60 * 60 * 1000 }
    );

    return { published: true, externalId };
};

const analyticsProcessor = async (job: { data: unknown }) => {
    const { draftId, platform, externalId } = job.data as {
      draftId: number;
      platform: string;
      externalId: string;
    };

    const analytics = await fetchPlatformAnalytics(platform, externalId);

    await pool.query(
      `INSERT INTO brand_analytics (draft_id, platform, impressions, engagements, likes, reposts, comments)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        draftId,
        platform,
        analytics.impressions,
        analytics.engagements,
        analytics.likes,
        analytics.reposts,
        analytics.comments,
      ]
    );
};

// Workers are created on start, not at import: anything importing this
// module (e.g. server.ts for the queues) must not spawn worker
// connections as a side effect.
export function startBrandWorkers(): void {
  const generateWorker = new Worker(BRAND_GENERATE_QUEUE, generateProcessor, {
    connection,
    concurrency: 2,
  });
  const publishWorker = new Worker(BRAND_PUBLISH_QUEUE, publishProcessor, {
    connection,
    concurrency: 1,
  });
  const analyticsWorker = new Worker(BRAND_ANALYTICS_QUEUE, analyticsProcessor, {
    connection,
  });

  generateWorker.on("failed", (job, err) => {
    console.error(`[BrandOS] generate job ${job?.id} failed`, err);
  });
  publishWorker.on("failed", (job, err) => {
    console.error(`[BrandOS] publish job ${job?.id} failed`, err);
  });
  analyticsWorker.on("failed", (job, err) => {
    console.error(`[BrandOS] analytics job ${job?.id} failed`, err);
  });
}
