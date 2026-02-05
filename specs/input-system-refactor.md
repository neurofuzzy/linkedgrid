The Input System Refactor is complete. All tasks have
been implemented:

Summary of Changes

New InputProvider Interface
(packages/spartan/core/input-provider.ts):
• getMoveDirection() - Movement input
• getAimDirection() - Aiming/attack direction
• getPrimaryAction() - Space/Enter/A button
• getSecondaryAction() - Shift/B button
• isAiming() - Twin-stick auto-fire detection
• InputPreset type: 'classic' | 'twin-stick' | 
  'separated'

InputManager Updates
(packages/spartan-web/input/input-manager.ts):
• Added separate arrowDirection and wasdDirection
  channels
• Added moveDirection and aimDirection mapped based
  on preset
• Added setPreset() and getPreset() methods
• Tracks lastMoveDirection for classic mode aim

WebInputProvider
(packages/spartan-web/input/web-input-provider.ts):
• Implements new InputProvider interface
• Maps presets to appropriate movement/aim directions
• isAiming() returns true in twin-stick mode when
  aiming

HeadlessInputManager
(packages/spartan-web/input/headless-input-manager.ts):
• Added asInputProvider() for testing
• Added setMoveDirection() and setAimDirection() for
  explicit control
• Supports preset-based mapping

System Updates:
• PlayerInputSystem - Uses getMoveDirection()
• MeleeSystem - Uses getAimDirection() and
  getPrimaryAction()
• PlayerWeaponSystem - Uses getAimDirection(),
  getSecondaryAction(), and isAiming() for twin-stick
    auto-fire

GameConfig & GameEmbed:
• Added input.preset configuration option
• Presets flow from JSON config through to
  InputManager

HUD Updates (dev/grid-renderer.tsx):
• Added weapon name and ammo count display

Demo Updates:
• weapons-demo.json and combat-demo.json include
  preset configuration
