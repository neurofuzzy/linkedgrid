/**
 * spartan-web - Web platform integration for Spartan games.
 *
 * Provides:
 * - GameEmbed: High-level API for embedding games in web pages
 * - Input managers: Keyboard, mouse, gamepad, and headless input
 *
 * @example
 * ```typescript
 * import { GameEmbed } from 'spartan-web';
 *
 * const embed = new GameEmbed(document.getElementById('game'));
 * const config = await fetch('/games/level1.json').then(r => r.json());
 * embed.load(config);
 * embed.start();
 * ```
 */

// Main embedding API
export { GameEmbed, type GameEmbedConfig, type GameEmbedInputConfig } from './game-embed';

// Input management (re-export for advanced users)
export * from './input';
