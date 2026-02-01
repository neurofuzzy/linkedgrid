import { Direction } from './grid/direction.js';

export interface InputProvider {
  getDirection(): Direction;
  getAction(): boolean;
  getSecondary(): boolean;
  getStart(): boolean;
  getRestart(): boolean;
}
