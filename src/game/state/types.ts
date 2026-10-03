/**
 * Central game state types — Phase 1 foundation only.
 * No gameplay logic here. Later phases fill in sim/economy/population.
 * Keep everything serializable (for future Supabase + IndexedDB saves).
 */

export interface PlayerProfile {
  userId: string;
  username: string;
  avatarUrl: string | null;
  /** Short shareable code, e.g. PKT-XXXX (assigned by backend later). */
  playerCode: string | null;
}

export interface CityState {
  id: string;
  name: string;
  /** Era/stage label, e.g. "settlement". Values defined in data later. */
  era: string;
  coins: number;
  population: number;
  housingCapacity: number;
  /** Fractional arrivals toward the next citizen (growth accumulator). */
  populationProgress: number;
  /** Simulated city age in seconds (drives new-city grace rules). */
  ageSec: number;
  /** Highest city stage ever reached (unlocks are permanent). */
  highestStageId: string;
  /** 0-100 snapshot; real formula arrives with satisfaction system. */
  satisfaction: number;
}

export interface BuildingInstance {
  id: string;
  type: string;
  x: number;
  y: number;
  level: number;
}

export interface TechnologyState {
  unlocked: string[];
}

export interface AchievementState {
  completed: string[];
  progress: Record<string, number>;
}

export interface UnlockState {
  unlocked: string[];
}

export interface ProgressState {
  /** Highest city stage ever reached (unlocks are permanent). */
  highestStageId: string;
}

export interface MapState {
  /** Purchased expansion zone ids. Tiles/requirements derive from defs. */
  unlockedExpansionIds: string[];
}

export interface GameTimestamps {
  /** Server-authoritative once backend lands; local clock only for now. */
  lastActiveAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  saveRevision: number;
}

export interface GameState {
  version: 1;
  player: PlayerProfile | null;
  city: CityState | null;
  buildings: BuildingInstance[];
  technologies: TechnologyState;
  achievements: AchievementState;
  unlocks: UnlockState;
  progress: ProgressState;
  map: MapState;
  timestamps: GameTimestamps;
  /** True when Supabase env is present and client initialized. */
  cloudEnabled: boolean;
}

export function createInitialState(): GameState {
  return {
    version: 1,
    player: null,
    city: null,
    buildings: [],
    technologies: { unlocked: [] },
    achievements: { completed: [], progress: {} },
    unlocks: { unlocked: [] },
    progress: { highestStageId: 'settlement' },
    map: { unlockedExpansionIds: [] },
    timestamps: {
      lastActiveAt: null,
      createdAt: null,
      updatedAt: null,
      saveRevision: 0
    },
    cloudEnabled: false
  };
}
