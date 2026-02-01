/**
 * @brief Default entity configuration values and property presets.
 */
import { GameLayers } from './layers.config';

/**
 * Entity Configuration
 *
 * Defines default behaviors and spawn settings for entity archetypes.
 */
export const ENTITIES_CONFIG = {
  player: {
    defaultLayer: GameLayers.ACTORS,
  },
  enemy: {
    defaultLayer: GameLayers.ACTORS,
  },
  teleporter: {
    defaultLayer: GameLayers.FLOOR,
  },
  item: {
    defaultLayer: GameLayers.COLLECTIBLES,
  },
  wall: {
    defaultLayer: GameLayers.WALLS,
  },
  door: {
    defaultLayer: GameLayers.WALLS,
  },
  'open-door': {
    defaultLayer: GameLayers.FLOOR,
  },
  'fire-visual': {
    defaultLayer: GameLayers.EPHEMERALS,
  },
  'explosion-visual': {
    defaultLayer: GameLayers.EPHEMERALS,
  },
} as const;
