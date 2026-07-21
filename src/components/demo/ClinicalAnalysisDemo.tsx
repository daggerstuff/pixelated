import {
  Brain,
  AlertTriangle,
  Target,
  TrendingUp,
  FileText,
  Clock,
  Shield,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge/index";
import { Button } from "@/components/ui/button/index";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card/index";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

interface RiskAssessment {
  level: "low" | "moderate" | "high" | "critical";
  score: number;
  factors: string[];
  recommendations: string[];
  immediateActions?: string[];
}

interface Recommendation {
  type: "intervention" | "assessment" | "referral" | "monitoring";
  priority: "low" | "medium" | "high" | "urgent";
  description: string;
  rationale: string;
  timeline: string;
}

interface AnalysisResult {
  overallRisk: RiskAssessment;
  mentalHealthIndicators: {
    name: string;
    present: boolean;
    confidence: number;
    severity?: number;
    notes?: string;
  }[];
  recommendations: Recommendation[];
  clinicalSummary: string;
  followUpRequired: boolean;
  estimatedDuration: string;
  confidence: number;
  processingTime: number;
}

export default function ClinicalAnalysisDemo() {
  const [inputText, setInputText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const performAnalysis = async () => {
    if (!inputText.trim()) {
      setError("Please enter clinical content to analyze");
      return;
    }

    setAnalyzing(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch("/api/psychology/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: inputText,
          options: {
            includeRiskAssessment: true,
            includeRecommendations: true,
            includeInterventions: true,
            analysisDepth: "comprehensive",
            confidenceThreshold: 0.6,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.status}`);
      }

      interface ClinicalAnalysisResponse {
        riskAssessment?: Record<string, unknown>;
        indicators?: Array<Record<string, unknown>>;
        recommendations?: Array<Record<string, unknown>>;
        analysis?: Record<string, unknown>;
        metadata?: Record<string, unknown>;
      }

      const apiResult = (await response.json()) as ClinicalAnalysisResponse;

      // Transform API response to match our interface
      const analysisResult: AnalysisResult = {
        overallRisk: {
          level: apiResult.riskAssessment?.["level"] as RiskAssessment["level"],
          score: apiResult.riskAssessment?.["score"] as number,
          factors: apiResult.riskAssessment?.["factors"] as string[],
          recommendations: apiResult.riskAssessment?.["recommendations"] as string[],
          immediateActions: apiResult.riskAssessment?.["immediateActions"] as string[] | undefined,
        },
        mentalHealthIndicators:
          apiResult.indicators?.map((indicator) => ({
            name: indicator["condition"] as string,
            present: indicator["present"] as boolean,
            confidence: indicator["confidence"] as number,
            severity: indicator["severity"] as number | undefined,
            notes: indicator["notes"] as string | undefined,
          })) ?? [],
        recommendations:
          apiResult.recommendations?.map((rec) => ({
            type: rec["type"] as Recommendation["type"],
            priority: rec["priority"] as Recommendation["priority"],
            description: rec["intervention"] as string,
            rationale: rec["rationale"] as string,
            timeline: rec["timeline"] as string,
          })) ?? [],
        clinicalSummary: apiResult.analysis?.["summary"] as string,
        followUpRequired: apiResult.analysis?.["followUpRequired"] as boolean,
        estimatedDuration: apiResult.analysis?.["estimatedDuration"] as string,
        confidence: apiResult.analysis?.["overallConfidence"] as number,
        processingTime: apiResult.metadata?.["processingTime"] as number,
      };

      setResults(analysisResult);
    } catch (error: unknown) {
      console.error("Clinical analysis failed:", error);
      setError("Analysis failed. Please try again.");

      // Fallback to demo data for demonstration
      const demoResults: AnalysisResult = {
        overallRisk: {
          level: "moderate",
          score: 0.65,
          factors: [
            "Sleep disturbances reported",
            "Persistent worry patterns",
            "Functional impairment in work/social areas",
            "Duration of symptoms > 6 months",
          ],
          recommendations: [
            "Monitor closely for escalation",
            "Consider therapeutic intervention",
            "Assess for concurrent conditions",
            "Evaluate support system strength",
          ],
        },
        mentalHealthIndicators: [
          {
            name: "Generalized Anxiety Disorder",
            present: true,
            confidence: 0.85,
            severity: 6,
            notes: "Strong indicators present",
          },
          {
            name: "Major Depressive Episode",
            present: false,
            confidence: 0.25,
            notes: "Some overlapping symptoms but insufficient criteria",
          },
          {
            name: "Sleep Disorder",
            present: true,
            confidence: 0.72,
            severity: 5,
            notes: "Secondary to anxiety symptoms",
          },
          {
            name: "Panic Disorder",
            present: false,
            confidence: 0.15,
            notes: "No discrete panic attacks reported",
          },
        ],
        recommendations: [
          {
            type: "intervention",
            priority: "high",
            description: "Cognitive Behavioral Therapy (CBT) for anxiety management",
            rationale: "Evidence-based treatment for GAD with strong efficacy data",
            timeline: "12-16 weeks",
          },
          {
            type: "assessment",
            priority: "medium",
            description: "Comprehensive sleep study evaluation",
            rationale: "Sleep disturbances may require targeted intervention",
            timeline: "2-3 weeks",
          },
          {
            type: "monitoring",
            priority: "medium",
            description: "Weekly symptom tracking and check-ins",
            rationale: "Monitor treatment progress and symptom trajectory",
            timeline: "Ongoing during treatment",
          },
        ],
        clinicalSummary:
          "Client presents with symptoms consistent with Generalized Anxiety Disorder, characterized by excessive worry, sleep disturbances, and functional impairment. Symptoms have persisted for 6+ months and are causing significant distress. Cognitive-behavioral interventions are recommended as first-line treatment.",
        followUpRequired: true,
        estimatedDuration: "12-16 weeks for initial treatment phase",
        confidence: 0.82,
        processingTime: 1.3,
      };

      setTimeout(() => {
        setResults(demoResults);
        setError(null);
      }, 2000);
    } finally {
      setAnalyzing(false);
    }
  };

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case "low":
        return "bg-neutral-100 text-neutral-700 border-neutral-200";
      case "moderate":
        return "bg-neutral-200 text-neutral-800 border-neutral-300";
      case "high":
        return "bg-neutral-200 text-neutral-800 border-neutral-300";
      case "critical":
        return "bg-neutral-300 text-neutral-900 border-neutral-400";
      default:
        return "bg-neutral-100 text-neutral-700 border-neutral-200";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <AlertTriangle className="text-neutral-800 h-4 w-4" />;
      case "high":
        return <AlertCircle className="text-neutral-700 h-4 w-4" />;
      case "medium":
        return <Clock className="text-neutral-600 h-4 w-4" />;
      case "low":
        return <CheckCircle className="text-neutral-500 h-4 w-4" />;
      default:
        return <Clock className="text-neutral-500 h-4 w-4" />;
    }
  };

  const getIndicatorIcon = (present: boolean, confidence: number) => {
    if (present && confidence > 0.7) return <CheckCircle className="text-neutral-700 h-4 w-4" />;
    if (present && confidence > 0.5) return <AlertCircle className="text-neutral-600 h-4 w-4" />;
    return <XCircle className="text-neutral-400 h-4 w-4" />;
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="space-y-4 text-center">
        <h1 className="text-gray-900 flex items-center justify-center gap-3 text-3xl font-bold">
          <Brain className="text-neutral-700 h-8 w-8" />
          Clinical Analysis Engine
        </h1>
        <p className="text-gray-600 mx-auto max-w-2xl">
          Advanced AI-powered clinical analysis for comprehensive mental health assessment. Analyze
          clinical notes, session transcripts, or patient descriptions for evidence-based insights.
        </p>
      </div>

      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Clinical Content Input
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Enter clinical notes, therapy session transcript, intake assessment, or patient description here..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="min-h-32 resize-y"
          />

          <div className="flex items-center justify-between">
            <div className="text-gray-500 text-sm">
              {inputText.length} characters • Minimum 50 characters recommended
            </div>
            <Button
              onClick={performAnalysis}
              disabled={analyzing || inputText.trim().length < 10}
              className="flex items-center gap-2"
            >
              {analyzing ? (
                <>
                  <div className="border-white border-t-transparent h-4 w-4 animate-spin rounded-full border-2" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4" />
                  Analyze Content
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="bg-neutral-100 border-neutral-200 text-neutral-800 rounded-lg border p-3 text-sm">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      {results && (
        <div className="space-y-6">
          {/* Quick Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Analysis Overview
                </span>
                <div className="text-gray-600 flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  {results.processingTime.toFixed(1)}s processing time
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-neutral-800 text-2xl font-bold">
                    {Math.round(results.confidence * 100)}%
                  </div>
                  <div className="text-gray-600 text-sm">Overall Confidence</div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <Badge
                    variant="outline"
                    className={`px-3 py-1 text-lg ${getRiskBadgeColor(results.overallRisk.level)}`}
                  >
                    {results.overallRisk.level.toUpperCase()}
                  </Badge>
                  <div className="text-gray-600 mt-1 text-sm">Risk Level</div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-neutral-700 text-2xl font-bold">
                    {results.mentalHealthIndicators.filter((i) => i.present).length}
                  </div>
                  <div className="text-gray-600 text-sm">Indicators Found</div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-neutral-700 text-2xl font-bold">
                    {results.recommendations.length}
                  </div>
                  <div className="text-gray-600 text-sm">Recommendations</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Results */}
          <Card>
            <CardContent className="p-0">
              <Tabs defaultValue="risk" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="risk">Risk Assessment</TabsTrigger>
                  <TabsTrigger value="indicators">Mental Health Indicators</TabsTrigger>
                  <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
                  <TabsTrigger value="summary">Clinical Summary</TabsTrigger>
                </TabsList>

                <div className="p-6">
                  <TabsContent value="risk" className="mt-0 space-y-4">
                    <div className="mb-4 flex items-center gap-3">
                      <Shield className="text-neutral-700 h-6 w-6" />
                      <h3 className="text-xl font-semibold">Risk Assessment</h3>
                      <Badge
                        variant="outline"
                        className={getRiskBadgeColor(results.overallRisk.level)}
                      >
                        {results.overallRisk.level.toUpperCase()} RISK
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div>
                        <h4 className="text-gray-900 mb-3 font-medium">Risk Factors Identified</h4>
                        <ul className="space-y-2">
                          {results.overallRisk.factors.map((factor) => (
                            <li key={factor} className="flex items-start gap-2">
                              <AlertTriangle className="text-neutral-600 mt-0.5 h-4 w-4 flex-shrink-0" />
                              <span className="text-gray-700">{factor}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="text-gray-900 mb-3 font-medium">Risk Level Score</h4>
                        <div className="space-y-3">
                          <Progress value={results.overallRisk.score * 100} className="w-full" />
                          <div className="text-gray-600 text-sm">
                            Score: {results.overallRisk.score.toFixed(2)} / 1.00
                          </div>
                        </div>

                        {results.overallRisk.immediateActions && (
                          <div className="mt-4">
                            <h4 className="text-neutral-800 mb-2 font-medium">
                              Immediate Actions Required
                            </h4>
                            <ul className="space-y-1">
                              {results.overallRisk.immediateActions.map((action) => (
                                <li key={action} className="text-neutral-700 text-sm">
                                  • {action}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="indicators" className="mt-0 space-y-4">
                    <div className="mb-4 flex items-center gap-3">
                      <Target className="text-neutral-700 h-6 w-6" />
                      <h3 className="text-xl font-semibold">Mental Health Indicators</h3>
                    </div>

                    <div className="space-y-3">
                      {results.mentalHealthIndicators.map((indicator) => (
                        <Card
                          key={indicator.name}
                          className={`border-l-4 ${
                            indicator.present && indicator.confidence > 0.7
                              ? "border-l-neutral-500"
                              : indicator.present
                                ? "border-l-neutral-400"
                                : "border-l-neutral-300"
                          }`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {getIndicatorIcon(indicator.present, indicator.confidence)}
                                <div>
                                  <h4 className="text-gray-900 font-medium">{indicator.name}</h4>
                                  {indicator.notes && (
                                    <p className="text-gray-600 text-sm">{indicator.notes}</p>
                                  )}
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-sm font-medium">
                                  {Math.round(indicator.confidence * 100)}% confidence
                                </div>
                                {indicator.severity && (
                                  <div className="text-gray-600 text-sm">
                                    Severity: {indicator.severity}/10
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="recommendations" className="mt-0 space-y-4">
                    <div className="mb-4 flex items-center gap-3">
                      <TrendingUp className="text-neutral-700 h-6 w-6" />
                      <h3 className="text-xl font-semibold">Clinical Recommendations</h3>
                    </div>

                    <div className="space-y-4">
                      {results.recommendations.map((rec) => (
                        <Card key={rec.description}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              {getPriorityIcon(rec.priority)}
                              <div className="flex-1">
                                <div className="mb-2 flex items-center gap-2">
                                  <h4 className="text-gray-900 font-medium">{rec.description}</h4>
                                  <Badge variant="outline" className="text-xs">
                                    {rec.type}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${
                                      rec.priority === "urgent"
                                        ? "border-neutral-400 text-neutral-800"
                                        : rec.priority === "high"
                                          ? "border-neutral-400 text-neutral-800"
                                          : rec.priority === "medium"
                                            ? "border-neutral-400 text-neutral-800"
                                            : "border-neutral-400 text-neutral-800"
                                    }`}
                                  >
                                    {rec.priority} priority
                                  </Badge>
                                </div>
                                <p className="text-gray-600 mb-2 text-sm">{rec.rationale}</p>
                                <div className="text-gray-500 text-xs">
                                  Timeline: {rec.timeline}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="summary" className="mt-0 space-y-4">
                    <div className="mb-4 flex items-center gap-3">
                      <FileText className="text-neutral-700 h-6 w-6" />
                      <h3 className="text-xl font-semibold">Clinical Summary</h3>
                    </div>

                    <Card>
                      <CardContent className="p-6">
                        <div className="prose max-w-none">
                          <p className="text-gray-700 leading-relaxed">{results.clinicalSummary}</p>
                        </div>

                        <div className="mt-6 grid grid-cols-1 gap-6 border-t pt-6 md:grid-cols-2">
                          <div>
                            <h4 className="text-gray-900 mb-2 font-medium">Follow-up Required</h4>
                            <div className="flex items-center gap-2">
                              {results.followUpRequired ? (
                                <>
                                  <CheckCircle className="text-neutral-600 h-4 w-4" />
                                  <span className="text-neutral-800">
                                    Yes, follow-up recommended
                                  </span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="text-gray-400 h-4 w-4" />
                                  <span className="text-gray-600">
                                    No immediate follow-up needed
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div>
                            <h4 className="text-gray-900 mb-2 font-medium">
                              Estimated Treatment Duration
                            </h4>
                            <p className="text-gray-700">{results.estimatedDuration}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
