export default () => {
  class BufferedAudioWorkletProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this.bufferQueue = [];
      this.currentChunkOffset = 0;
      this.hadData = false;

      this.port.onmessage = (event) => {
        const data = event.data;
        if (data instanceof Float32Array) {
          this.hadData = true;
          this.bufferQueue.push(data);
        } else if (data === "stop") {
          this.bufferQueue = [];
          this.currentChunkOffset = 0;
        }
      };
    }

    process(inputs, outputs) {
      const channel = outputs[0][0];
      if (!channel) return true;

      const numSamples = channel.length;
      let outputIndex = 0;

      if (this.hadData && this.bufferQueue.length === 0) {
        this.port.postMessage({ type: "playback_ended" });
        this.hadData = false;
      }

      while (outputIndex < numSamples) {
        if (this.bufferQueue.length > 0) {
          const currentChunk = this.bufferQueue[0];
          const remainingSamples =
            currentChunk.length - this.currentChunkOffset;
          const samplesToCopy = Math.min(
            remainingSamples,
            numSamples - outputIndex,
          );

          channel.set(
            currentChunk.subarray(
              this.currentChunkOffset,
              this.currentChunkOffset + samplesToCopy,
            ),
            outputIndex,
          );

          this.currentChunkOffset += samplesToCopy;
          outputIndex += samplesToCopy;

          // Remove the chunk if fully consumed.
          if (this.currentChunkOffset >= currentChunk.length) {
            this.bufferQueue.shift();
            this.currentChunkOffset = 0;
          }
        } else {
          // If no data is available, fill the rest of the buffer with silence.
          channel.fill(0, outputIndex);
          outputIndex = numSamples;
        }
      }
      return true;
    }
  }

  registerProcessor(
    "buffered-audio-worklet-processor",
    BufferedAudioWorkletProcessor,
  );
};
