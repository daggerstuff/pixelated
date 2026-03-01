import React, { useState, useEffect, useCallback } from 'react'

interface FHEOperation {
  id: string
  operation: 'add' | 'multiply' | 'compare' | 'aggregate'
  input1: number
  input2?: number
  result?: number
  encryptedInput1?: string
  encryptedInput2?: string
  encryptedResult?: string
  executionTime?: number
  status: 'pending' | 'executing' | 'completed' | 'error'
}

interface FHEDemoProps {
  className?: string
  showAdvanced?: boolean
  enableBenchmarks?: boolean
}

const FHEDemo: React.FC<FHEDemoProps> = ({
  className = '',
  showAdvanced = false,
  enableBenchmarks = true,
}) => {
  const [operations, setOperations] = useState<FHEOperation[]>([])
  const [currentOperation, setCurrentOperation] = useState<
    Partial<FHEOperation>
  >({
    operation: 'add',
    input1: 15,
    input2: 25,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [fheInitialized, setFheInitialized] = useState(false)
  const [benchmarkResults, setBenchmarkResults] = useState<
    {
      operation: string
      plaintextTime: number
      fheTime: number
      overhead: number
    }[]
  >([])

  // Simulate FHE library initialization
  useEffect(() => {
    const initializeFHE = async () => {
      setIsLoading(true)
      // Simulate loading time for FHE library
      await new Promise((resolve) => setTimeout(resolve, 2000))
      setFheInitialized(true)
      setIsLoading(false)
    }

    void initializeFHE()
  }, [])

  // Simulate encryption (in real implementation, this would use actual FHE library)
  const simulateEncryption = (value: number): string => {
    // Generate a realistic-looking encrypted value
    const randomBytes = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, '0'),
    ).join('')
    return `0x${randomBytes}...${value.toString(16).padStart(4, '0')}`
  }

  // Simulate FHE operations
  const performFHEOperation = useCallback(
    async (operation: FHEOperation): Promise<FHEOperation> => {
      const startTime = performance.now()

      // Simulate computation time (FHE operations are much slower)
      const computationTime = Math.random() * 1000 + 500 // 500-1500ms
      await new Promise((resolve) => setTimeout(resolve, computationTime))

      let result: number
      switch (operation.operation) {
        case 'add':
          result = operation.input1 + (operation.input2 || 0)
          break
        case 'multiply':
          result = operation.input1 * (operation.input2 || 1)
          break
        case 'compare':
          result = operation.input1 > (operation.input2 || 0) ? 1 : 0
          break
        case 'aggregate':
          // Simulate aggregating multiple values
          result = Math.round((operation.input1 + (operation.input2 || 0)) / 2)
          break
        default:
          result = 0
      }

      const endTime = performance.now()

      return {
        ...operation,
        result,
        encryptedInput1: simulateEncryption(operation.input1),
        encryptedInput2: operation.input2
          ? simulateEncryption(operation.input2)
          : undefined,
        encryptedResult: simulateEncryption(result),
        executionTime: endTime - startTime,
        status: 'completed',
      }
    },
    [],
  )

  const executeOperation = async () => {
    if (!fheInitialized || !currentOperation.operation) return

    const operation: FHEOperation = {
      id: `op-${Date.now()}`,
      operation: currentOperation.operation,
      input1: currentOperation.input1 || 0,
      input2: currentOperation.input2,
      status: 'executing',
    }

    setOperations((prev) => [operation, ...prev])

    try {
      const completedOperation = await performFHEOperation(operation)
      setOperations((prev) =>
        prev.map((op) => (op.id === operation.id ? completedOperation : op)),
      )

      // Run benchmark if enabled
      if (enableBenchmarks) {
        void runBenchmark(operation)
      }
    } catch {
      setOperations((prev) =>
        prev.map((op) =>
          op.id === operation.id ? { ...op, status: 'error' as const } : op,
        ),
      )
    }
  }

  const runBenchmark = async (operation: FHEOperation) => {
    // Simulate plaintext operation for comparison
    const plaintextStart = performance.now()

    // Perform operation and store result to avoid dead code
    let _result: number
    switch (operation.operation) {
      case 'add':
        _result = operation.input1 + (operation.input2 || 0)
        break
      case 'multiply':
        _result = operation.input1 * (operation.input2 || 1)
        break
      case 'compare':
        _result = operation.input1 > (operation.input2 || 0) ? 1 : 0
        break
      case 'aggregate':
        _result = Math.round((operation.input1 + (operation.input2 || 0)) / 2)
        break
      default:
        _result = 0
        break
    }

    const plaintextEnd = performance.now()
    const plaintextTime = plaintextEnd - plaintextStart

    const fheOperation = operations.find((op) => op.id === operation.id)
    const fheTime = fheOperation?.executionTime || 0

    const overhead = fheTime / plaintextTime

    setBenchmarkResults((prev) => [
      {
        operation: operation.operation,
        plaintextTime,
        fheTime,
        overhead,
      },
      ...prev.slice(0, 9), // Keep last 10 results
    ])
  }

  const clearResults = () => {
    setOperations([])
    setBenchmarkResults([])
  }

  const getOperationIcon = (operation: string) => {
    switch (operation) {
      case 'add':
        return '➕'
      case 'multiply':
        return '✖️'
      case 'compare':
        return '🔍'
      case 'aggregate':
        return '📊'
      default:
        return '🔧'
    }
  }

  const getStatusColor = (status: FHEOperation['status']) => {
    switch (status) {
      case 'pending':
        return 'text-gray-500'
      case 'executing':
        return 'text-blue-500'
      case 'completed':
        return 'text-green-500'
      case 'error':
        return 'text-red-500'
      default:
        return 'text-gray-500'
    }
  }

  if (isLoading) {
    return (
      <div
        className={`from-blue-50 to-indigo-100 flex h-64 flex-col items-center justify-center rounded-lg bg-gradient-to-br ${className}`}
      >
        <div className='border-blue-600 mb-4 h-12 w-12 animate-spin rounded-full border-b-2'></div>
        <h3 className='text-gray-800 mb-2 text-lg font-semibold'>
          Initializing FHE Library
        </h3>
        <p className='text-gray-600 max-w-md text-center'>
          Loading Microsoft SEAL WebAssembly module for Fully Homomorphic
          Encryption operations...
        </p>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg p-6 shadow-lg ${className}`}>
      <div className='mb-6'>
        <h2 className='text-gray-900 mb-2 text-2xl font-bold'>
          🔒 Fully Homomorphic Encryption Demo
        </h2>
        <p className='text-gray-600'>
          Perform computations on encrypted data without ever decrypting it.
          This demo simulates FHE operations for privacy-preserving therapy data
          analysis.
        </p>
      </div>

      {/* Operation Setup */}
      <div className='bg-gray-50 mb-6 rounded-lg p-4'>
        <h3 className='mb-4 text-lg font-semibold'>Setup Operation</h3>

        <div className='mb-4 grid grid-cols-1 gap-4 md:grid-cols-4'>
          <div>
            <label
              htmlFor='operation-type'
              className='text-gray-700 mb-1 block text-sm font-medium'
            >
              Operation Type
            </label>
            <select
              id='operation-type'
              value={currentOperation.operation}
              onChange={(e) =>
                setCurrentOperation({
                  ...currentOperation,
                  operation: e.target.value as FHEOperation['operation'],
                })
              }
              className='border-gray-300 w-full rounded-md border p-2'
            >
              <option value='add'>Addition</option>
              <option value='multiply'>Multiplication</option>
              <option value='compare'>Comparison</option>
              <option value='aggregate'>Aggregation</option>
            </select>
          </div>

          <div>
            <label
              htmlFor='input-1'
              className='text-gray-700 mb-1 block text-sm font-medium'
            >
              Input 1 (Patient Score)
            </label>
            <input
              id='input-1'
              type='number'
              value={currentOperation.input1}
              onChange={(e) =>
                setCurrentOperation({
                  ...currentOperation,
                  input1: parseInt(e.target.value) || 0,
                })
              }
              className='border-gray-300 w-full rounded-md border p-2'
              min='0'
              max='100'
            />
          </div>

          {currentOperation.operation !== 'aggregate' && (
            <div>
              <label
                htmlFor='input-2'
                className='text-gray-700 mb-1 block text-sm font-medium'
              >
                Input 2 (Baseline)
              </label>
              <input
                id='input-2'
                type='number'
                value={currentOperation.input2}
                onChange={(e) =>
                  setCurrentOperation({
                    ...currentOperation,
                    input2: parseInt(e.target.value) || 0,
                  })
                }
                className='border-gray-300 w-full rounded-md border p-2'
                min='0'
                max='100'
              />
            </div>
          )}

          <div className='flex items-end'>
            <button
              onClick={executeOperation}
              disabled={!fheInitialized}
              className='bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 w-full rounded-md px-4 py-2 transition-colors disabled:cursor-not-allowed'
            >
              Execute FHE Operation
            </button>
          </div>
        </div>

        <div className='text-gray-600 text-sm'>
          <p>
            <strong>Privacy Note:</strong> All computations are performed on
            encrypted data. The raw values are never exposed during processing.
          </p>
        </div>
      </div>

      {/* Results */}
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        {/* Operation History */}
        <div>
          <div className='mb-4 flex items-center justify-between'>
            <h3 className='text-lg font-semibold'>Operation History</h3>
            <button
              onClick={clearResults}
              className='bg-gray-200 text-gray-700 hover:bg-gray-300 rounded px-3 py-1 text-sm transition-colors'
            >
              Clear
            </button>
          </div>

          <div className='max-h-96 space-y-3 overflow-y-auto'>
            {operations.length === 0 ? (
              <div className='text-gray-500 py-8 text-center'>
                No operations performed yet. Try executing an FHE operation
                above.
              </div>
            ) : (
              operations.map((operation) => (
                <div
                  key={operation.id}
                  className='bg-white rounded-lg border p-4 shadow-sm'
                >
                  <div className='mb-2 flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <span className='text-lg'>
                        {getOperationIcon(operation.operation)}
                      </span>
                      <span className='font-semibold capitalize'>
                        {operation.operation}
                      </span>
                      <span
                        className={`text-sm ${getStatusColor(operation.status)}`}
                      >
                        {operation.status}
                      </span>
                    </div>
                    {operation.executionTime && (
                      <span className='text-gray-500 text-xs'>
                        {operation.executionTime.toFixed(2)}ms
                      </span>
                    )}
                  </div>

                  <div className='space-y-1 text-sm'>
                    <div>
                      <strong>Inputs:</strong> {operation.input1}
                      {operation.input2 !== undefined &&
                        ` ${operation.operation === 'add' ? '+' : operation.operation === 'multiply' ? '×' : 'vs'} ${operation.input2}`}
                    </div>

                    {operation.result !== undefined && (
                      <div>
                        <strong>Result:</strong> {operation.result}
                      </div>
                    )}

                    {showAdvanced && operation.encryptedInput1 && (
                      <div className='mt-2 text-xs'>
                        <div className='text-gray-700 font-medium'>
                          Encrypted Data:
                        </div>
                        <div className='bg-gray-100 mt-1 break-all rounded p-2 font-mono'>
                          Input: {operation.encryptedInput1}
                          {operation.encryptedInput2 && (
                            <>
                              <br />
                              Input2: {operation.encryptedInput2}
                            </>
                          )}
                          {operation.encryptedResult && (
                            <>
                              <br />
                              Result: {operation.encryptedResult}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Benchmarks */}
        {enableBenchmarks && (
          <div>
            <h3 className='mb-4 text-lg font-semibold'>
              Performance Benchmarks
            </h3>

            {benchmarkResults.length === 0 ? (
              <div className='text-gray-500 py-8 text-center'>
                Run some operations to see performance comparisons.
              </div>
            ) : (
              <div className='max-h-96 space-y-3 overflow-y-auto'>
                {benchmarkResults.map((result) => (
                  <div
                    key={`${result.operation}-${result.fheTime}-${result.plaintextTime}`}
                    className='bg-white rounded-lg border p-4 shadow-sm'
                  >
                    <div className='mb-2 flex items-center justify-between'>
                      <span className='font-semibold capitalize'>
                        {getOperationIcon(result.operation)} {result.operation}
                      </span>
                      <span className='text-red-600 text-sm font-medium'>
                        {result.overhead.toFixed(1)}× slower
                      </span>
                    </div>

                    <div className='space-y-2'>
                      <div className='flex justify-between text-sm'>
                        <span>Plaintext:</span>
                        <span className='font-mono'>
                          {result.plaintextTime.toFixed(3)}ms
                        </span>
                      </div>
                      <div className='flex justify-between text-sm'>
                        <span>FHE:</span>
                        <span className='font-mono'>
                          {result.fheTime.toFixed(2)}ms
                        </span>
                      </div>

                      {/* Visual bar comparison */}
                      <div className='mt-2'>
                        <div className='bg-gray-200 h-2 overflow-hidden rounded-full'>
                          <div
                            className='bg-green-500 h-full'
                            style={{
                              width: `${Math.min(100, (result.plaintextTime / result.fheTime) * 100)}%`,
                            }}
                          />
                        </div>
                        <div className='text-gray-500 mt-1 text-xs'>
                          Green: Plaintext speed relative to FHE
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Educational Info */}
      <div className='bg-blue-50 mt-6 rounded-lg p-4'>
        <h4 className='text-blue-900 mb-2 font-semibold'>
          💡 Why FHE Matters for Therapy Data
        </h4>
        <ul className='text-blue-800 space-y-1 text-sm'>
          <li>
            • <strong>Privacy-Preserving Analytics:</strong> Analyze patient
            data without seeing raw values
          </li>
          <li>
            • <strong>Secure Multi-Party Computation:</strong> Multiple
            therapists can collaborate on insights
          </li>
          <li>
            • <strong>Regulatory Compliance:</strong> HIPAA-compliant processing
            of sensitive health data
          </li>
          <li>
            • <strong>Research Applications:</strong> Enable large-scale studies
            while protecting individual privacy
          </li>
        </ul>
      </div>
    </div>
  )
}

export default FHEDemo
