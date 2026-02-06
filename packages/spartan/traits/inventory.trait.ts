export interface HasInventory {
  inventory: string[];
}

export interface IsLockable {
  isLocked: boolean;
  requiredKey: string;
}

export interface IsCollectible {
  collectibleType?: string;
  collectibleId: string;
}
