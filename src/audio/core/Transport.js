/**
 * @fileoverview Transport
 * Precise playback transport controller for a single audio source.
 * Tracks playback position, handles play/pause/seek/stop, and manages
 * the lifecycle of AudioBufferSourceNodes.
 */

export class Transport {
  /**
   * @param {AudioContext} audioContext - The shared AudioContext.
   * @param {Function} [onEnded] - Callback fired when playback reaches the end.
   */
  constructor(audioContext, onEnded) {
    this.audioContext = audioContext;
    this.onEnded = onEnded || (() => {});

    // Playback state
    this.isPlaying = false;
    this.isPaused = false;
    this.startedAt = 0;    // AudioContext time when current source started
    this.pausedAt = 0;     // Offset into the buffer when paused
    this.duration = 0;     // Total buffer duration

    // Source node reference (must be recreated after each stop)
    this.sourceNode = null;
    this.buffer = null;

    // Destination to connect the source to (e.g., FXChain input)
    this.destination = null;
  }

  /**
   * Load an AudioBuffer into the transport.
   * @param {AudioBuffer} audioBuffer - The decoded audio data.
   */
  loadBuffer(audioBuffer) {
    this.stop(); // Stop any active playback
    this.buffer = audioBuffer;
    this.duration = audioBuffer.duration;
    this.pausedAt = 0;
    this.isPlaying = false;
    this.isPaused = false;
  }

  /**
   * Set the output destination for the source node.
   * @param {AudioNode} destinationNode - Where to connect the source.
   */
  setDestination(destinationNode) {
    this.destination = destinationNode;
  }

  /**
   * Start or resume playback from the current position.
   * @param {number} [when] - AudioContext time to start (default: now).
   * @param {number} [offset] - Offset into buffer (default: pausedAt).
   * @param {number} [playbackRate=1.0] - Initial playback speed.
   */
  play(when, offset, playbackRate = 1.0) {
    if (!this.buffer || !this.destination) return;
    if (this.isPlaying) return; // Already playing

    const startTime = when ?? this.audioContext.currentTime;
    const startOffset = offset ?? this.pausedAt;

    // Create a fresh AudioBufferSourceNode (they can only be started once)
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.buffer;
    this.sourceNode.playbackRate.value = playbackRate;
    this.sourceNode.connect(this.destination);

    // Handle natural end of playback
    this.sourceNode.onended = () => {
      // Only fire if we reached the natural end, not a manual stop
      if (this.isPlaying && this.getCurrentTime() >= this.duration - 0.05) {
        this.isPlaying = false;
        this.isPaused = false;
        this.pausedAt = 0;
        this.onEnded();
      }
    };

    // Start playback
    this.sourceNode.start(startTime, startOffset);
    this.startedAt = startTime - startOffset;
    this.isPlaying = true;
    this.isPaused = false;
    this.pausedAt = 0;
  }

  /**
   * Pause playback. Stores the current offset for resume.
   */
  pause() {
    if (!this.isPlaying || !this.sourceNode) return;

    const currentOffset = this.getCurrentTime();
    this.sourceNode.stop();
    this.sourceNode.disconnect();
    this.sourceNode = null;

    this.isPlaying = false;
    this.isPaused = true;
    this.pausedAt = currentOffset;
  }

  /**
   * Stop playback completely and reset to the beginning.
   */
  stop() {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch (e) {
        // source may have already stopped
      }
      this.sourceNode = null;
    }

    this.isPlaying = false;
    this.isPaused = false;
    this.pausedAt = 0;
    this.startedAt = 0;
  }

  /**
   * Seek to a specific time in the buffer.
   * If playing, restarts seamlessly from the new position.
   * @param {number} time - Target time in seconds.
   */
  seek(time) {
    const clampedTime = Math.max(0, Math.min(time, this.duration));

    if (this.isPlaying) {
      // Seamless seek: stop current source and restart from new position
      this.sourceNode.stop();
      this.sourceNode.disconnect();
      this.pausedAt = clampedTime;
      this.play(undefined, clampedTime, this.getPlaybackRate());
    } else {
      this.pausedAt = clampedTime;
    }
  }

  /**
   * Get the current playback position in seconds.
   * @returns {number} Current time into the buffer.
   */
  getCurrentTime() {
    if (this.isPlaying) {
      return this.audioContext.currentTime - this.startedAt;
    }
    return this.pausedAt;
  }

  /**
   * Get playback progress as a percentage (0.0 - 1.0).
   * @returns {number}
   */
  getProgress() {
    if (this.duration === 0) return 0;
    return this.getCurrentTime() / this.duration;
  }

  /**
   * Get the current playback rate.
   * @returns {number}
   */
  getPlaybackRate() {
    return this.sourceNode?.playbackRate.value ?? 1.0;
  }

  /**
   * Smoothly ramp the playback rate to a new value.
   * @param {number} rate - Target playback rate.
   * @param {number} [rampDuration=1.0] - Ramp time in seconds.
   */
  setPlaybackRate(rate, rampDuration = 1.0) {
    if (this.sourceNode) {
      const now = this.audioContext.currentTime;
      this.sourceNode.playbackRate.setValueAtTime(this.sourceNode.playbackRate.value, now);
      this.sourceNode.playbackRate.exponentialRampToValueAtTime(Math.max(0.01, rate), now + rampDuration);
    }
  }

  /**
   * Get the remaining time in seconds.
   * @returns {number}
   */
  getRemainingTime() {
    return Math.max(0, this.duration - this.getCurrentTime());
  }

  /**
   * Clean up resources.
   */
  destroy() {
    this.stop();
    this.buffer = null;
    this.destination = null;
    this.onEnded = null;
  }
}

