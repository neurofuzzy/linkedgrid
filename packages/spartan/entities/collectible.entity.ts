/**
 * @brief Collectible item entities.
 */
import { BaseEntityData } from './base.entity';
import { IsCollectible, HasColor, HasHealth, HasTemperature } from '../traits';

export type ItemData = BaseEntityData & {
  type: 'item';
  itemType: string;
};

export type KeyData = BaseEntityData & {
  type: 'key';
} & IsCollectible &
  HasColor;

export type GasolineData = BaseEntityData & {
  type: 'gasoline';
} & HasHealth & HasTemperature & HasColor;

export type FuseData = BaseEntityData & {
  type: 'fuse';
} & HasHealth & HasTemperature & HasColor;
