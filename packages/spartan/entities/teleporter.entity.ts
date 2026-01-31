import { BaseEntityData } from './base.entity';
import { HasTeleportTarget, HasSceneLocation } from '../traits';

export type TeleporterData = BaseEntityData & {
  type: 'teleporter';
  destination?: {
    sceneId: string;
    x: number;
    y: number;
    layer: number;
  };
  teleporterState?: 'ready' | 'inactive';
} & HasTeleportTarget &
  HasSceneLocation;
