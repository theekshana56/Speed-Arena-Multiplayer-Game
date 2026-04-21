/**
 * inputHandler.js - Keyboard Input Handler for Racing Game
 *
 * Handles WASD and Arrow key inputs for car control.
 * Provides both:
 * 1. Direct polling (check what keys are currently pressed)
 * 2. Callback-based input (get notified when input state changes)
 *
 * Supported Controls:
 * ─────────────────────────────────────────────────────────────────────────────
 * ACCELERATE: W or ArrowUp
 * BRAKE:      S or ArrowDown
 * TURN LEFT:  A or ArrowLeft
 * TURN RIGHT: D or ArrowRight
 * HANDBRAKE:  Space (drift/emergency brake)
 */

// ─── Key Mappings ───────────────────────────────────────────────────────────

/**
 * Maps key codes to game actions.
 */
export const KEY_ACTIONS = {
  // Accelerate
  KeyW: 'accelerate',
  ArrowUp: 'accelerate',

  // Brake and Reverse
  KeyS: 'brake',
  ArrowDown: 'brake',

  // Turn Left
  KeyA: 'turnLeft',
  ArrowLeft: 'turnLeft',

  // Turn Right
  KeyD: 'turnRight',
  ArrowRight: 'turnRight',

  // Handbrake (drift)
  Space: 'handbrake',
};

/**
 * Set of all keys we care about (for quick lookup).
 */
export const GAME_KEYS = new Set(Object.keys(KEY_ACTIONS));

// ─── Input State Class ──────────────────────────────────────────────────────

/**
 * InputHandler - Manages keyboard input state.
 *
 * Usage:
 * const input = new InputHandler();
 * input.attach(); // Start listening
 *
 * // In game loop:
 * updateCarPhysics(car, input.getState(), deltaTime);
 *
 * // When done:
 * input.detach();
 */
export class InputHandler {
  constructor(options = {}) {
    // Input state
    this.state = {
      accelerate: false,
      brake: false,
      turnLeft: false,
      turnRight: false,
      handbrake: false,
    };

    // Raw key state (track individual keys)
    this.keysPressed = new Set();

    // Options
    this.preventDefaults = options.preventDefaults !== false; // Default true
    this.target = options.target || (typeof window !== 'undefined' ? window : null);

    // Sequence number for input packets
    this.inputSequence = 0;

    // Callbacks
    this.onInputChange = options.onInputChange || null;

    // Bind methods to ensure correct 'this' context
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleBlur = this.handleBlur.bind(this);

    // Track if attached
    this.isAttached = false;
  }

  /**
   * Attaches event listeners to the target (usually window).
   * Call this when the game component mounts.
   */
  attach() {
    if (this.isAttached || !this.target) return;

    this.target.addEventListener('keydown', this.handleKeyDown);
    this.target.addEventListener('keyup', this.handleKeyUp);
    this.target.addEventListener('blur', this.handleBlur);

    this.isAttached = true;
  }

  /**
   * Detaches event listeners.
   * Call this when the game component unmounts.
   */
  detach() {
    if (!this.isAttached || !this.target) return;

    this.target.removeEventListener('keydown', this.handleKeyDown);
    this.target.removeEventListener('keyup', this.handleKeyUp);
    this.target.removeEventListener('blur', this.handleBlur);

    // Reset state
    this.reset();

    this.isAttached = false;
  }

  /**
   * Handles keydown events.
   */
  handleKeyDown(event) {
    // Ignore if key isn't a game key
    if (!GAME_KEYS.has(event.code)) return;

    // Prevent default browser behavior (scrolling, etc.)
    if (this.preventDefaults) {
      event.preventDefault();
    }

    // Ignore if already pressed (key repeat)
    if (this.keysPressed.has(event.code)) return;

    // Mark key as pressed
    this.keysPressed.add(event.code);

    // Update state
    const action = KEY_ACTIONS[event.code];
    const oldState = { ...this.state };
    this.state[action] = true;

    // Increment sequence and notify
    this.inputSequence++;

    if (this.onInputChange && !this.statesEqual(oldState, this.state)) {
      this.onInputChange(this.state, this.inputSequence);
    }
  }

  /**
   * Handles keyup events.
   */
  handleKeyUp(event) {
    // Ignore if key isn't a game key
    if (!GAME_KEYS.has(event.code)) return;

    if (this.preventDefaults) {
      event.preventDefault();
    }

    // Remove from pressed set
    this.keysPressed.delete(event.code);

    // Update state - but check if another key for same action is still pressed
    const action = KEY_ACTIONS[event.code];
    const stillPressed = this.isActionStillPressed(action);

    const oldState = { ...this.state };
    this.state[action] = stillPressed;

    // Increment sequence and notify
    this.inputSequence++;

    if (this.onInputChange && !this.statesEqual(oldState, this.state)) {
      this.onInputChange(this.state, this.inputSequence);
    }
  }

  /**
   * Handles window blur (tab switch, etc.) - release all keys.
   */
  handleBlur() {
    const hadInput = this.hasInput();
    this.reset();

    if (hadInput && this.onInputChange) {
      this.inputSequence++;
      this.onInputChange(this.state, this.inputSequence);
    }
  }

  /**
   * Checks if an action is still pressed by another key.
   * (e.g., W is released but ArrowUp is still held)
   */
  isActionStillPressed(action) {
    for (const key of this.keysPressed) {
      if (KEY_ACTIONS[key] === action) {
        return true;
      }
    }
    return false;
  }

  /**
   * Gets the current input state (for polling).
   * Returns a new object each time to avoid mutation issues.
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Gets the current input sequence number.
   */
  getSequence() {
    return this.inputSequence;
  }

  /**
   * Checks if any input is currently active.
   */
  hasInput() {
    return this.state.accelerate || this.state.brake || this.state.turnLeft || this.state.turnRight || this.state.handbrake;
  }

  /**
   * Resets all input state.
   */
  reset() {
    this.keysPressed.clear();
    this.state.accelerate = false;
    this.state.brake = false;
    this.state.turnLeft = false;
    this.state.turnRight = false;
    this.state.handbrake = false;
  }

  /**
   * Compares two input states for equality.
   */
  statesEqual(a, b) {
    return (
      a.accelerate === b.accelerate &&
      a.brake === b.brake &&
      a.turnLeft === b.turnLeft &&
      a.turnRight === b.turnRight &&
      a.handbrake === b.handbrake
    );
  }

  /**
   * Gets a compact string representation of current input.
   * Useful for debugging.
   */
  toString() {
    const keys = [];
    if (this.state.accelerate) keys.push('W');
    if (this.state.brake) keys.push('S');
    if (this.state.turnLeft) keys.push('A');
    if (this.state.turnRight) keys.push('D');
    if (this.state.handbrake) keys.push('SPACE');
    return keys.length > 0 ? keys.join('+') : 'none';
  }
}

// ─── React Hook Version ─────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useInput - React hook for handling game input.
 *
 * @param {Object} options
 *   @param {boolean} options.enabled - Whether input handling is enabled
 *   @param {Function} options.onInputChange - Callback when input changes
 *
 * @returns {Object}
 *   @property {Object} input - Current input state
 *   @property {number} sequence - Current input sequence number
 *   @property {boolean} hasInput - Whether any input is active
 *   @property {Function} reset - Reset input state
 */
export function useInput(options = {}) {
  const { enabled = true, onInputChange } = options;

  const [input, setInput] = useState({
    accelerate: false,
    brake: false,
    turnLeft: false,
    turnRight: false,
    handbrake: false,
  });

  const sequenceRef = useRef(0);
  const onInputChangeRef = useRef(onInputChange);
  onInputChangeRef.current = onInputChange;

  // Handle input state changes
  const handleInputChange = useCallback((newState, sequence) => {
    setInput(newState);
    sequenceRef.current = sequence;

    if (onInputChangeRef.current) {
      onInputChangeRef.current(newState, sequence);
    }
  }, []);

  // Create and manage InputHandler
  const handlerRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      if (handlerRef.current) {
        handlerRef.current.detach();
      }
      return;
    }

    const handler = new InputHandler({
      onInputChange: handleInputChange,
    });

    handler.attach();
    handlerRef.current = handler;

    return () => {
      handler.detach();
    };
  }, [enabled, handleInputChange]);

  // Reset function
  const reset = useCallback(() => {
    if (handlerRef.current) {
      handlerRef.current.reset();
      setInput({
        accelerate: false,
        brake: false,
        turnLeft: false,
        turnRight: false,
        handbrake: false,
      });
    }
  }, []);

  return {
    input,
    sequence: sequenceRef.current,
    hasInput: input.accelerate || input.brake || input.turnLeft || input.turnRight || input.handbrake,
    reset,
    handler: handlerRef.current,
  };
}

// ─── Singleton Instance for Simple Usage ────────────────────────────────────

let globalInputHandler = null;

/**
 * Gets the global input handler instance.
 * Creates one if it doesn't exist.
 */
export function getInputHandler() {
  if (!globalInputHandler) {
    globalInputHandler = new InputHandler();
  }
  return globalInputHandler;
}

/**
 * Initializes the global input handler.
 * Call this once when the game starts.
 */
export function initInputHandler(options = {}) {
  if (globalInputHandler) {
    globalInputHandler.detach();
  }
  globalInputHandler = new InputHandler(options);
  globalInputHandler.attach();
  return globalInputHandler;
}

/**
 * Cleans up the global input handler.
 * Call this when the game ends.
 */
export function cleanupInputHandler() {
  if (globalInputHandler) {
    globalInputHandler.detach();
    globalInputHandler = null;
  }
}

export default InputHandler;
