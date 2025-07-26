// Browser-compatible stub for Python bridge
export const MentalLLaMAPythonBridge = class {
  constructor() {
    console.warn('Python bridge not available in browser environment')
  }

  async initialize() {
    return false
  }

  isReady() {
    return false
  }

  async analyzeTextWithPythonModel() {
    throw new Error('Python bridge not available in browser environment')
  }

  async runIMHIEvaluation() {
    throw new Error('Python bridge not available in browser environment')
  }

  async shutdown() {
    // No-op
  }

  pythonBridgeDisabled = true
}
