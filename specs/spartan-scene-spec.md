# Scene & State Management Specification

## Core Principle
**Separation of Concerns**: Global game state (inventory, score, lives) is decoupled from spatial state (entity positions in scenes).

## Data Model

### GameState (Global, Scene-Independent)
- **lives**: number
- **score**: number
- **inventory**: key-value pairs (e.g., `{ 'key': 3, 'coin': 50 }`)
- **buffs**: temporary effects with expiration timestamps
- **upgrades**: permanent abilities (Set)
- **flags**: boolean switches (e.g., `{ 'boss_defeated': true }`)
- **data**: arbitrary game-specific data
- **connections**: cross-scene entity references (Map of key → array of entity locations)

### Scene (Spatial, Scene-Specific)
- **id**: unique identifier
- **grid**: LinkedGrid instance
- **spatial**: SpatialSystem instance
- **store**: SparseEntityStore instance
- **metadata**: scene-specific data (name, music, etc.)
- **playerPosition**: optional `{x, y, layer, entityId}` if player is in this scene

### SceneManager
- Maintains Map of sceneId → Scene
- Tracks activeSceneId
- Methods: createScene, getScene, setActiveScene, getAllSceneIds, deleteScene

### GameManager (Top-Level Container)
- **gameState**: GameState instance
- **sceneManager**: SceneManager instance

## Cross-Scene Connections

Generic connection system using string keys:
- `connections` maps a key to array of `{sceneId, x, y, layer}` references
- Use case: teleporters by color (`'teleporter:red'`), switches linked to doors (`'switch:A'`), etc.
- Methods: addConnection, getConnections, removeConnection

## Player Model

**Player is just another entity in the spatial system.**
- Position/sprite state stored in Scene's spatial system
- Inventory/lives/score stored in GameState
- When changing scenes: remove player entity from old scene, spawn in new scene
- playerPosition in Scene tracks where player is (if present)

## Scene Persistence

**All scene state persists automatically.**
- Collected items stay collected
- Opened doors stay open
- Defeated enemies stay defeated
- Scene state only changes when actively modified

## Serialization

### SaveData Structure
- version: number
- timestamp: number
- gameState: serialized GameState (Set → Array, Map → Array of tuples)
- scenes: array of serialized scenes (sparse cell data + entity data)
- activeSceneId: string | null

### Scene Serialization
- Only serialize cells with data (sparse representation)
- Entity store serialized as array of `{id, type, data}`
- Grid dimensions and metadata included

## Key Design Decisions

1. **No special player entity** - player is spatial, state is global
2. **Inventory/score persists across scenes** - in GameState
3. **Scenes don't reset** - state persists unless explicitly cleared
4. **Generic connections** - use string keys for any cross-scene references
5. **Single active scene** - only one scene rendered/updated at a time
6. **Scene-independent progression** - lives/upgrades/flags in GameState