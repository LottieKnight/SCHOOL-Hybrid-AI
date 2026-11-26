import { PrismaClient, Prisma } from './generated/prisma';
import {
  VentureType,
  CreditTransactionType,
  CreditSource,
  CreditTransaction,
  CreditWallet,
  UserCredits,
  EarnCreditsRequest,
  SpendCreditsRequest,
  TransferCreditsRequest,
  RedemptionRequest,
  CreditBalanceResponse,
  TransactionResponse,
  RedemptionResponse,
  RateLimitInfo,
  CREDIT_RULES,
  getCreditRule,
  isEarnSource,
  isSpendSource,
} from './types';

const prisma = new PrismaClient();

export class CreditsService {
  async getUserCredits(userId: number): Promise<UserCredits> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        creditWallets: true,
        creditTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const totalBalance = user.creditWallets.reduce((sum: number, w: { balance: number }) => sum + w.balance, 0);

    return {
      userId: user.id,
      totalBalance,
      lifetimeEarned: user.lifetimeEarned,
      lifetimeSpent: user.lifetimeSpent,
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      wallets: user.creditWallets,
      recentTransactions: user.creditTransactions as CreditTransaction[],
    };
  }

  async getWalletBalance(userId: number, venture: VentureType): Promise<number> {
    const wallet = await prisma.creditWallet.findUnique({
      where: { userId_venture: { userId, venture } },
    });
    return wallet?.balance || 0;
  }

  async checkRateLimit(userId: number, venture: VentureType, source: CreditSource): Promise<RateLimitInfo> {
    const rule = getCreditRule(source);
    if (!rule.maxPerDay && !rule.maxPerWeek) {
      return { allowed: true, remaining: Infinity, resetAt: new Date(Date.now() + 86400000), maxCount: 0 };
    }

    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayEnd = new Date(dayStart.getTime() + 86400000);

    const rateLimit = await prisma.creditRateLimit.findUnique({
      where: { userId_venture_source_windowStart: { userId, venture, source, windowStart: dayStart } },
    });

    const maxCount = rule.maxPerDay || rule.maxPerWeek || 0;
    const currentCount = rateLimit?.count || 0;
    const remaining = Math.max(0, maxCount - currentCount);

    return {
      allowed: currentCount < maxCount,
      remaining,
      resetAt: dayEnd,
      maxCount,
    };
  }

  async earnCredits(request: EarnCreditsRequest): Promise<TransactionResponse> {
    const { userId, venture, source, amount, description, metadata, idempotencyKey, referenceId, referenceType } = request;

    if (idempotencyKey) {
      const existing = await prisma.creditTransaction.findUnique({ where: { idempotencyKey } });
      if (existing) {
        return { success: true, transaction: existing as CreditTransaction };
      }
    }

    const rule = getCreditRule(source);
    const finalAmount = amount > 0 ? amount : rule.amount;

    if (finalAmount <= 0) {
      return { success: false, error: 'Invalid earn amount', code: 'INVALID_AMOUNT' };
    }

    const rateLimit = await this.checkRateLimit(userId, venture, source);
    if (!rateLimit.allowed) {
      return { success: false, error: 'Rate limit exceeded', code: 'RATE_LIMITED' };
    }

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let wallet = await tx.creditWallet.findUnique({
        where: { userId_venture: { userId, venture } },
      });

      if (!wallet) {
        wallet = await tx.creditWallet.create({
          data: { userId, venture, balance: 0, locked: 0 },
        });
      }

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore + finalAmount;

      await tx.creditWallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          creditsBalance: { increment: finalAmount },
          lifetimeEarned: { increment: finalAmount },
        },
      });

      const transaction = await tx.creditTransaction.create({
        data: {
          userId,
          walletId: wallet.id,
          venture,
          type: 'EARN',
          source,
          amount: finalAmount,
          balanceBefore,
          balanceAfter,
          description,
          metadata,
          idempotencyKey,
          referenceId,
          referenceType,
        },
      });

      if (rateLimit.maxCount > 0) {
        await tx.creditRateLimit.upsert({
          where: { userId_venture_source_windowStart: { userId, venture, source, windowStart: new Date(new Date().setHours(0,0,0,0)) } },
          create: { userId, venture, source, windowStart: new Date(new Date().setHours(0,0,0,0)), windowEnd: new Date(new Date().setHours(23,59,59,999)), count: 1, maxCount: rateLimit.maxCount },
          update: { count: { increment: 1 } },
        });
      }

      await this.updateStreak(tx, userId, venture, source);

      return { success: true, transaction: transaction as CreditTransaction };
    });
  }

  async spendCredits(request: SpendCreditsRequest): Promise<TransactionResponse> {
    const { userId, venture, source, amount, description, metadata, idempotencyKey, referenceId, referenceType } = request;

    if (idempotencyKey) {
      const existing = await prisma.creditTransaction.findUnique({ where: { idempotencyKey } });
      if (existing) {
        return { success: true, transaction: existing as CreditTransaction };
      }
    }

    const rule = getCreditRule(source);
    const finalAmount = amount > 0 ? amount : Math.abs(rule.amount);

    if (finalAmount <= 0) {
      return { success: false, error: 'Invalid spend amount', code: 'INVALID_AMOUNT' };
    }

    const wallet = await prisma.creditWallet.findUnique({
      where: { userId_venture: { userId, venture } },
    });

    if (!wallet || wallet.balance < finalAmount) {
      return { success: false, error: 'Insufficient credits', code: 'INSUFFICIENT_BALANCE' };
    }

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore - finalAmount;

      await tx.creditWallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          creditsBalance: { decrement: finalAmount },
          lifetimeSpent: { increment: finalAmount },
        },
      });

      const transaction = await tx.creditTransaction.create({
        data: {
          userId,
          walletId: wallet.id,
          venture,
          type: 'SPEND',
          source,
          amount: -finalAmount,
          balanceBefore,
          balanceAfter,
          description,
          metadata,
          idempotencyKey,
          referenceId,
          referenceType,
        },
      });

      return { success: true, transaction: transaction as CreditTransaction };
    });
  }

  async transferCredits(request: TransferCreditsRequest): Promise<TransactionResponse> {
    const { fromUserId, toUserId, venture, amount, description, metadata, idempotencyKey } = request;

    if (idempotencyKey) {
      const existing = await prisma.creditTransaction.findUnique({ where: { idempotencyKey } });
      if (existing) {
        return { success: true, transaction: existing as CreditTransaction };
      }
    }

    const fromWallet = await prisma.creditWallet.findUnique({
      where: { userId_venture: { userId: fromUserId, venture } },
    });

    if (!fromWallet || fromWallet.balance < amount) {
      return { success: false, error: 'Insufficient credits', code: 'INSUFFICIENT_BALANCE' };
    }

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let toWallet = await tx.creditWallet.findUnique({
        where: { userId_venture: { userId: toUserId, venture } },
      });

      if (!toWallet) {
        toWallet = await tx.creditWallet.create({
          data: { userId: toUserId, venture, balance: 0, locked: 0 },
        });
      }

      await tx.creditWallet.update({
        where: { id: fromWallet.id },
        data: { balance: { decrement: amount } },
      });

      await tx.creditWallet.update({
        where: { id: toWallet.id },
        data: { balance: { increment: amount } },
      });

      await tx.user.update({
        where: { id: fromUserId },
        data: { creditsBalance: { decrement: amount }, lifetimeSpent: { increment: amount } },
      });

      await tx.user.update({
        where: { id: toUserId },
        data: { creditsBalance: { increment: amount }, lifetimeEarned: { increment: amount } },
      });

      const [outTransaction, inTransaction] = await Promise.all([
        tx.creditTransaction.create({
          data: {
            userId: fromUserId,
            walletId: fromWallet.id,
            venture,
            type: 'TRANSFER_OUT',
            source: 'CROSS_VENTURE_BONUS',
            amount: -amount,
            balanceBefore: fromWallet.balance,
            balanceAfter: fromWallet.balance - amount,
            description: `Transfer to user ${toUserId}: ${description}`,
            metadata,
            idempotencyKey: `${idempotencyKey}-out`,
          },
        }),
        tx.creditTransaction.create({
          data: {
            userId: toUserId,
            walletId: toWallet.id,
            venture,
            type: 'TRANSFER_IN',
            source: 'CROSS_VENTURE_BONUS',
            amount,
            balanceBefore: toWallet.balance,
            balanceAfter: toWallet.balance + amount,
            description: `Transfer from user ${fromUserId}: ${description}`,
            metadata,
            idempotencyKey: `${idempotencyKey}-in`,
          },
        }),
      ]);

      return { success: true, transaction: outTransaction as CreditTransaction };
    });
  }

  async redeemCredits(request: RedemptionRequest): Promise<RedemptionResponse> {
    const { userId, venture, source, amount, itemId, itemType, itemName, metadata } = request;

    const spendResult = await this.spendCredits({
      userId,
      venture,
      source,
      amount,
      description: `Redeemed: ${itemName}`,
      metadata: {
        ...(typeof metadata === 'object' && metadata !== null && !Array.isArray(metadata) ? metadata : {}),
        redemptionItemId: itemId,
        redemptionItemType: itemType,
      },
    });

    if (!spendResult.success) {
      return { success: false, error: spendResult.error, code: spendResult.code };
    }

    const redemption = await prisma.creditRedemption.create({
      data: {
        userId,
        venture,
        source,
        amount,
        itemId,
        itemType,
        itemName,
        status: 'COMPLETED',
        metadata,
        processedAt: new Date(),
      },
    });

    return { success: true, redemptionId: redemption.id };
  }

  private async updateStreak(tx: Prisma.TransactionClient, userId: number, venture: VentureType, source: CreditSource) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const lastActive = user.lastActiveDate ? new Date(user.lastActiveDate) : null;
    let newStreak = user.currentStreak;

    if (lastActive) {
      const lastActiveDay = new Date(lastActive);
      lastActiveDay.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - lastActiveDay.getTime()) / 86400000);

      if (diffDays === 1) {
        newStreak += 1;
      } else if (diffDays > 1) {
        newStreak = 1;
      }
    } else {
      newStreak = 1;
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        currentStreak: newStreak,
        longestStreak: Math.max(newStreak, user.longestStreak),
        lastActiveDate: today,
      },
    });

    await tx.streakHistory.upsert({
      where: { id: 0 },
      create: { userId, venture, streakType: 'daily', count: newStreak, startDate: today, isActive: true },
      update: { count: newStreak, endDate: today, isActive: true },
    });
  }

  async getTransactionHistory(userId: number, venture?: VentureType, limit = 100, offset = 0): Promise<CreditTransaction[]> {
    return prisma.creditTransaction.findMany({
      where: { userId, ...(venture ? { venture } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }) as Promise<CreditTransaction[]>;
  }

  async getRedemptionHistory(userId: number): Promise<any[]> {
    return prisma.creditRedemption.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async auditCreditChange(userId: number, venture: VentureType, action: string, entityType: string, entityId: string, oldValue: any, newValue: any, performedBy?: string, reason?: string) {
    await prisma.creditAuditLog.create({
      data: { userId, venture, action, entityType, entityId, oldValue, newValue, performedBy, reason },
    });
  }
}

export const creditsService = new CreditsService();