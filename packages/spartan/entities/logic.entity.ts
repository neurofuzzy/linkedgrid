/**
 * @brief Logic gate and wire entities.
 */
import { BaseEntityData } from './base.entity';
import { HasPropagation, HasColor } from '../traits';

export type ChainLinkData = BaseEntityData & {
  type: 'chain-link';
} & HasPropagation & HasColor;
