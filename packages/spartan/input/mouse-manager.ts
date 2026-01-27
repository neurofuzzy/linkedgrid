/**
 * MouseManager - Simplified mouse input handling.
 * 
 * **Design principles**:
 * - Only tracks mouse state
 * - Converts pixel coordinates to grid coordinates
 * - Frame-based click detection (cleared after getState)
 * - Simple and focused on mouse events only
 * 
 * @example
 * ```typescript
 * const mouse = new MouseManager(canvas, { cellSize: 32, cellGap: 2 });
 * mouse.enable();
 * 
 * // In game loop
 * function tick() {
 *   const state = mouse.getState();
 *   if (state.leftClicked) {
 *     handleClick(state.gridX, state.gridY);
 *   }
 * }
 * ```
 */

/**
 * Configuration for MouseManager.
 */
export interface MouseConfig {
  /** Cell size in pixels for grid coordinate conversion (default: 16) */
  cellSize?: number;
  /** Gap between cells in pixels for grid coordinate conversion (default: 2) */
  cellGap?: number;
}

/**
 * Mouse state for a single frame.
 */
export interface MouseState {
  /** Grid X coordinate */
  gridX: number;
  /** Grid Y coordinate */
  gridY: number;
  
  /** Canvas pixel X coordinate */
  canvasX: number;
  /** Canvas pixel Y coordinate */
  canvasY: number;
  
  /** Left button is currently down */
  leftDown: boolean;
  /** Right button is currently down */
  rightDown: boolean;
  
  /** Left button was clicked this frame (cleared after getState) */
  leftClicked: boolean;
  
  /** Horizontal wheel delta this frame (cleared after getState) */
  wheelDeltaX: number;
  /** Vertical wheel delta this frame (cleared after getState) */
  wheelDeltaY: number;
}

/**
 * MouseManager - Handles mouse input with grid coordinate conversion.
 * 
 * Tracks mouse position, button states, and wheel events.
 * Automatically converts pixel coordinates to grid coordinates.
 */
export class MouseManager {
  private canvas: HTMLCanvasElement | null;
  private config: MouseConfig;
  private enabled = false;
  
  // Raw state
  private x = 0;
  private y = 0;
  private leftDown = false;
  private rightDown = false;
  private leftClicked = false;
  private wheelX = 0;
  private wheelY = 0;
  
  // Event listeners
  private boundMouseDown: ((e: MouseEvent) => void) | null = null;
  private boundMouseUp: ((e: MouseEvent) => void) | null = null;
  private boundMouseMove: ((e: MouseEvent) => void) | null = null;
  private boundContextMenu: ((e: Event) => void) | null = null;
  private boundWheel: ((e: WheelEvent) => void) | null = null;
  
  /**
   * Create a new MouseManager.
   * 
   * @param canvas - Canvas element for mouse events and coordinate conversion
   * @param config - Configuration options
   */
  constructor(canvas: HTMLCanvasElement | null, config: MouseConfig = {}) {
    this.canvas = canvas;
    this.config = {
      cellSize: config.cellSize ?? 16,
      cellGap: config.cellGap ?? 2,
    };
    
    if (canvas) {
      this.setupListeners();
    }
  }
  
  /**
   * Setup mouse event listeners.
   */
  private setupListeners(): void {
    if (!this.canvas) return;
    
    this.boundMouseDown = (e: MouseEvent) => {
      if (!this.enabled) return;
      
      if (e.button === 0) {
        this.leftDown = true;
        this.leftClicked = true;
      } else if (e.button === 2) {
        this.rightDown = true;
      }
    };
    
    this.boundMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        this.leftDown = false;
      } else if (e.button === 2) {
        this.rightDown = false;
      }
    };
    
    this.boundMouseMove = (e: MouseEvent) => {
      if (!this.enabled) return;
      
      const rect = this.canvas!.getBoundingClientRect();
      
      // Account for CSS scaling: convert from display size to canvas internal resolution
      const scaleX = this.canvas!.width / rect.width;
      const scaleY = this.canvas!.height / rect.height;
      
      this.x = (e.clientX - rect.left) * scaleX;
      this.y = (e.clientY - rect.top) * scaleY;
    };
    
    this.boundContextMenu = (e: Event) => {
      if (this.enabled) {
        e.preventDefault(); // Prevent right-click context menu
      }
    };
    
    this.boundWheel = (e: WheelEvent) => {
      if (!this.enabled) return;
      
      this.wheelX += e.deltaX;
      this.wheelY += e.deltaY;
    };
    
    this.canvas.addEventListener('mousedown', this.boundMouseDown);
    this.canvas.addEventListener('mousemove', this.boundMouseMove);
    this.canvas.addEventListener('contextmenu', this.boundContextMenu);
    this.canvas.addEventListener('wheel', this.boundWheel);
    // Attach mouseup to window to catch releases outside the canvas
    window.addEventListener('mouseup', this.boundMouseUp);
  }
  
  /**
   * Get current mouse state.
   * 
   * Converts pixel coordinates to grid coordinates and returns button/wheel states.
   * Clears frame-based events (clicked, wheel) after reading.
   * 
   * @returns MouseState with position and button states
   */
  getState(): MouseState {
    const cellTotal = this.config.cellSize! + this.config.cellGap!;
    
    const state: MouseState = {
      gridX: Math.floor(this.x / cellTotal),
      gridY: Math.floor(this.y / cellTotal),
      canvasX: this.x,
      canvasY: this.y,
      leftDown: this.leftDown,
      rightDown: this.rightDown,
      leftClicked: this.leftClicked,
      wheelDeltaX: this.wheelX,
      wheelDeltaY: this.wheelY,
    };
    
    // Clear frame-based events
    this.leftClicked = false;
    this.wheelX = 0;
    this.wheelY = 0;
    
    return state;
  }
  
  /**
   * Enable mouse input.
   */
  enable(): this {
    this.enabled = true;
    return this;
  }
  
  /**
   * Disable mouse input.
   */
  disable(): this {
    this.enabled = false;
    return this;
  }
  
  /**
   * Cleanup and remove event listeners.
   */
  destroy(): void {
    if (!this.canvas) return;
    
    if (this.boundMouseDown) {
      this.canvas.removeEventListener('mousedown', this.boundMouseDown);
      this.boundMouseDown = null;
    }
    if (this.boundMouseUp) {
      this.canvas.removeEventListener('mouseup', this.boundMouseUp);
      this.boundMouseUp = null;
    }
    if (this.boundMouseMove) {
      this.canvas.removeEventListener('mousemove', this.boundMouseMove);
      this.boundMouseMove = null;
    }
    if (this.boundContextMenu) {
      this.canvas.removeEventListener('contextmenu', this.boundContextMenu);
      this.boundContextMenu = null;
    }
    if (this.boundWheel) {
      this.canvas.removeEventListener('wheel', this.boundWheel);
      this.boundWheel = null;
    }
    
    // Clean up mouseup from window
    if (this.boundMouseUp) {
      window.removeEventListener('mouseup', this.boundMouseUp);
      this.boundMouseUp = null;
    }
  }
}
