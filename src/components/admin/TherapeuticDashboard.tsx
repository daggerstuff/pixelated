import React, { useState, useEffect } from 'react';
import { therapeuticClient, type CrisisResult, type PIIScrubResult } from '@/lib/api/therapeutic';

export const TherapeuticDashboard: React.FC = () => {
    type HealthStatus = { status: string; service?: string; mode?: string };

    const [health, setHealth] = useState<HealthStatus | null>(null);
    const [inputText, setInputText] = useState('');
    const [analysis, setAnalysis] = useState<{
        crisis?: CrisisResult;
        pii?: PIIScrubResult;
    }>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        void checkHealth();
    }, []);

    const checkHealth = async () => {
        try {
            const status = await therapeuticClient.healthCheck();
            setHealth(status);
        } catch {
            setHealth({ status: 'offline' });
        }
    };

    const runAnalysis = async () => {
        setLoading(true);
        try {
            const [crisis, pii] = await Promise.all([
                therapeuticClient.detectCrisis(inputText),
                therapeuticClient.scrubPII(inputText) // No session ID for test
            ]);
            setAnalysis({ crisis, pii });
        } catch (e: unknown) {
            console.error(e);
            alert('Analysis failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto bg-gray-50 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Therapeutic AI Dashboard</h2>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${health?.status === 'healthy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                    API: {health?.status || 'Unknown'} {health?.mode && `(${health.mode})`}
                </div>
            </div>

            <div className="space-y-6">
                {/* Input Section */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <label htmlFor="therapeutic-dashboard-input" className="block text-sm font-medium text-gray-700 mb-2">
                        Test Input (Patient Transcript)
                    </label>
                    <textarea
                        id="therapeutic-dashboard-input"
                        className="w-full h-32 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter text here... (e.g., 'I am feeling hopeless and want to end it all')"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                    />
                    <div className="mt-3 flex justify-end">
                        <button
                            onClick={runAnalysis}
                            disabled={loading || !inputText}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? 'Analyzing...' : 'Run Analysis'}
                        </button>
                    </div>
                </div>

                {/* Results Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Crisis Detection Results */}
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <h3 className="text-lg font-semibold mb-3 text-gray-800 flex items-center gap-2">
                            🚑 Crisis Detection
                        </h3>
                        {analysis.crisis ? (
                            <div className="space-y-3">
                                <div className={`p-3 rounded-md ${analysis.crisis.has_crisis_signal ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
                                    }`}>
                                    <div className="flex justify-between">
                                        <span className="font-medium">Risk Level:</span>
                                        <span className={`uppercase font-bold ${analysis.crisis.risk_level === 'imminent' ? 'text-red-700' :
                                                analysis.crisis.risk_level === 'high' ? 'text-orange-600' : 'text-gray-600'
                                            }`}>{analysis.crisis.risk_level}</span>
                                    </div>
                                </div>

                                {analysis.crisis.signals.length > 0 && (
                                    <div>
                                        <h4 className="text-xs uppercase text-gray-500 font-semibold mb-2">Detected Signals</h4>
                                        <ul className="space-y-2">
                                            {analysis.crisis.signals.map((signal, idx) => (
                                                <li key={`signal-${signal.category}-${signal.context}-${signal.id || idx}`} className="text-sm bg-gray-50 p-2 rounded">
                                                    <span className="font-medium text-indigo-700">{signal.category}:</span> {signal.context}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {analysis.crisis.action_required && (
                                    <div className="mt-2">
                                        <h4 className="text-xs uppercase text-gray-500 font-semibold mb-1">Protocol</h4>
                                        <ul className="list-disc list-inside text-sm text-gray-700">
                                            {analysis.crisis.escalation_protocol.map((step) => (
                                                <li key={`protocol-step-${step.replace(/\s+/g, '-').toLowerCase()}`}>{step}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-gray-400 text-sm italic py-4 text-center">No analysis run yet</div>
                        )}
                    </div>

                    {/* PII Scrubbing Results */}
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <h3 className="text-lg font-semibold mb-3 text-gray-800 flex items-center gap-2">
                            🔒 PII Scrubber
                        </h3>
                        {analysis.pii ? (
                            <div className="space-y-3">
                                <div className="p-3 bg-gray-50 rounded-md border border-gray-200 font-mono text-sm">
                                    {analysis.pii.scrubbed_text}
                                </div>
                                <div className="text-xs text-gray-500 flex gap-4">
                                    <span>Original Length: {analysis.pii.original_length}</span>
                                    <span>Scrubbed Length: {analysis.pii.scrubbed_length}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-gray-400 text-sm italic py-4 text-center">No analysis run yet</div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};
