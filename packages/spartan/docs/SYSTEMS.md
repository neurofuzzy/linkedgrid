# Spartan Systems Reference

This document describes the behavior and configuration of all core game systems.

---

## PlayerInputSystem
**Purpose**: Translates player input into movement intents.  
**Execution Phase**: `input`  
**Tick Rate**: 1  
**Dependencies**: None  

---

## DoorSystem
**Purpose**: Unlocks doors when player has matching key.  
**Execution Phase**: `pre-commit`  
**Tick Rate**: 1  
**Dependencies**: `SpatialSystem`  

---

## CollectionSystem
**Purpose**: Handles picking up collectible items.  
**Execution Phase**: `post-commit`  
**Tick Rate**: 1  
**Dependencies**: `SpatialSystem`  

---

## FireSystem
**Purpose**: Spreads fire, applies temperature logic, and consumes fuel.  
**Execution Phase**: `main`  
**Tick Rate**: 1  
**Dependencies**: `SpatialSystem`  

---

## LiquidSystem
**Purpose**: Simulates volumetric liquid flow and depth diffusion.  
**Execution Phase**: `main`  
**Tick Rate**: 1  
**Dependencies**: `SpatialSystem`  

---

## PoisonSystem
**Purpose**: Handles density-based gas dispersion and damage application.  
**Execution Phase**: `main`  
**Tick Rate**: 1  
**Dependencies**: `SpatialSystem`  

---

## ExplosionSystem
**Purpose**: Processes chain explosions and destructive force.  
**Execution Phase**: `main`  
**Tick Rate**: 1  
**Dependencies**: `SpatialSystem`  

---

## FloorEffectSystem
**Purpose**: Applies generic floor effects (damage/healing) based on presence.  
**Execution Phase**: `main`  
**Tick Rate**: 1  
**Dependencies**: `SpatialSystem`  

---

## TeleporterSystem
**Purpose**: Handles player teleportation between scenes.  
**Execution Phase**: `post-commit`  
**Tick Rate**: 1  
**Dependencies**: `SpatialSystem`  

---

## ChainReactionSystem
**Purpose**: Handles domino-like chain reactions.  
**Execution Phase**: `main`  
**Tick Rate**: 1  
**Dependencies**: `SpatialSystem`  
