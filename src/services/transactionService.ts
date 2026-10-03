import { economyService } from './economyService';
import { logger } from '../lib/logger';

/**
 * P2P transfers — uses the secure server-side RPC.
 * Generates an idempotency key for safety.
 */
export const transactionService = {
  async sendFunds(toUserId: string, amount: number): Promise<{ ok: boolean; error?: string; newBalance?: number }> {
    const idempotencyKey = crypto.randomUUID();
    return economyService.transferFunds(toUserId, amount, idempotencyKey);
  }
};
