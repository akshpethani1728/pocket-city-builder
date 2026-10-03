import { notImplemented } from '../lib/logger';

/**
 * Economy mutations MUST go through server-side RPC in later phases.
 * Client must never write balances directly.
 */
export const economyService = {
  async collectIncome(): Promise<never> {
    return notImplemented('economyService.collectIncome');
  }
};
