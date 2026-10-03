import { notImplemented } from '../lib/logger';

/**
 * P2P transfers — post-MVP. Must be a Postgres RPC with row locks,
 * balance checks, and an append-only ledger row. Never a direct table write.
 */
export const transactionService = {
  async sendFunds(): Promise<never> {
    return notImplemented('transactionService.sendFunds');
  }
};
