/**
 * @fileoverview AudioContextManager
 * Singleton responsible for the Web Audio API AudioContext lifecycle.
 * Ensures only one context exists, handles browser autoplay policies,
 * and provides a central reference for all audio nodes.
 */

let instance = null;

export class AudioContextManager {
  /**
   * Private constructor. Use AudioContextManager.getInstance().
   */
  constructor() {
    if (instance) {
      throw new Error('[AudioContextManager] Use getInstance() instead of new.');
    }

    this.audioContext = null;
    this.state = 'closed'; // closed, suspended, running
    this.stateListeners = [];
  }

  /**
   * Get the singleton instance of AudioContextManager.
   * @returns {AudioContextManager}
   */
  static getInstance() {
    if (!instance) {
      instance = new AudioContextManager();
    }
    return instance;
  }

  /**
   * Initialize the AudioContext on first user gesture.
   * Browsers require user interaction before audio can play.
   * @returns {AudioContext} The initialized context.
   */
  init() {
    if (this.audioContext) {
      return this.audioContext;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('[AudioContextManager] Web Audio API not supported in this browser.');
    }

    this.audioContext = new AudioContextClass({
      latencyHint: 'interactive', // Optimize for low-latency playback
      sampleRate: 48000, // Prefer 48kHz for professional audio consistency
    });

    this.state = this.audioContext.state;

    // Listen for browser-imposed state changes (e.g., background tab suspension)
    this.audioContext.addEventListener('statechange', () => {
      this.state = this.audioContext.state;
      this._notifyStateChange(this.state);
    });

    return this.audioContext;
  }

  /**
   * Resume the AudioContext if it was suspended.
   * Must be called inside a user gesture handler (click/touch).
   * @returns {Promise<void>}
   */
  async resume() {
    if (!this.audioContext) {
      this.init();
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
      this.state = 'running';
    }
  }

  /**
   * Suspend the AudioContext to free CPU resources.
   * @returns {Promise<void>}
   */
  async suspend() {
    if (this.audioContext && this.audioContext.state === 'running') {
      await this.audioContext.suspend();
      this.state = 'suspended';
    }
  }

  /**
   * Close the AudioContext permanently.
   * @returns {Promise<void>}
   */
  async close() {
    if (this.audioContext) {
      await this.audioContext.close();
      this.state = 'closed';
      this.audioContext = null;
    }
  }

  /**
   * Get the current AudioContext.
   * @returns {AudioContext|null}
   */
  getContext() {
    return this.audioContext;
  }

  /**
   * Check if the context is currently running.
   * @returns {boolean}
   */
  isRunning() {
    return this.audioContext?.state === 'running';
  }

  /**
   * Get the current audio time in seconds.
   * This is the master clock for all scheduling.
   * @returns {number}
   */
  getCurrentTime() {
    return this.audioContext ? this.audioContext.currentTime : 0;
  }

  /**
   * Register a callback for state changes.
   * @param {Function} callback - Receives new state string.
   */
  onStateChange(callback) {
    this.stateListeners.push(callback);
  }

  /**
   * Remove a state change listener.
   * @param {Function} callback
   */
  offStateChange(callback) {
    this.stateListeners = this.stateListeners.filter((cb) => cb !== callback);
  }

  /**
   * @private
   */
  _notifyStateChange(newState) {
    this.stateListeners.forEach((cb) => {
      try {
        cb(newState);
      } catch (e) {
        console.error('[AudioContextManager] State listener error:', e);
      }
    });
  }

  /**
   * Reset the singleton (useful for testing or HMR).
   */
  static reset() {
    if (instance) {
      instance.close();
      instance = null;
    }
  }
}

/**
 * Convenience export for direct context access.
 * @returns {AudioContext|null}
 */
export const getAudioContext = () => AudioContextManager.getInstance().getContext();

