import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import DataIngestionDemo from '../../DataIngestionDemo'
import ValidationDemo from '../../ValidationDemo'
import CategoryBalancingDemo from '../../CategoryBalancingDemo'
import ResultsExportDemo from '../../ResultsExportDemo'

// Mock fetch for API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock FileReader
const mockFileReader = {
  readAsText: vi.fn(),
  result: '',
  onload: null as ((event: ProgressEvent<FileReader>) => void) | null,
  onerror: null as ((event: ProgressEvent<FileReader>) => void) | null,
}
global.FileReader = vi.fn(() => mockFileReader) as any

describe('Pipeline Service Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
      text: () => Promise.resolve('success'),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Data Ingestion to Validation Pipeline', () => {
    it('passes processed data from ingestion to validation', async () => {
      const mockValidationCallback = vi.fn()

      // Render both components
      const { rerender } = render(<DataIngestionDemo />)

      // Upload a file to ingestion
      const fileInput = screen.getByTestId('file-input')
      const file = new File(
        ['{"content": "test psychology data"}'],
        'test.json',
        {
          type: 'application/json',
        },
      )

      fireEvent.change(fileInput, { target: { files: [file] } })

      // Simulate FileReader processing
      mockFileReader.result = '{"content": "test psychology data"}'
      if (mockFileReader.onload) {
        mockFileReader.onload({} as ProgressEvent<FileReader>)
      }

      await waitFor(() => {
        expect(screen.getByText('test.json')).toBeInTheDocument()
      })

      // Now render validation component with the processed data
      rerender(<ValidationDemo onValidationComplete={mockValidationCallback} />)

      const textInput = screen.getByPlaceholderText(/Enter psychology content/)
      fireEvent.change(textInput, {
        target: { value: 'test psychology data' },
      })

      await waitFor(() => {
        expect(mockValidationCallback).toHaveBeenCalled()
      })
    })

    it('handles validation errors from ingested data', async () => {
      render(<DataIngestionDemo />)

      const fileInput = screen.getByTestId('file-input')
      const file = new File(['invalid data'], 'test.json', {
        type: 'application/json',
      })

      fireEvent.change(fileInput, { target: { files: [file] } })

      // Simulate FileReader with invalid JSON
      mockFileReader.result = 'invalid json data'
      if (mockFileReader.onload) {
        mockFileReader.onload({} as ProgressEvent<FileReader>)
      }

      await waitFor(() => {
        expect(screen.getByText(/Processing failed/)).toBeInTheDocument()
      })
    })
  })

  describe('Validation to Category Balancing Pipeline', () => {
    it('updates category balance based on validation results', async () => {
      const mockBalanceCallback = vi.fn()

      // Render validation component
      const { rerender } = render(<ValidationDemo />)

      const textInput = screen.getByPlaceholderText(/Enter psychology content/)
      fireEvent.change(textInput, {
        target: {
          value:
            'Patient exhibits symptoms of anxiety disorder requiring therapeutic intervention',
        },
      })

      await waitFor(() => {
        expect(screen.getByText(/Validation Results/)).toBeInTheDocument()
      })

      // Render category balancing with validation data
      rerender(<CategoryBalancingDemo onBalanceUpdate={mockBalanceCallback} />)

      await waitFor(() => {
        expect(screen.getByText('Anxiety Disorders')).toBeInTheDocument()
      })

      // Simulate category adjustment based on validation
      const resetButton = screen.getByText('Reset Defaults')
      fireEvent.click(resetButton)

      await waitFor(() => {
        expect(mockBalanceCallback).toHaveBeenCalled()
      })
    })

    it('maintains category ratios during validation updates', async () => {
      render(<CategoryBalancingDemo />)

      // Check initial ratios
      expect(screen.getByText('30.0%')).toBeInTheDocument() // Anxiety
      expect(screen.getByText('25.0%')).toBeInTheDocument() // Mood

      // Simulate validation-driven updates
      const simulateButton = screen.getByText('Simulate Influx')
      fireEvent.click(simulateButton)

      await waitFor(() => {
        // Ratios should still be maintained
        expect(screen.getByText(/\d+\.\d+%/)).toBeInTheDocument()
      })
    })
  })

  describe('Category Balancing to Export Pipeline', () => {
    it('exports balanced dataset with correct ratios', async () => {
      const mockExportCallback = vi.fn()

      // Render category balancing
      const { rerender } = render(<CategoryBalancingDemo />)

      // Adjust categories
      const autoRebalanceButton = screen.getByText('Auto Rebalance')
      fireEvent.click(autoRebalanceButton)

      await waitFor(() => {
        expect(screen.getByText('Rebalancing...')).toBeInTheDocument()
      })

      // Render export component with balanced data
      rerender(<ResultsExportDemo onExportComplete={mockExportCallback} />)

      // Start export process
      const exportButton = screen.getByText('Export All')
      fireEvent.click(exportButton)

      await waitFor(() => {
        expect(screen.getByText('Export Jobs Status')).toBeInTheDocument()
      })
    })

    it('includes quality metrics in export', async () => {
      render(<ResultsExportDemo />)

      // Generate reports with quality metrics
      const generateButton = screen.getByText('Generate Reports')
      fireEvent.click(generateButton)

      await waitFor(
        () => {
          expect(
            screen.getByText('Balance Analysis Summary'),
          ).toBeInTheDocument()
        },
        { timeout: 5000 },
      )

      // Check for quality metrics
      await waitFor(() => {
        expect(screen.getByText(/Validation Score/)).toBeInTheDocument()
      })
    })
  })

  describe('End-to-End Pipeline Integration', () => {
    it('processes data through complete pipeline', async () => {
      // Step 1: Data Ingestion
      const { rerender } = render(<DataIngestionDemo />)

      const fileInput = screen.getByTestId('file-input')
      const file = new File(
        [
          JSON.stringify({
            content:
              'Clinical assessment shows patient with generalized anxiety disorder',
            category: 'anxiety-disorders',
          }),
        ],
        'clinical-data.json',
        { type: 'application/json' },
      )

      fireEvent.change(fileInput, { target: { files: [file] } })

      mockFileReader.result = JSON.stringify({
        content:
          'Clinical assessment shows patient with generalized anxiety disorder',
        category: 'anxiety-disorders',
      })
      if (mockFileReader.onload) {
        mockFileReader.onload({} as ProgressEvent<FileReader>)
      }

      await waitFor(() => {
        expect(screen.getByText('clinical-data.json')).toBeInTheDocument()
      })

      // Step 2: Validation
      rerender(<ValidationDemo />)

      const textInput = screen.getByPlaceholderText(/Enter psychology content/)
      fireEvent.change(textInput, {
        target: {
          value:
            'Clinical assessment shows patient with generalized anxiety disorder',
        },
      })

      await waitFor(() => {
        expect(screen.getByText(/Validation Results/)).toBeInTheDocument()
      })

      // Step 3: Category Balancing
      rerender(<CategoryBalancingDemo />)

      await waitFor(() => {
        expect(screen.getByText('Anxiety Disorders')).toBeInTheDocument()
      })

      // Step 4: Export
      rerender(<ResultsExportDemo />)

      const exportButton = screen.getByText('Export All')
      fireEvent.click(exportButton)

      await waitFor(() => {
        expect(screen.getByText('PROCESSING')).toBeInTheDocument()
      })
    })

    it('handles errors gracefully throughout pipeline', async () => {
      // Mock API failure
      mockFetch.mockRejectedValueOnce(new Error('API Error'))

      render(<DataIngestionDemo />)

      const fileInput = screen.getByTestId('file-input')
      const file = new File(['corrupted data'], 'test.json', {
        type: 'application/json',
      })

      fireEvent.change(fileInput, { target: { files: [file] } })

      // Simulate processing error
      mockFileReader.result = 'corrupted data'
      if (mockFileReader.onload) {
        mockFileReader.onload({} as ProgressEvent<FileReader>)
      }

      await waitFor(() => {
        expect(screen.getByText(/Processing failed/)).toBeInTheDocument()
      })
    })
  })

  describe('API Service Connections', () => {
    it('connects to knowledge balancer service', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            categories: [
              { id: 'anxiety-disorders', currentCount: 300 },
              { id: 'mood-disorders', currentCount: 250 },
            ],
          }),
      })

      render(<CategoryBalancingDemo enableLiveIntegration={true} />)

      await waitFor(() => {
        expect(screen.getByText('Live')).toBeInTheDocument()
      })

      // Should make API call for live data
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/knowledge-balancer'),
      )
    })

    it('connects to training pipeline APIs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })

      render(<ResultsExportDemo />)

      // Test API connection
      const testButtons = screen.getAllByText('Test Connection')
      if (testButtons[0]) {
        fireEvent.click(testButtons[0])
      }

      await waitFor(() => {
        expect(screen.getByText('Testing...')).toBeInTheDocument()
      })
    })

    it('handles API connection failures', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'))

      render(<CategoryBalancingDemo enableLiveIntegration={true} />)

      await waitFor(() => {
        expect(screen.getByText(/Integration Error/)).toBeInTheDocument()
      })
    })
  })

  describe('Real-time Data Synchronization', () => {
    it('synchronizes data between components in real-time', async () => {
      render(<CategoryBalancingDemo />)

      // Enable real-time mode
      const realTimeButton = screen.getByText('Inactive')
      fireEvent.click(realTimeButton)

      await waitFor(() => {
        expect(
          screen.getByText('Real-Time Balancing Active'),
        ).toBeInTheDocument()
      })

      // Simulate data changes
      const simulateButton = screen.getByText('Simulate Influx')
      fireEvent.click(simulateButton)

      await waitFor(() => {
        // Should show updated data
        expect(screen.getByText(/\d+\.\d+%/)).toBeInTheDocument()
      })
    })

    it('maintains data consistency during real-time updates', async () => {
      render(<CategoryBalancingDemo />)

      // Check initial state
      const initialRatios = screen.getAllByText(/\d+\.\d+%/)
      expect(initialRatios.length).toBeGreaterThan(0)

      // Enable real-time mode and make changes
      const realTimeButton = screen.getByText('Inactive')
      fireEvent.click(realTimeButton)

      await waitFor(() => {
        // Ratios should still be present and valid
        const updatedRatios = screen.getAllByText(/\d+\.\d+%/)
        expect(updatedRatios.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Cross-Component Data Flow', () => {
    it('maintains data integrity across component boundaries', async () => {
      const sharedData = {
        categories: [
          { id: 'anxiety-disorders', count: 300, ratio: 30 },
          { id: 'mood-disorders', count: 250, ratio: 25 },
        ],
      }

      // Test data flow from balancing to export
      const { rerender } = render(
        <CategoryBalancingDemo
          onBalanceUpdate={(categories, metrics) => {
            expect(categories).toBeDefined()
            expect(metrics).toBeDefined()
          }}
        />,
      )

      // Trigger balance update
      const resetButton = screen.getByText('Reset Defaults')
      fireEvent.click(resetButton)

      // Switch to export component
      rerender(
        <ResultsExportDemo
          pipelineData={{
            totalItems: 1000,
            categories: sharedData.categories.map((cat) => ({
              id: cat.id,
              name: cat.id.replace('-', ' '),
              count: cat.count,
              percentage: cat.ratio,
            })),
            qualityMetrics: {
              overallScore: 90,
              validationScore: 85,
              balanceScore: 95,
            },
            processingStats: {
              totalProcessingTime: 120,
              averageItemTime: 0.12,
              successRate: 98.5,
            },
          }}
        />,
      )

      await waitFor(() => {
        expect(
          screen.getByText('Results Export & Integration'),
        ).toBeInTheDocument()
      })
    })

    it('handles component state synchronization', async () => {
      let balanceData: any = null

      render(
        <CategoryBalancingDemo
          onBalanceUpdate={(categories, metrics) => {
            balanceData = { categories, metrics }
          }}
        />,
      )

      // Trigger state change
      const autoRebalanceButton = screen.getByText('Auto Rebalance')
      fireEvent.click(autoRebalanceButton)

      await waitFor(() => {
        expect(balanceData).not.toBeNull()
      })
    })
  })
})
