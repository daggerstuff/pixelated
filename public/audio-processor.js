/**
 * AudioWorkletProcessor for real-time audio analysis
 * Handles audio data streams for analysis without storing any data permanently
 */
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super()

    // Circular buffer for more efficient memory usage
    this.ringBuffer = new Float32Array(2048)
    this.writeIndex = 0
    this.readIndex = 0

    // Analysis configuration
    this.analysisConfig = {
      processingInterval: 100, // Reduced from 500ms for more responsive analysis
      minBufferSize: 512, // Minimum samples needed for analysis
      maxBufferSize: 2048, // Maximum buffer size
      energyThreshold: 0.01, // Minimum energy level to trigger processing
    }

    this.lastProcessingTime = 0
    this.isProcessing = false

    // Initialize port message handler
    this.port.onmessage = this.handleMessage.bind(this)
  }

  handleMessage(event) {
    if (event.data.type === 'updateConfig') {
      Object.assign(this.analysisConfig, event.data.config)
    }
  }

  process(inputs, _outputs, _parameters) {
    const input = inputs[0]
    if (!input || !input.length) {
      return true
    }

    const inputChannel = input[0]
    if (!inputChannel) {
      return true
    }

    // Write new samples to ring buffer
    for (let i = 0; i < inputChannel.length; i++) {
      this.ringBuffer[this.writeIndex] = inputChannel[i]
      this.writeIndex = (this.writeIndex + 1) % this.ringBuffer.length
    }

    // Check if we should process data
    const currentTime = (currentFrame / sampleRate) * 1000
    const timeSinceLastProcess = currentTime - this.lastProcessingTime
    const bufferedSamples = this.getBufferedSampleCount()

    if (
      !this.isProcessing &&
      timeSinceLastProcess >= this.analysisConfig.processingInterval &&
      bufferedSamples >= this.analysisConfig.minBufferSize
    ) {
      // Check if audio energy exceeds threshold
      const energy = this.calculateEnergy(inputChannel)

      if (energy > this.analysisConfig.energyThreshold) {
        this.isProcessing = true

        // Extract data for processing
        const dataForAnalysis = this.extractBufferedData(
          Math.min(bufferedSamples, this.analysisConfig.maxBufferSize),
        )

        // Send data to main thread with metadata
        this.port.postMessage({
          type: 'audioData',
          data: dataForAnalysis,
          metadata: {
            timestamp: currentTime,
            energy,
            sampleRate,
            frameSize: dataForAnalysis.length,
          },
        })

        this.lastProcessingTime = currentTime
        this.isProcessing = false
      }
    }

    return true
  }

  calculateEnergy(samples) {
    let sum = 0
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i]
    }
    return Math.sqrt(sum / samples.length)
  }

  getBufferedSampleCount() {
    if (this.writeIndex >= this.readIndex) {
      return this.writeIndex - this.readIndex
    }
    return this.ringBuffer.length - this.readIndex + this.writeIndex
  }

  extractBufferedData(sampleCount) {
    const data = new Float32Array(sampleCount)
    let index = 0

    while (index < sampleCount) {
      data[index] = this.ringBuffer[this.readIndex]
      this.readIndex = (this.readIndex + 1) % this.ringBuffer.length
      index++
    }

    return data
  }
}

// Register the processor
registerProcessor('audio-processor', AudioProcessor)
!(function () {
  try {
    var e =
        'undefined' != typeof window
          ? window
          : 'undefined' != typeof global
            ? global
            : 'undefined' != typeof globalThis
              ? globalThis
              : 'undefined' != typeof self
                ? self
                : {},
      n = new e.Error().stack
    n &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[n] = 'd4df62f5-8102-57f4-b98f-792553d7d6d1'))
  } catch (e) {}
})()
//# debugId=d4df62f5-8102-57f4-b98f-792553d7d6d1
