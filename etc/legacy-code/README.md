This folder contains legacy (incompatible) ECS code and is here for reference only.

## Table of Contents

### Components
Data containers defining entity properties without behavior.

#### AI
- `flee.ts`: AI behavior definition for moving away from threats.
- `follower.ts`: AI behavior for following another entity.
- `gradient-follower.ts`: Logic for AI moving along a value gradient (heat/scent).
- `guard.ts`: AI behavior for holding a position or area.
- `nearest-target.ts`: Configuration for tracking the closest valid target.
- `patrol.ts`: Definition of patrol routes and waypoints.
- `pursuer.ts`: AI behavior for actively chasing a target.
- `waypoint.ts`: Marker component for navigation paths.

#### Assembly
- `chain-reactive.ts`: Entities that trigger others upon destruction.
- `line-assembly.ts`: Configuration for entities arranged in linear formations.
- `ring-assembly.ts`: Configuration for entities formed in a circular pattern.
- `snake-segment.ts`: Part definition for a segmented snake entity.
- `virus-spreading.ts`: Logic for contagion propagation between entities.

#### Combat
- `aoe-buff.ts`: Configuration for area-of-effect status boosts.
- `armor.ts`: Damage reduction properties based on type.
- `collision-damage.ts`: Configuration for damage inflicted upon physical contact.
- `knockback.ts`: Physical force applied to targets on damage.
- `lead-targeting.ts`: AI aiming parameters to account for target velocity.
- `melee-attack.ts`: Definition of close-range damage properties.
- `predictive-aim.ts`: AI aiming logic to anticipate target movement.
- `projectile.ts`: Properties for moving damage-dealing entities.
- `ray-weapon.ts`: Instant-hit beam weapon properties.
- `shield.ts`: Energy shield properties for absorbing damage.
- `splash-damage.ts`: Configuration for damage applied in a radius.

#### Environmental
- `buff-zone.ts`: Area definition for applying beneficial effects.
- `buff.ts`: Generic status effect container.
- `burning.ts`: Visual/logic state for burning entities.
- `explosive.ts`: Volatile entity configuration that can detonate.
- `explosion.ts`: Active explosion event data.
- `extinguisher.ts`: Capabilities for removing fire status.
- `fire-source.ts`: Origin point for fire propagation.
- `flammable.ts`: Properties defining susceptibility to catching fire.
- `fluid-spread.ts`: Logic for liquid simulation and flow.
- `fog-of-war.ts`: Visibility obstruction for unexplored areas.
- `frozen.ts`: State indicating entity is immobilized by ice.
- `fuse.ts`: Delayed activation timer for explosives.
- `ice-freeze.ts`: Status effect preventing movement.
- `ice-source.ts`: Emitter for freezing effects.
- `lava-hazard.ts`: Instant death or high damage floor tile properties.
- `line-of-sight.ts`: Visibility calculation parameters.
- `on-fire.ts`: Active burning status dealing damage.
- `poison-cloud.ts`: Area effect applying poison status.
- `poison-source.ts`: Emitter for poison effects.
- `poisoned.ts`: Damage-over-time status effect.
- `thawer.ts`: Capabilities for removing freeze status.

#### Level Mechanics
- `axis-constraint.ts`: Restricts movement to specific axes.
- `input-buffer.ts`: Queues player actions for smoother control.
- `pickup.ts`: Item definition that can be collected by the player.
- `portal.ts`: Gateway connecting disparate map locations.
- `pushable.ts`: Flag allowing an entity to be moved by external forces.
- `resource-drop.ts`: Loot table configuration for enemies or objects.
- `resource.ts`: Currency or material value held by an entity.
- `respawn-point.ts`: Designated location for player revival.
- `slide.ts`: Forced movement logic for low-friction surfaces.
- `teleporter.ts`: Configuration for transporting entities between coordinates.

#### Puzzle
- `speed-tier.ts`: Tracks completion time brackets for scoring.

#### Spawning
- `conditional-spawner.ts`: Spawns entities only when specific criteria are met.
- `edge-spawner.ts`: Spawns entities at the map perimeter.
- `newly-spawned.ts`: Temporary tag for entities just entering the world.
- `spawn-on-death.ts`: Creates entities when this host is destroyed.
- `spawner.ts`: Base component for generating new entities.
- `wave-spawner.ts`: Manages group spawning in defined waves.

#### Structures
- `conditional-door.ts`: Door that opens based on specific game state conditions.
- `conductor.ts`: Entity capable of transmitting power.
- `door-room.ts`: Manages room transitions and door states.
- `logic-gate.ts`: Performs AND/OR/XOR logic on input signals.
- `map-transition.ts`: Trigger zone that moves the player to a different map.
- `one-way-door.ts`: Defines a door that only opens from one direction.
- `power-source.ts`: Generates power for connected devices.
- `powered-device.ts`: Base component for entities that consume power.
- `powered.ts`: State tracking for currently powered devices.
- `structure-block.ts`: Standard solid structural unit.
- `structure-health.ts`: Tracks integrity and destruction thresholds.
- `structure.ts`: Base definition for physical building blocks.
- `switch.ts`: Toggleable mechanism to control power flow.
- `wire.ts`: Connects power components over distances.

#### Triggers
- `alarm.ts`: Alert state component triggered by security events.
- `relay.ts`: Passes signals between triggers and responders.
- `trigger.ts`: Base definition for event activation zones.

### Systems
Logic processors acting on component data to drive gameplay.

#### AI
- `flee-system.ts`: Implements logic for entities avoiding threats.
- `follow-system.ts`: Manages entities following a target.
- `gradient-following-system.ts`: Moves entities based on gradient values.
- `guard-system.ts`: Enforces guarding behavior and position holding.
- `pursue-system.ts`: Updates positions to chase targets.
- `waypoint-system.ts`: Handles navigation between defined points.

#### Assembly
- `chain-reaction-system.ts`: Processes destruction sequences for connected entities.

#### Combat
- `aoe-buff-system.ts`: Applies and updates area-of-effect buffs.
- `area-attack-system.ts`: Calculates damage for area-based attacks.

#### Environmental
- `buff-system.ts`: Manages active status effects on entities.
- `burn-system.ts`: Applies damage and visual effects to burning entities.
- `electricity-system.ts`: Simulates electrical conductivity and damage.
- `fire-spread-system.ts`: Propagates fire between flammable entities.
- `freeze-system.ts`: Manages freezing effects and immobilization.
- `fuse-system.ts`: Updates timers for explosives.
- `ice-spread-system.ts`: Expands ice coverage over time.
- `poison-system.ts`: Applies poison damage and spreads clouds.
- `virus-spreading-system.ts`: Simulates contagion mechanics.

#### Level Mechanics
- `cardinal-movement-system.ts`: Restricts input/movement to grid axes.
- `click-to-move-system.ts`: Handles mouse-based movement commands.
- `pickup-system.ts`: Processes collection of items by the player.
- `player-input-system.ts`: Translates raw input into game actions.
- `portal-system.ts`: Moves entities between portal pairs.
- `push-system.ts`: Handles physics for pushable objects.
- `resource-system.ts`: Manages resource accumulation and spending.
- `slide-system.ts`: Updates position for entities on slippery surfaces.

#### Puzzle
- `game-rules-system.ts`: Enforces global win/loss conditions.
- `speed-tier-system.ts`: Tracks and updates player speed rankings.

#### Spawning
- `spawning-system.ts`: Handles general entity instantiation.

#### Structures
- `map-transition-system.ts`: Moves player between scenes/maps.

#### Triggers
- `relay-system.ts`: Propagates signals through relay networks.

### Experimental Systems
Prototypes and advanced implementations not yet core.

#### AI
- `nearest-target-system.ts`: Optimizes target selection for AI.
- `patrol-system.ts`: Advanced logic for patrol routes.

#### Assembly
- `line-assembly-system.ts`: Manages entities in linear formations.
- `ring-assembly-system.ts`: Manages circular entity formations.
- `snake-assembly-system.ts`: Logic for snake-like segmented entities.

#### Combat
- `armor-system.ts`: Calculates damage mitigation from armor.
- `collision-damage-system.ts`: Handles damage on entity collision.
- `knockback-system.ts`: Applies physics impulses from attacks.
- `lead-targeting-system.ts`: Calculates interception points for projectiles.
- `melee-attack-system.ts`: Processes close-range combat interactions.
- `predictive-aim-system.ts`: AI system for anticipating target position.
- `projectile-system.ts`: Updates projectile movement and hits.
- `ray-weapon-system.ts`: Handles instant-hit weapon raycasts.
- `shield-system.ts`: Manages shield health and regeneration.
- `splash-damage-system.ts`: Applies damage falloff from explosions.

#### Environmental
- `fluid-spread-system.ts`: Simulates liquid flow mechanics.
- `fog-of-war-system.ts`: Updates visibility based on player position.
- `ice-freeze-system.ts`: Advanced freezing logic.
- `lava-hazard-system.ts`: Processes interactions with lava tiles.
- `line-of-sight-system.ts`: Calculates visible entities and tiles.

#### Level Mechanics
- `resource-drop-system.ts`: Generates loot from destroyed entities.
- `respawn-system.ts`: Handles player respawning sequences.
- `teleporter-system.ts`: Logic for teleportation mechanics.

#### Spawning
- `conditional-spawner-system.ts`: Spawns entities based on complex conditions.
- `edge-spawner-system.ts`: Manages spawning from map edges.
- `spawn-on-death-system.ts`: Triggers spawns upon entity death.
- `wave-spawner-system.ts`: Controls enemy wave timings and composition.

#### Structures
- `conditional-door-system.ts`: Logic for state-dependent doors.
- `door-room-system.ts`: Advanced room transition handling.
- `logic-circuit-system.ts`: Simulates complex logic gate networks.
- `one-way-door-system.ts`: Enforces directional door rules.
- `structure-health-system.ts`: Manages destruction of structures.
- `structure-system.ts`: General structure interaction logic.

#### Triggers
- `alarm-system.ts`: Manages global alarm states.
- `click-trigger-system.ts`: Handles triggers activated by mouse clicks.
- `pressure-plate-system.ts`: Activates triggers on entity overlap.
- `proximity-trigger-system.ts`: Triggers based on distance to player.
- `sequence-trigger-system.ts`: Enforces ordered activation of triggers.
- `timer-trigger-system.ts`: Activates triggers after set delays.
