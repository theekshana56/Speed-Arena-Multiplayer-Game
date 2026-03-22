import { useEffect, useRef, useCallback } from 'react';

/**
 *
 * @param {Function} callback - Function called each frame
 *   @param {number} deltaTime - Time since last frame in SECONDS
 *   @param {number} elapsedTime - Total time since loop started in SECONDS
 *   @param {number} frameCount - Number of frames rendered
 *
 * @param {Object} options - Configuration options
 *   @param {boolean} options.paused - Pause the loop
 *   @param {number} options.targetFps - Target frame rate (default 60)
 */
export function useGameLoop(callback, options = {}) {
  const { paused = false, targetFps = 60 } = options;

  // Refs to persist values across renders without causing re-renders
  const requestRef = useRef(null);
  const previousTimeRef = useRef(null);
  const startTimeRef = useRef(null);
  const frameCountRef = useRef(0);

  // Store callback in ref to avoid dependency issues
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  // Target frame duration (in ms)
  const targetFrameDuration = 1000 / targetFps;

  const animate = useCallback(
    (currentTime) => {
      // Initialize timing on first frame
      if (previousTimeRef.current === null) {
        previousTimeRef.current = currentTime;
        startTimeRef.current = currentTime;
        requestRef.current = requestAnimationFrame(animate);
        return;
      }

      // Calculate delta time in milliseconds
      const deltaTimeMs = currentTime - previousTimeRef.current;

      // Frame rate limiting: skip frame if too fast
      // (optional, but helps with high-refresh displays)
      if (deltaTimeMs < targetFrameDuration * 0.8) {
        requestRef.current = requestAnimationFrame(animate);
        return;
      }

      // Clamp delta time to prevent physics explosion on lag
      // Max 100ms (10 FPS minimum)
      const clampedDeltaMs = Math.min(deltaTimeMs, 100);

      // Convert to seconds for physics calculations
      const deltaTime = clampedDeltaMs / 1000;

      // Calculate elapsed time since start
      const elapsedTime = (currentTime - startTimeRef.current) / 1000;

      // Increment frame counter
      frameCountRef.current += 1;

      // Call the user's callback
      try {
        callbackRef.current(deltaTime, elapsedTime, frameCountRef.current);
      } catch (error) {
        console.error('Error in game loop callback:', error);
      }

      // Update previous time for next frame
      previousTimeRef.current = currentTime;

      // Schedule next frame
      requestRef.current = requestAnimationFrame(animate);
    },
    [targetFrameDuration]
  );

  // Start/stop the loop based on paused state
  useEffect(() => {
    if (paused) {
      // Stop the loop
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
      // Reset timing so delta is correct when resuming
      previousTimeRef.current = null;
    } else {
      // Start the loop
      requestRef.current = requestAnimationFrame(animate);
    }

    // Cleanup on unmount
    return () => {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [paused, animate]);

  // Return control functions and stats
  return {
    /**
     * Gets the current frame count.
     */
    getFrameCount: () => frameCountRef.current,

    /**
     * Resets the frame counter and timing.
     */
    reset: () => {
      frameCountRef.current = 0;
      previousTimeRef.current = null;
      startTimeRef.current = null;
    },

    /**
     * Gets whether the loop is currently running.
     */
    isRunning: () => requestRef.current !== null && !paused,
  };
}

/**
 * useAnimationFrame - Simplified hook for basic animation needs.
 * Just provides delta time without frame counting.
 *
 * @param {Function} callback - Function called each frame with deltaTime (seconds)
 * @param {boolean} paused - Whether to pause the loop
 */
export function useAnimationFrame(callback, paused = false) {
  const requestRef = useRef(null);
  const previousTimeRef = useRef(null);
  const callbackRef = useRef(callback);

  callbackRef.current = callback;

  useEffect(() => {
    if (paused) {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
        previousTimeRef.current = null;
      }
      return;
    }

    const animate = (time) => {
      if (previousTimeRef.current !== null) {
        const deltaTime = Math.min((time - previousTimeRef.current) / 1000, 0.1);
        callbackRef.current(deltaTime);
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [paused]);
}

/**
 * useFpsCounter - Hook to track and display FPS.
 * Updates every second with the average FPS.
 *
 * @returns {Object} { fps, frameTime }
 *   fps - Current frames per second
 *   frameTime - Average frame time in milliseconds
 */
export function useFpsCounter() {
  const fpsRef = useRef({ fps: 0, frameTime: 0 });
  const frameTimesRef = useRef([]);
  const lastUpdateRef = useRef(Date.now());

  const update = useCallback((deltaTime) => {
    // Store frame time
    const frameTimeMs = deltaTime * 1000;
    frameTimesRef.current.push(frameTimeMs);

    // Update FPS every second
    const now = Date.now();
    if (now - lastUpdateRef.current >= 1000) {
      const times = frameTimesRef.current;
      if (times.length > 0) {
        const avgFrameTime = times.reduce((a, b) => a + b, 0) / times.length;
        fpsRef.current = {
          fps: Math.round(1000 / avgFrameTime),
          frameTime: avgFrameTime.toFixed(2),
        };
      }
      frameTimesRef.current = [];
      lastUpdateRef.current = now;
    }
  }, []);

  return {
    fps: fpsRef.current.fps,
    frameTime: fpsRef.current.frameTime,
    update,
  };
}

/**
 * useGameTime - Hook to track game time with pause support.
 *
 * @param {boolean} paused - Whether the game is paused
 * @returns {Object} { elapsed, lap, reset }
 *   elapsed - Total elapsed time in seconds
 *   lap - Function to get lap time (resets elapsed)
 *   reset - Function to reset the timer
 */
export function useGameTime(paused = false) {
  const elapsedRef = useRef(0);
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (paused) return;

    let animationId;
    let lastTime = performance.now();

    const tick = (currentTime) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = currentTime;
        lastTime = currentTime;
      }

      const delta = (currentTime - lastTime) / 1000;
      elapsedRef.current += delta;
      lastTime = currentTime;

      animationId = requestAnimationFrame(tick);
    };

    animationId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationId);
  }, [paused]);

  return {
    get elapsed() {
      return elapsedRef.current;
    },
    lap: () => {
      const lapTime = elapsedRef.current;
      elapsedRef.current = 0;
      return lapTime;
    },
    reset: () => {
      elapsedRef.current = 0;
      startTimeRef.current = null;
    },
  };
}

export default useGameLoop;
