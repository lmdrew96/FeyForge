/**
 * AudioWorklet processor for ScribeCat transcription.
 *
 * Runs off the main thread. Downsamples from the browser's native AudioContext
 * sample rate (typically 44100 or 48000 Hz on mobile) to the target rate
 * (16000 Hz for AssemblyAI), then sends Int16 PCM chunks via the port.
 */
class AudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = options?.processorOptions || {};
    this._targetRate = opts.targetSampleRate || 16000;
    // `sampleRate` is a global in AudioWorkletGlobalScope — the actual context rate
    this._ratio = sampleRate / this._targetRate;
    this._phase = 0; // fractional position accumulator for resampling
    this._outputBuffer = [];
    this._chunkSize = 4096; // ~256 ms of audio at 16 kHz per send
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;
    const data = input[0]; // mono channel

    if (this._ratio === 1) {
      // Native rate already matches target — no resampling needed
      for (let i = 0; i < data.length; i++) {
        this._outputBuffer.push(data[i]);
      }
    } else {
      // Nearest-neighbor downsample with phase accumulator to avoid drift
      while (this._phase < data.length) {
        this._outputBuffer.push(data[Math.floor(this._phase)]);
        this._phase += this._ratio;
      }
      // Carry fractional remainder into the next block
      this._phase -= data.length;
    }

    // Flush complete chunks as transferable Int16 buffers
    while (this._outputBuffer.length >= this._chunkSize) {
      const chunk = this._outputBuffer.splice(0, this._chunkSize);
      const int16 = new Int16Array(this._chunkSize);
      for (let i = 0; i < this._chunkSize; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      // Transfer the buffer (zero-copy) to the main thread
      this.port.postMessage(int16.buffer, [int16.buffer]);
    }

    return true; // keep processor alive
  }
}

registerProcessor('audio-processor', AudioProcessor);
