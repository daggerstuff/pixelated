import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  InfoIcon,
  BrainIcon,
  MessageSquareIcon,
  RefreshCwIcon,
  DownloadIcon,
} from 'lucide-react'
import { DisorderCategory } from '@/lib/ai/mental-arena/types'

/**
 * Generate cryptographically secure random integer within a range
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @returns Secure random integer
 */
function getSecureRandomInt(min: number, max: number): number {
  const range = max - min + 1
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return min + ((array[0] ?? 0) % range)
}

/**
 * Generate cryptographically secure random boolean
 * @returns Secure random boolean
 */
function getSecureRandomBoolean(): boolean {
  const array = new Uint8Array(1)
  crypto.getRandomValues(array)
  return (array[0] ?? 0) >= 128
}

interface SyntheticConversation {
  patientText: string
  therapistText: string
  encodedSymptoms: Array<{
    name: string
    severity: number
    duration: string
    manifestations: string[]
    cognitions: string[]
  }>
  decodedSymptoms: string[]
  sessionSummary?: string
  accuracyScore?: number
}

interface ScenarioSymptom {
  name: string
  severity: number
  duration: string
  indicators: string[]
  cognitivePatterns?: string[]
}

interface IdentifiedSymptom {
  name: string
}

interface ScenarioResult {
  scenario: {
    clientStatement: string
    therapistResponse: string
    symptoms: ScenarioSymptom[]
  }
  analysis: {
    identifiedSymptoms: IdentifiedSymptom[]
    clinicalSummary: string
    accuracyScore: number
  }
}

/**
 * Component for demonstrating synthetic therapy conversation generation
 */
export default function SyntheticTherapyDemo() {
  const [loading, setLoading] = useState(false)
  const [conversations, setConversations] = useState<SyntheticConversation[]>(
    [],
  )
  const [selectedConversationIndex, setSelectedConversationIndex] = useState(0)
  const [config, setConfig] = useState({
    numSessions: 1,
    maxTurns: 3,
    disorders: [DisorderCategory.Anxiety, DisorderCategory.Depression],
    usePythonBridge: false,
    model: 'gpt-3.5-turbo',
  })

  // Handle generating therapy conversations
  const handleGenerateConversations = async () => {
    setLoading(true)
    try {
      // Call our new psychology scenario generation API
      const response = await fetch('/api/psychology/generate-scenario', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'therapy_conversation',
          difficulty: config.disorders.length > 1 ? 'moderate' : 'basic',
          clientProfile: {
            disorders: config.disorders,
            sessionNumber: getSecureRandomInt(1, 10),
            presenting_concerns: config.disorders.map(
              (d) => `Primary concern related to ${d}`,
            ),
            demographics: {
              age: getSecureRandomInt(20, 59),
              gender: getSecureRandomBoolean() ? 'female' : 'male',
            },
          },
          therapeuticFramework: 'CBT', // Default to CBT
          options: {
            includeSymptoms: true,
            includeAnalysis: true,
            realistic: true,
            evidenceBased: true,
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }

      const scenarioResult = (await response.json()) as ScenarioResult

      // Transform API response to match our conversation format
      const apiConversations: SyntheticConversation[] = [
        {
          patientText: scenarioResult.scenario.clientStatement,
          therapistText: scenarioResult.scenario.therapistResponse,
          encodedSymptoms: scenarioResult.scenario.symptoms.map(
            (symptom: ScenarioSymptom) => ({
              name: symptom.name,
              severity: symptom.severity / 10, // Convert 1-10 to 0-1
              duration: symptom.duration,
              manifestations: symptom.indicators,
              cognitions: symptom.cognitivePatterns || [],
            }),
          ),
          decodedSymptoms: scenarioResult.analysis.identifiedSymptoms.map(
            (symptom: IdentifiedSymptom) => symptom.name,
          ),
          sessionSummary: scenarioResult.analysis.clinicalSummary,
          accuracyScore: scenarioResult.analysis.accuracyScore || 0.8,
        },
      ]

      setConversations(apiConversations)
    } catch (error: unknown) {
      console.error('Failed to generate conversations:', error)

      // Fallback to mock data on API failure
      const mockConversations: SyntheticConversation[] = [
        {
          patientText:
            "I've been struggling with excessive worry for about 6 months now. I have difficulty sleeping and I'm constantly catastrophizing. I'm also experiencing restlessness and fatigue. Fidgeting has been particularly difficult to deal with. I'm not sure what to do anymore. I've tried to manage on my own, but it's getting harder. Can you help me understand what's happening and what I might do about it?",
          therapistText:
            "I hear that you've been dealing with excessive worry for quite some time, and it's been affecting your sleep and causing physical symptoms like restlessness and fatigue. That sounds really challenging. When you mention catastrophizing, could you share an example of the kinds of thoughts you have when you're worried?",
          encodedSymptoms: [
            {
              name: 'excessive worry',
              severity: 0.7,
              duration: '6 months',
              manifestations: [
                'difficulty sleeping',
                'restlessness',
                'physical tension',
                'avoidance of anxiety-provoking situations',
              ],
              cognitions: [
                'catastrophizing',
                'overestimation of threat',
                'intolerance of uncertainty',
              ],
            },
            {
              name: 'restlessness',
              severity: 0.6,
              duration: '3 months',
              manifestations: ['fidgeting', 'unable to sit still', 'pacing'],
              cognitions: ['feeling on edge', 'anticipating danger'],
            },
            {
              name: 'fatigue',
              severity: 0.5,
              duration: '2 months',
              manifestations: [
                'decreased energy',
                'difficulty completing tasks',
                'requiring more rest than usual',
              ],
              cognitions: ['feeling overwhelmed', 'diminished self-efficacy'],
            },
          ],
          decodedSymptoms: ['anxiety', 'insomnia', 'fatigue'],
          sessionSummary:
            "Session Summary:\n\nPatient presented with excessive worry, restlessness, fatigue.\nTherapist identified: anxiety, insomnia, fatigue.\n\nSymptom detection accuracy: 67%\n\nThe conversation covered the patient's experiences with excessive worry, fatigue.\nThe therapist may have missed: restlessness.\n\nThis simulated interaction demonstrates the importance of thorough assessment and active listening in the therapeutic relationship.",
          accuracyScore: 0.67,
        },
      ]

      setConversations(mockConversations)
      setSelectedConversationIndex(0)
    } finally {
      setLoading(false)
    }
  }

  const selectedConversation = conversations[selectedConversationIndex] || null

  return (
    <div className="flex flex-col w-full max-w-6xl mx-auto gap-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          Synthetic Therapy Conversation Generator
        </h1>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon">
                <InfoIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <p>
                This demo uses the MentalArena framework to generate synthetic
                therapy conversations between patients and therapists. The
                system encodes symptoms into a patient profile and then measures
                how accurately a therapist model identifies those symptoms.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>
              Adjust settings for conversation generation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="numSessions">Number of Sessions</Label>
              <Slider
                min={1}
                max={5}
                step={1}
                value={[config.numSessions]}
                onValueChange={(value: number[]) =>
                  setConfig({ ...config, numSessions: value[0] ?? 1 })
                }
              />

              <div className="text-right text-sm text-muted-foreground">
                {config.numSessions}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxTurns">Max Turns per Conversation</Label>
              <Slider
                min={1}
                max={10}
                step={1}
                value={[config.maxTurns]}
                onValueChange={(value: number[]) =>
                  setConfig({ ...config, maxTurns: value[0] ?? 3 })
                }
              />

              <div className="text-right text-sm text-muted-foreground">
                {config.maxTurns}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select
                value={config.model}
                onValueChange={(value: string) =>
                  setConfig({ ...config, model: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  <SelectItem value="gpt-4">GPT-4</SelectItem>
                  <SelectItem value="llama-3-8b">Llama 3 (8B)</SelectItem>
                  <SelectItem value="meta-llama/Meta-Llama-3-8B">
                    Meta-Llama-3-8B
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Disorders</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.values(DisorderCategory) as string[])
                  .slice(0, 5)
                  .map((disorder) => (
                    <Badge
                      key={disorder}
                      variant={
                        config.disorders.includes(disorder as DisorderCategory)
                          ? 'default'
                          : 'outline'
                      }
                      className="cursor-pointer"
                      onClick={() => {
                        const disorders = config.disorders.includes(
                          disorder as DisorderCategory,
                        )
                          ? config.disorders.filter((d) => d !== disorder)
                          : [...config.disorders, disorder as DisorderCategory]
                        setConfig({ ...config, disorders })
                      }}
                    >
                      {disorder}
                    </Badge>
                  ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="pythonBridge"
                checked={config.usePythonBridge}
                onCheckedChange={(checked: boolean) =>
                  setConfig({ ...config, usePythonBridge: checked })
                }
              />

              <Label htmlFor="pythonBridge">Use Python Bridge</Label>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              onClick={handleGenerateConversations}
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCwIcon className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <BrainIcon className="mr-2 h-4 w-4" />
                  Generate Conversations
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        <div className="md:col-span-3 space-y-6">
          {conversations.length > 0 && selectedConversation ? (
            <>
              <Tabs defaultValue="conversation" className="w-full">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="conversation">Conversation</TabsTrigger>
                  <TabsTrigger value="symptoms">Symptoms</TabsTrigger>
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                </TabsList>

                <TabsContent value="conversation" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex justify-between">
                        <span>Synthetic Therapy Conversation</span>
                        <Badge variant="outline">
                          Session {selectedConversationIndex + 1}/
                          {conversations.length}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="rounded-lg bg-secondary/50 p-4">
                        <div className="flex items-start gap-4">
                          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white">
                            P
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">Patient</div>
                            <div className="mt-1">
                              {selectedConversation.patientText}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg bg-muted p-4">
                        <div className="flex items-start gap-4">
                          <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white">
                            T
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">Therapist</div>
                            <div className="mt-1">
                              {selectedConversation.therapistText}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="symptoms" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Encoded Symptoms (Patient)</CardTitle>
                        <CardDescription>
                          Symptoms encoded into the patient profile
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {selectedConversation.encodedSymptoms.map((symptom) => (
                          <div
                            key={`${symptom.name}-${symptom.duration}`}
                            className="rounded-lg border p-4 space-y-2"
                          >
                            <div className="flex justify-between items-center">
                              <h3 className="font-medium">{symptom.name}</h3>
                              <Badge variant="outline">
                                {symptom.duration}
                              </Badge>
                            </div>
                            <div className="space-y-1">
                              <div className="text-sm text-muted-foreground">
                                Severity: {(symptom.severity * 100).toFixed(0)}%
                              </div>
                              <div className="w-full bg-secondary rounded-full h-2">
                                <div
                                  className="bg-primary h-2 rounded-full"
                                  style={{
                                    width: `${symptom.severity * 100}%`,
                                  }}
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-sm font-medium">
                                Manifestations:
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {symptom.manifestations.map((manifestation) => (
                                  <Badge
                                    key={`${symptom.name}-${manifestation}`}
                                    variant="secondary"
                                  >
                                    {manifestation}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-sm font-medium">
                                Cognitions:
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {symptom.cognitions.map((cognition) => (
                                  <Badge
                                    key={`${symptom.name}-${cognition}`}
                                    variant="outline"
                                  >
                                    {cognition}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Decoded Symptoms (Therapist)</CardTitle>
                        <CardDescription>
                          Symptoms identified by the therapist model
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="rounded-lg border p-4 space-y-2">
                          <div className="font-medium">Identified Symptoms</div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {selectedConversation.decodedSymptoms.map(
                              (symptom) => {
                                const isCorrect =
                                  selectedConversation.encodedSymptoms.some(
                                    (s) =>
                                      s.name.includes(symptom) ||
                                      symptom.includes(s.name),
                                  )
                                return (
                                  <Badge
                                    key={symptom}
                                    variant={isCorrect ? 'default' : 'outline'}
                                  >
                                    {symptom}
                                  </Badge>
                                )
                              },
                            )}
                          </div>
                        </div>

                        <div className="rounded-lg border p-4 space-y-2">
                          <div className="font-medium">
                            Correctly Identified
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {selectedConversation.encodedSymptoms
                              .filter((encoded) =>
                                selectedConversation.decodedSymptoms.some(
                                  (decoded) =>
                                    decoded.includes(encoded.name) ||
                                    encoded.name.includes(decoded),
                                ),
                              )
                              .map((symptom) => (
                                <Badge
                                  key={`correctly-identified-${symptom.name}`}
                                  variant="default"
                                >
                                  {symptom.name}
                                </Badge>
                              ))}
                          </div>
                        </div>

                        <div className="rounded-lg border p-4 space-y-2">
                          <div className="font-medium">Missed by Therapist</div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {selectedConversation.encodedSymptoms
                              .filter(
                                (encoded) =>
                                  !selectedConversation.decodedSymptoms.some(
                                    (decoded) =>
                                      decoded.includes(encoded.name) ||
                                      encoded.name.includes(decoded),
                                  ),
                              )
                              .map((symptom) => (
                                <Badge
                                  key={`missed-${symptom.name}`}
                                  variant="outline"
                                >
                                  {symptom.name}
                                </Badge>
                              ))}
                          </div>
                        </div>

                        <div className="rounded-lg border p-4 space-y-2">
                          <div className="font-medium">
                            Incorrectly Identified
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {selectedConversation.decodedSymptoms
                              .filter(
                                (decoded) =>
                                  !selectedConversation.encodedSymptoms.some(
                                    (encoded) =>
                                      encoded.name.includes(decoded) ||
                                      decoded.includes(encoded.name),
                                  ),
                              )
                              .map((symptom) => (
                                <Badge
                                  key={`incorrect-${symptom}`}
                                  variant="secondary"
                                >
                                  {symptom}
                                </Badge>
                              ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="summary" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Session Summary & Analysis</CardTitle>
                      <CardDescription>
                        AI-generated summary and accuracy score
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="rounded-lg bg-muted p-4 whitespace-pre-wrap font-mono text-sm">
                        {selectedConversation.sessionSummary}
                      </div>
                      <div className="flex justify-end">
                        <Badge
                          variant={
                            selectedConversation.accuracyScore &&
                              selectedConversation.accuracyScore >= 0.7
                              ? 'default'
                              : 'destructive'
                          }
                        >
                          {(
                            (selectedConversation.accuracyScore || 0) * 100
                          ).toFixed(0)}
                          % Accuracy
                        </Badge>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-end">
                      <Button variant="outline">
                        <DownloadIcon className="mr-2 h-4 w-4" />
                        Download Report
                      </Button>
                    </CardFooter>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <Card className="flex flex-col items-center justify-center h-96 border-dashed">
              <CardHeader>
                <CardTitle>No Conversations Generated</CardTitle>
                <CardDescription>
                  Click the button to generate synthetic conversations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MessageSquareIcon className="h-16 w-16 text-muted-foreground" />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
