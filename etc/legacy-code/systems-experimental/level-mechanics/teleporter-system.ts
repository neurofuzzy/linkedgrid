/**
 * Legacy Teleporter System - Re-exports from Portal System
 * 
 * This file maintains backwards compatibility with existing code.
 * All new code should use PortalSystem from the main systems directory.
 * 
 * @deprecated Use PortalSystem from '@basegrid/gameplay' instead
 */

export {
  PortalSystem as TeleporterSystem,
  PortalSystem
} from '../../../systems/level-mechanics/portal-system';
