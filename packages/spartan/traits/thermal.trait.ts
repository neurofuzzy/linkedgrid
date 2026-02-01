export interface HasTemperature {
  temperature: number;    // Current heat level
  flammable: boolean;     // Can this entity catch fire?
  flamePoint: number;     // Temperature threshold for ignition
}
