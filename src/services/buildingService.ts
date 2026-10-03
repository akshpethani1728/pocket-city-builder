import { notImplemented } from '../lib/logger';

/** Per-building rows (place/upgrade) — later phase, server-validated. */
export const buildingService = {
  async placeBuilding(): Promise<never> {
    return notImplemented('buildingService.placeBuilding');
  }
};
