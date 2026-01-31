import { SpatialSystem } from '../core/spatial-system';
import { Layer } from '../core/types';

/**
 * Test fixture helper for setting up initial spatial state.
 *
 * Operations auto-commit for convenience during test setup.
 * Use this for arranging test state, not for testing spatial behavior.
 *
 * @example
 * ```typescript
 * const fixture = new TestSpatialFixture(spatial, 'test-scene');
 *
 * // Place entities with auto-commit and auto-added sceneId
 * const playerId = fixture.placeEntity('player', 5, 5, GameLayers.ACTORS);
 * const enemyId = fixture.placeEntity('enemy', 10, 10, GameLayers.ACTORS);
 *
 * // Now test actual spatial behavior
 * spatial.move(playerId, 6, 5);
 * spatial.commit();
 * // ...assertions...
 * ```
 */
export class TestSpatialFixture {
  constructor(
    private spatial: SpatialSystem,
    private sceneId?: string
  ) {}

  /**
   * Place entity and auto-commit.
   *
   * Use this for test setup, not for testing spatial behavior.
   * Automatically adds sceneId to props if one was provided in constructor.
   *
   * @param type - Entity type
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param layer - Layer
   * @param props - Optional entity properties
   * @returns Entity ID
   */
  placeEntity(
    type: string,
    x: number,
    y: number,
    layer: Layer,
    props?: object
  ): number {
    const entityProps = this.sceneId
      ? { ...props, sceneId: this.sceneId }
      : props;
    const id = this.spatial.spawn(type, x, y, layer, entityProps);
    this.spatial.commit();
    return id;
  }

  /**
   * Remove entity and auto-commit.
   *
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param layer - Layer
   */
  removeEntity(x: number, y: number, layer: Layer): void {
    this.spatial.removeAt(x, y, layer);
    this.spatial.commit();
  }

  /**
   * Move entity and auto-commit.
   *
   * @param fromX - Source X
   * @param fromY - Source Y
   * @param toX - Destination X
   * @param toY - Destination Y
   * @param layer - Layer
   */
  moveEntity(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    layer: Layer
  ): void {
    const entityId = this.spatial.getEntityIdAt(fromX, fromY, layer);
    if (entityId) {
      this.spatial.move(entityId, toX, toY);
    }
    this.spatial.commit();
  }
}
