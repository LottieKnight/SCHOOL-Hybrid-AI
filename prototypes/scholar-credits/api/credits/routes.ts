import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { creditsService } from '../../credits-service';
import { EarnCreditsRequest, SpendCreditsRequest, TransferCreditsRequest, RedemptionRequest, VentureType, CreditSource } from '../../types';

export async function creditsRoutes(fastify: FastifyInstance) {
  fastify.get('/balance', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).user?.id;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const credits = await creditsService.getUserCredits(userId);
      return {
        success: true,
        balance: credits.totalBalance,
        wallets: credits.wallets,
        lifetimeEarned: credits.lifetimeEarned,
        lifetimeSpent: credits.lifetimeSpent,
        currentStreak: credits.currentStreak,
        longestStreak: credits.longestStreak,
      };
    } catch (error) {
      return reply.code(500).send({ error: 'Failed to fetch balance' });
    }
  });

  fastify.get('/wallet/:venture', async (request: FastifyRequest<{ Params: { venture: string } }>, reply: FastifyReply) => {
    const userId = (request as any).user?.id;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const venture = request.params.venture as VentureType;
    try {
      const balance = await creditsService.getWalletBalance(userId, venture);
      return { success: true, venture, balance };
    } catch (error) {
      return reply.code(500).send({ error: 'Failed to fetch wallet balance' });
    }
  });

  fastify.post('/earn', async (request: FastifyRequest<{ Body: EarnCreditsRequest }>, reply: FastifyReply) => {
    const userId = (request as any).user?.id;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { venture, source, amount, description, metadata, idempotencyKey, referenceId, referenceType } = request.body;

    if (!venture || !source) {
      return reply.code(400).send({ error: 'venture and source are required' });
    }

    const result = await creditsService.earnCredits({
      userId,
      venture,
      source,
      amount: amount || 0,
      description: description || `Earned via ${source}`,
      metadata,
      idempotencyKey,
      referenceId,
      referenceType,
    });

    if (!result.success) {
      return reply.code(400).send(result);
    }

    return result;
  });

  fastify.post('/spend', async (request: FastifyRequest<{ Body: SpendCreditsRequest }>, reply: FastifyReply) => {
    const userId = (request as any).user?.id;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { venture, source, amount, description, metadata, idempotencyKey, referenceId, referenceType } = request.body;

    if (!venture || !source || !amount) {
      return reply.code(400).send({ error: 'venture, source, and amount are required' });
    }

    const result = await creditsService.spendCredits({
      userId,
      venture,
      source,
      amount,
      description: description || `Spent via ${source}`,
      metadata,
      idempotencyKey,
      referenceId,
      referenceType,
    });

    if (!result.success) {
      return reply.code(400).send(result);
    }

    return result;
  });

  fastify.post('/transfer', async (request: FastifyRequest<{ Body: TransferCreditsRequest }>, reply: FastifyReply) => {
    const userId = (request as any).user?.id;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { toUserId, venture, amount, description, metadata, idempotencyKey } = request.body;

    if (!toUserId || !venture || !amount) {
      return reply.code(400).send({ error: 'toUserId, venture, and amount are required' });
    }

    const result = await creditsService.transferCredits({
      fromUserId: userId,
      toUserId,
      venture,
      amount,
      description: description || `Transfer to user ${toUserId}`,
      metadata,
      idempotencyKey,
    });

    if (!result.success) {
      return reply.code(400).send(result);
    }

    return result;
  });

  fastify.post('/redeem', async (request: FastifyRequest<{ Body: RedemptionRequest }>, reply: FastifyReply) => {
    const userId = (request as any).user?.id;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { venture, source, amount, itemId, itemType, itemName, metadata } = request.body;

    if (!venture || !source || !amount || !itemId || !itemType || !itemName) {
      return reply.code(400).send({ error: 'All redemption fields are required' });
    }

    const result = await creditsService.redeemCredits({
      userId,
      venture,
      source,
      amount,
      itemId,
      itemType,
      itemName,
      metadata,
    });

    if (!result.success) {
      return reply.code(400).send(result);
    }

    return result;
  });

  fastify.get('/history', async (request: FastifyRequest<{ Querystring: { venture?: string; limit?: string; offset?: string } }>, reply: FastifyReply) => {
    const userId = (request as any).user?.id;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { venture, limit = '50', offset = '0' } = request.query;
    try {
      const transactions = await creditsService.getTransactionHistory(
        userId,
        venture as VentureType,
        parseInt(limit),
        parseInt(offset)
      );
      return { success: true, transactions };
    } catch (error) {
      return reply.code(500).send({ error: 'Failed to fetch history' });
    }
  });

  fastify.get('/redemptions', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).user?.id;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const redemptions = await creditsService.getRedemptionHistory(userId);
      return { success: true, redemptions };
    } catch (error) {
      return reply.code(500).send({ error: 'Failed to fetch redemptions' });
    }
  });

  fastify.post('/sync', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).user?.id;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // This endpoint receives offline-synced credits entries
    // In a real implementation, you'd validate and process batched entries
    return { success: true, message: 'Sync endpoint ready' };
  });
}