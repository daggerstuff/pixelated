import React from 'react'

interface PipelineOverviewProps {
  className?: string
}

const PipelineOverview: React.FC<PipelineOverviewProps> = ({ className }) => {
  const pipelineStages = [
    {
      id: 1,
      title: 'Data Ingestion',
      description: 'Multi-source psychological content intake with format validation and preprocessing',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      features: ['Text & Document Processing', 'Clinical Records Integration', 'Real-time Data Validation'],
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 2,
      title: 'Knowledge Parsing',
      description: 'Advanced entity extraction and concept analysis using NLP and clinical ontologies',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      features: ['Mental Health Entity Recognition', 'Therapeutic Concept Mapping', 'Clinical Term Standardization'],
      color: 'from-cyan-500 to-cyan-600'
    },
    {
      id: 3,
      title: 'Scenario Generation',
      description: 'AI-powered creation of therapeutic scenarios with clinical formulations and treatment plans',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 4v12l-4-2-4 2V4M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      features: ['Dynamic Client Profiles', 'Evidence-Based Formulations', 'Personalized Treatment Plans'],
      color: 'from-green-500 to-green-600'
    },
    {
      id: 4,
      title: 'Analysis & Insights',
      description: 'Comprehensive analytics with confidence scoring and clinical relevance metrics',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      features: ['Risk Assessment Algorithms', 'Performance Metrics Tracking', 'Quality Assurance Reports'],
      color: 'from-orange-500 to-orange-600'
    }
  ]

  const technicalSpecs = [
    { label: 'Processing Speed', value: '< 500ms average response time' },
    { label: 'Accuracy Rate', value: '94.7% clinical entity recognition' },
    { label: 'Model Training', value: '50,000+ clinical case studies' },
    { label: 'Data Security', value: 'HIPAA compliant encryption' },
    { label: 'Scalability', value: '10,000+ concurrent analyses' },
    { label: 'Integration', value: 'RESTful API with webhooks' }
  ]

  return (
    <div className={`pipeline-overview max-w-7xl mx-auto ${className || ''}`}>
      {/* Pipeline Flow Visualization */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            AI Psychology Pipeline Architecture
          </h2>
          <p className="text-gray-600 max-w-3xl mx-auto">
            A sophisticated workflow that transforms raw psychological content into actionable clinical insights 
            through advanced AI processing and analysis.
          </p>
        </div>

        {/* Pipeline Stages */}
        <div className="relative">
          {/* Connection Lines */}
          <div className="hidden lg:block absolute top-20 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-cyan-500 via-green-500 to-orange-500"></div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pipelineStages.map((stage, index) => (
              <div key={stage.id} className="relative">
                {/* Stage Card */}
                <div className="bg-white border-2 border-gray-100 rounded-xl p-6 hover:shadow-lg transition-all duration-300 hover:border-gray-200">
                  {/* Stage Number */}
                  <div className={`w-12 h-12 bg-gradient-to-r ${stage.color} rounded-full flex items-center justify-center text-white font-bold text-lg mb-4 mx-auto`}>
                    {stage.id}
                  </div>
                  
                  {/* Icon */}
                  <div className={`text-gray-600 mb-4 flex justify-center bg-gradient-to-r ${stage.color} bg-clip-text text-transparent`}>
                    {stage.icon}
                  </div>
                  
                  {/* Content */}
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">
                    {stage.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4 text-center">
                    {stage.description}
                  </p>
                  
                  {/* Features */}
                  <div className="space-y-2">
                    {stage.features.map((feature) => (
                      <div key={feature} className="flex items-center text-xs text-gray-500">
                        <div className={`w-2 h-2 bg-gradient-to-r ${stage.color} rounded-full mr-2`}></div>
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Arrow (hidden on mobile) */}
                {index < pipelineStages.length - 1 && (
                  <div className="hidden lg:block absolute top-20 -right-3 z-10">
                    <div className={`w-6 h-6 bg-gradient-to-r ${stage.color} rounded-full flex items-center justify-center text-white`}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Technical Specifications */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* Performance Metrics */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Technical Specifications</h3>
          </div>
          
          <div className="space-y-3">
            {technicalSpecs.map((spec) => (
              <div key={spec.label} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                <span className="text-sm font-medium text-gray-700">{spec.label}</span>
                <span className="text-sm text-gray-600 font-mono">{spec.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Key Features */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl p-6">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-600 rounded-lg flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Pipeline Capabilities</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-start">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3"></div>
              <div>
                <div className="text-sm font-medium text-gray-900">Real-time Processing</div>
                <div className="text-xs text-gray-600">Instant analysis and feedback for clinical workflows</div>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
              <div>
                <div className="text-sm font-medium text-gray-900">Multi-modal Input</div>
                <div className="text-xs text-gray-600">Text, audio, and structured data processing</div>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="w-2 h-2 bg-cyan-500 rounded-full mt-2 mr-3"></div>
              <div>
                <div className="text-sm font-medium text-gray-900">Clinical Validation</div>
                <div className="text-xs text-gray-600">Evidence-based algorithms with peer review</div>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 mr-3"></div>
              <div>
                <div className="text-sm font-medium text-gray-900">Continuous Learning</div>
                <div className="text-xs text-gray-600">Model updates based on clinical outcomes</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Flow Diagram */}
      <div className="mt-8 bg-white rounded-xl shadow-lg p-8">
        <h3 className="text-xl font-semibold text-gray-900 mb-6 text-center">
          Data Flow & Processing Architecture
        </h3>
        
        <div className="flex flex-col lg:flex-row items-center justify-between space-y-4 lg:space-y-0 lg:space-x-6">
          {/* Input Sources */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center mb-3">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Input Sources</h4>
            <div className="text-xs text-gray-600 text-center space-y-1">
              <div>Clinical Notes</div>
              <div>Patient Records</div>
              <div>Research Papers</div>
              <div>Assessment Tools</div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center">
            <svg className="w-8 h-8 text-gray-400 lg:rotate-0 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>

          {/* Processing Engine */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-full flex items-center justify-center mb-3">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">AI Processing</h4>
            <div className="text-xs text-gray-600 text-center space-y-1">
              <div>NLP Analysis</div>
              <div>Entity Extraction</div>
              <div>Pattern Recognition</div>
              <div>Risk Assessment</div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center">
            <svg className="w-8 h-8 text-gray-400 lg:rotate-0 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>

          {/* Output Results */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center mb-3">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Clinical Insights</h4>
            <div className="text-xs text-gray-600 text-center space-y-1">
              <div>Diagnostic Support</div>
              <div>Treatment Plans</div>
              <div>Risk Indicators</div>
              <div>Progress Metrics</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PipelineOverview
