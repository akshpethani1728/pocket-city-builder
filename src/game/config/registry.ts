/**
 * Generic registry so new content (buildings, techs, achievements)
 * can be added as data without touching engine code.
 */
export class ConfigRegistry<T extends { id: string }> {
  private items = new Map<string, T>();

  register(def: T): void {
    if (this.items.has(def.id)) {
      throw new Error(`Duplicate config id: ${def.id}`);
    }
    this.items.set(def.id, def);
  }

  get(id: string): T | undefined {
    return this.items.get(id);
  }

  list(): T[] {
    return [...this.items.values()];
  }

  clear(): void {
    this.items.clear();
  }

  get size(): number {
    return this.items.size;
  }
}
