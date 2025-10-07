import { useState } from 'react'
import type { FC } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Upload,
  CheckCircle,
  AlertTriangle,
  Download,
  Play,
  BarChart3,
  FileText,
  Brain,
  Zap,
} from 'lucide-react'

interface DemoStep {
  id: string
  title: string
  description: string
  status: 'pending' | 'processing' | 'completed'
  progress: number
}

const ClientFacingDemo: FC = () => {
  const [currentStep, setCurrentStep] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [, setDemoData] = useState({
    uploadedFiles: 0,
    validationScore: 0,
    balanceScore: 0,
    exportReady: false,
  })

  const demoSteps: DemoStep[] = [
    {
      id: 'upload',
      title: 'Upload Psychology Content',
      description: 'Upload case studies, therapy notes, or training materials',
      status: 'completed',
      progress: 100,
    },
    {
      id: 'validate',
      title: 'AI-Powered Validation',
      description:
        'Validate content for clinical accuracy and ethical compliance',
      status: currentStep >= 1 ? 'completed' : 'pending',
      progress: currentStep >= 1 ? 100 : 0,
    },
    {
      id: 'balance',
      title: 'Category Balancing',
      description:
        'Ensure balanced representation across psychology categories',
      status: currentStep >= 2 ? 'completed' : 'pending',
      progress: currentStep >= 2 ? 100 : 0,
    },
    {
      id: 'export',
      title: 'Export Results',
      description: 'Generate training-ready datasets and quality reports',
      status: currentStep >= 3 ? 'completed' : 'pending',
      progress: currentStep >= 3 ? 100 : 0,
    },
  ]

  const sampleFiles = [
    {
      name: 'anxiety-case-studies.json',
      size: '2.4 MB',
      type: 'JSON',
      status: 'processed',
    },
    {
      name: 'therapy-session-notes.csv',
      size: '1.8 MB',
      type: 'CSV',
      status: 'processed',
    },
    {
      name: 'clinical-assessments.txt',
      size: '956 KB',
      type: 'TXT',
      status: 'processed',
    },
  ]

  const validationResults = [
    {
      category: 'Clinical Accuracy',
      score: 94,
      status: 'excellent',
      color: 'text-green-400',
    },
    {
      category: 'Ethical Compliance',
      score: 98,
      status: 'excellent',
      color: 'text-green-400',
    },
    {
      category: 'Content Quality',
      score: 91,
      status: 'good',
      color: 'text-blue-400',
    },
    {
      category: 'Format Consistency',
      score: 88,
      status: 'good',
      color: 'text-blue-400',
    },
  ]

  const categoryBalance = [
    {
      name: 'Anxiety Disorders',
      percentage: 30,
      target: 30,
      color: 'bg-purple-500',
    },
    {
      name: 'Mood Disorders',
      percentage: 25,
      target: 25,
      color: 'bg-blue-500',
    },
    {
      name: 'Trauma & PTSD',
      percentage: 20,
      target: 20,
      color: 'bg-green-500',
    },
    {
      name: 'Personality Disorders',
      percentage: 15,
      target: 15,
      color: 'bg-yellow-500',
    },
    { name: 'Substance Use', percentage: 10, target: 10, color: 'bg-red-500' },
  ]

  const runDemo = async () => {
    setIsProcessing(true)

    // Simulate processing steps
    for (let i = 0; i <= 3; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      setCurrentStep(i)

      // Update demo data
      if (i === 0) {
        setDemoData((prev) => ({ ...prev, uploadedFiles: 3 }))
      } else if (i === 1) {
        setDemoData((prev) => ({ ...prev, validationScore: 93 }))
      } else if (i === 2) {
        setDemoData((prev) => ({ ...prev, balanceScore: 94 }))
      } else if (i === 3) {
        setDemoData((prev) => ({ ...prev, exportReady: true }))
      }
    }

    setIsProcessing(false)
  }

  const resetDemo = () => {
    setCurrentStep(0)
    setIsProcessing(false)
    setDemoData({
      uploadedFiles: 0,
      validationScore: 0,
      balanceScore: 0,
      exportReady: false,
    })
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Demo Header */}
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-white mb-4">
          Interactive Pipeline Demo
        </h2>
        <p className="text-xl text-gray-300 mb-8">
          Experience our complete psychology training pipeline with sample data
        </p>

        <div className="flex justify-center gap-4 mb-8">
          <Button
            onClick={runDemo}
            disabled={isProcessing}
            className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Complete Demo
              </>
            )}
          </Button>

          <Button
            onClick={resetDemo}
            variant="outline"
            className="border-purple-400 text-purple-300 hover:bg-purple-900/50 px-8 py-3"
          >
            Reset Demo
          </Button>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="mb-12">
        <div className="flex justify-between items-center mb-8">
          {demoSteps.map((step, index) => (
            <div key={step.id} className="flex flex-col items-center flex-1">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                  step.status === 'completed'
                    ? 'bg-green-600'
                    : step.status === 'processing'
                      ? 'bg-blue-600'
                      : 'bg-gray-600'
                }`}
              >
                {step.status === 'completed' ? (
                  <CheckCircle className="w-6 h-6 text-white" />
                ) : (
                  <span className="text-white font-bold">{index + 1}</span>
                )}
              </div>
              <h3 className="text-sm font-medium text-white text-center">
                {step.title}
              </h3>
              <p className="text-xs text-gray-400 text-center mt-1">
                {step.description}
              </p>
              {step.progress > 0 && (
                <Progress value={step.progress} className="w-full mt-2 h-1" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Demo Content */}
      <Tabs value={demoSteps[currentStep]?.id || 'upload'} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-slate-800">
          {demoSteps.map((step, index) => (
            <TabsTrigger
              key={step.id}
              value={step.id}
              disabled={index > currentStep}
              className="data-[state=active]:bg-purple-600"
            >
              {step.title}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload" className="mt-6">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-purple-400 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Data Upload & Processing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-lg font-semibold text-white mb-4">
                    Sample Files Processed
                  </h4>
                  <div className="space-y-3">
                    {sampleFiles.map((file) => (
                      <div
                        key={`${file.name}-${file.type}`}
                        className="flex items-center justify-between p-3 bg-slate-700 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-purple-400" />
                          <div>
                            <div className="text-white text-sm font-medium">
                              {file.name}
                            </div>
                            <div className="text-gray-400 text-xs">
                              {file.size} • {file.type}
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-green-400 border-green-400"
                        >
                          {file.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-semibold text-white mb-4">
                    Processing Statistics
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-700 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-purple-400">
                        3
                      </div>
                      <div className="text-sm text-gray-400">
                        Files Processed
                      </div>
                    </div>
                    <div className="bg-slate-700 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-blue-400">
                        1,247
                      </div>
                      <div className="text-sm text-gray-400">
                        Items Extracted
                      </div>
                    </div>
                    <div className="bg-slate-700 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-green-400">
                        98.5%
                      </div>
                      <div className="text-sm text-gray-400">Success Rate</div>
                    </div>
                    <div className="bg-slate-700 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-yellow-400">
                        2.3s
                      </div>
                      <div className="text-sm text-gray-400">
                        Avg Process Time
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Validation Tab */}
        <TabsContent value="validate" className="mt-6">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-blue-400 flex items-center gap-2">
                <Brain className="w-5 h-5" />
                AI-Powered Content Validation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-lg font-semibold text-white mb-4">
                    Validation Categories
                  </h4>
                  <div className="space-y-4">
                    {validationResults.map((result) => (
                      <div key={`validation-${result.category}`} className="bg-slate-700 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-white font-medium">
                            {result.category}
                          </span>
                          <span className={`font-bold ${result.color}`}>
                            {result.score}%
                          </span>
                        </div>
                        <Progress value={result.score} className="h-2" />
                        <div className="flex justify-between items-center mt-2">
                          <Badge variant="outline" className={result.color}>
                            {result.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-semibold text-white mb-4">
                    Sample Validation
                  </h4>
                  <div className="bg-slate-700 rounded-lg p-4 mb-4">
                    <h5 className="text-purple-400 font-medium mb-2">
                      Input Content
                    </h5>
                    <div className="bg-slate-900 rounded p-3 text-sm text-gray-300">
                      &quot;Client presents with persistent worry, restlessness, and
                      difficulty concentrating for the past 6 months. Symptoms
                      interfere with work performance and social
                      relationships...&quot;
                    </div>
                  </div>

                  <div className="bg-slate-700 rounded-lg p-4">
                    <h5 className="text-green-400 font-medium mb-2">
                      AI Analysis
                    </h5>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-gray-300">
                          Clinical terminology accurate
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-gray-300">
                          Ethical guidelines followed
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-gray-300">No PII detected</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        <span className="text-gray-300">
                          Consider adding duration specificity
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balance Tab */}
        <TabsContent value="balance" className="mt-6">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-green-400 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Category Balance Optimization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-lg font-semibold text-white mb-4">
                    Category Distribution
                  </h4>
                  <div className="space-y-4">
                    {categoryBalance.map((category) => (
                      <div key={`category-${category.name}`} className="bg-slate-700 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-white font-medium">
                            {category.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-sm">
                              Target: {category.target}%
                            </span>
                            <span className="text-white font-bold">
                              {category.percentage}%
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-600 rounded-full h-3">
                          <div
                            className={`${category.color} h-3 rounded-full transition-all duration-500`}
                            style={{ width: `${category.percentage}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-xs text-gray-400">
                            {Math.abs(category.percentage - category.target) ===
                            0
                              ? 'Perfect'
                              : Math.abs(
                                    category.percentage - category.target,
                                  ) <= 2
                                ? 'Excellent'
                                : 'Good'}
                          </span>
                          <span className="text-xs text-gray-400">
                            {category.percentage >= category.target ? '+' : ''}
                            {category.percentage - category.target}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-semibold text-white mb-4">
                    Balance Metrics
                  </h4>
                  <div className="space-y-4">
                    <div className="bg-slate-700 rounded-lg p-6 text-center">
                      <div className="text-4xl font-bold text-green-400 mb-2">
                        94%
                      </div>
                      <div className="text-lg font-medium text-white mb-1">
                        Overall Balance Score
                      </div>
                      <div className="text-sm text-gray-400">
                        Excellent distribution
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-700 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-blue-400">
                          1,247
                        </div>
                        <div className="text-sm text-gray-400">Total Items</div>
                      </div>
                      <div className="bg-slate-700 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-purple-400">
                          5
                        </div>
                        <div className="text-sm text-gray-400">Categories</div>
                      </div>
                    </div>

                    <div className="bg-slate-700 rounded-lg p-4">
                      <h5 className="text-white font-medium mb-2">
                        Recommendations
                      </h5>
                      <div className="space-y-1 text-sm text-gray-300">
                        <div>✓ Distribution meets training requirements</div>
                        <div>✓ All categories have sufficient samples</div>
                        <div>✓ Ready for model training</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Export Tab */}
        <TabsContent value="export" className="mt-6">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-yellow-400 flex items-center gap-2">
                <Download className="w-5 h-5" />
                Export Training-Ready Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-slate-700 rounded-lg p-6 text-center">
                  <div className="text-4xl mb-4">📊</div>
                  <h4 className="text-lg font-semibold text-purple-400 mb-2">
                    Training Dataset
                  </h4>
                  <p className="text-gray-300 text-sm mb-4">
                    Balanced, validated dataset ready for ML training
                  </p>
                  <div className="text-xs text-gray-400 mb-4">
                    Format: JSON • Size: ~2.5 MB
                  </div>
                  <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                    <Download className="w-4 h-4 mr-2" />
                    Download JSON
                  </Button>
                </div>

                <div className="bg-slate-700 rounded-lg p-6 text-center">
                  <div className="text-4xl mb-4">📈</div>
                  <h4 className="text-lg font-semibold text-blue-400 mb-2">
                    Quality Report
                  </h4>
                  <p className="text-gray-300 text-sm mb-4">
                    Comprehensive analysis and validation metrics
                  </p>
                  <div className="text-xs text-gray-400 mb-4">
                    Format: PDF • Size: ~1.2 MB
                  </div>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </Button>
                </div>

                <div className="bg-slate-700 rounded-lg p-6 text-center">
                  <div className="text-4xl mb-4">⚙️</div>
                  <h4 className="text-lg font-semibold text-green-400 mb-2">
                    API Integration
                  </h4>
                  <p className="text-gray-300 text-sm mb-4">
                    Direct connection to training platforms
                  </p>
                  <div className="text-xs text-gray-400 mb-4">
                    Hugging Face • MLflow • W&B
                  </div>
                  <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                    <Zap className="w-4 h-4 mr-2" />
                    Connect API
                  </Button>
                </div>
              </div>

              <div className="mt-8 bg-slate-700 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-white mb-4">
                  Export Summary
                </h4>
                <div className="grid md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-purple-400">
                      1,247
                    </div>
                    <div className="text-sm text-gray-400">Training Items</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-400">94%</div>
                    <div className="text-sm text-gray-400">Quality Score</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-400">5</div>
                    <div className="text-sm text-gray-400">Categories</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-400">
                      Ready
                    </div>
                    <div className="text-sm text-gray-400">Status</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ClientFacingDemo
