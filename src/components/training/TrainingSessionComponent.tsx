import { useState, useEffect, useRef, useCallback } from "react";
import { useConversationMemory } from "../../hooks/useMemory";
import { authClient } from "@/lib/auth-client";
import { getJournalResearchAuthToken } from "../../lib/api/journal-research/auth";

// Basic UI scaffold for therapist training session
const initialClientMessage =
  "Hello, I am your client. How can you help me today?";

// Types
interface BiasAnalysisResult {
  overallScore: number;
  riskLevel: string;
  recommendations?: string[];
}

interface WebSocketMessage {
  type: string;
  payload?: {
    content?: string;
    role?: string;
    userId?: string;
    authorId?: string;
    message?: string;
    [key: string]: unknown;
  };
}

interface ConversationEntry {
  id: string;
  role: "client" | "therapist";
  message: string;
}

interface CoachingNote {
  id: string;
  authorId: string;
  content: string;
  timestamp: string;
}

// Helper function to create deduplication key
function createMessageKey(
  userId: string,
  role: string,
  content: string,
): string {
  return `${userId}:${role}:${content}`;
}

function createNoteKey(authorId: string, content: string): string {
  return `${authorId}:coaching_note:${content}`;
}

export function TrainingSessionComponent() {
  const { data: session } = authClient.useSession();
  // Use authenticated user ID, fallback to demo user for development/testing
  const userId = session?.user?.id || "demo-therapist";
  const sessionId = "session-1";
  const [therapistResponse, setTherapistResponse] = useState("");
  const [conversation, setConversation] = useState([
    { id: `msg-${Date.now()}`, role: "client", message: initialClientMessage },
  ]);
  const [evaluation, setEvaluation] = useState<string | null>(null);
  const [coachingNotes, setCoachingNotes] = useState<CoachingNote[]>([]);

  // Fishbowl Mode State
  const [role, setRole] = useState<"trainee" | "observer">("trainee");
  const ws = useRef<WebSocket | null>(null);
  // Use refs to avoid stale closures in WebSocket handlers
  const roleRef = useRef<"trainee" | "observer">(role);
  const userIdRef = useRef<string>(userId);
  // Track authentication state
  const isAuthenticatedRef = useRef<boolean>(false);
  // Track messages we've added locally to prevent duplicates from WebSocket echoes
  // Key format: `${userId}:${role}:${content}` - tracks locally added messages
  const locallyAddedMessages = useRef<Set<string>>(new Set());

  // Keep refs in sync with state
  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const memory = useConversationMemory(userId, sessionId);

  // Helper function to analyze bias
  const analyzeBias = async (
    sessionId: string,
    conversation: ConversationEntry[],
    therapistResponse: string,
    userId: string,
  ): Promise<BiasAnalysisResult | null> => {
    const sessionPayload = {
      session: {
        sessionId,
        timestamp: new Date().toISOString(),
        participantDemographics: { userId },
        scenario: "therapist-training",
        content: [
          ...conversation,
          { role: "therapist" as const, message: therapistResponse },
        ],
        metadata: {},
      },
    };

    try {
      const res = await fetch("/api/bias-detection/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionPayload),
      });

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      if (data?.success && data?.data) {
        return data.data as BiasAnalysisResult;
      }

      return null;
    } catch (err) {
      console.error("Bias analysis failed:", err);
      return null;
    }
  };

  // Helper function to generate AI response
  const generateAIResponse = async (
    conversation: ConversationEntry[],
    therapistResponse: string,
  ): Promise<string> => {
    const payload = {
      messages: [
        ...conversation.map((entry) => ({
          role: entry.role,
          content: entry.message,
        })),
        { role: "user", content: therapistResponse },
      ],
      model: "mistralai/Mixtral-8x7B-Instruct-v0.2",
      temperature: 0.7,
      maxResponseTokens: 256,
    };

    try {
      const res = await fetch("/api/ai/response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        return "Thank you for your response.";
      }

      const data = await res.json();
      if (data?.content) {
        return data.content;
      }

      return "Thank you for your response.";
    } catch (err) {
      console.error("AI response generation failed:", err);
      return "Thank you for your response.";
    }
  };

  // Helper function to format evaluation message
  const formatEvaluation = (biasResult: BiasAnalysisResult | null): string => {
    if (!biasResult) {
      return "Bias analysis unavailable.";
    }

    const recommendations = biasResult.recommendations?.join(", ") || "None";
    return `Bias Score: ${biasResult.overallScore} | Risk Level: ${biasResult.riskLevel}\nRecommendations: ${recommendations}`;
  };

  // Helper function to handle authentication response
  const handleAuthenticated = useCallback(
    (websocket: WebSocket, sessionId: string) => {
      const currentRole = roleRef.current;
      const currentUserId = userIdRef.current;
      websocket.send(
        JSON.stringify({
          type: "join_session",
          payload: {
            sessionId,
            role: currentRole,
            userId: currentUserId,
          },
        }),
      );
    },
    [],
  );

  // Helper function to handle session messages
  const handleSessionMessage = useCallback(
    (
      msg: WebSocketMessage,
      locallyAddedMessages: React.MutableRefObject<Set<string>>,
      currentRole: "trainee" | "observer",
      setConversation: React.Dispatch<
        React.SetStateAction<ConversationEntry[]>
      >,
    ) => {
      const messageContent = msg.payload?.content;
      const messageRole = msg.payload?.role;
      const messageUserId = msg.payload?.userId;

      if (!messageContent || !messageRole || !messageUserId) {
        return;
      }

      const messageKey = createMessageKey(
        messageUserId,
        messageRole,
        messageContent,
      );

      if (locallyAddedMessages.current.has(messageKey)) {
        return;
      }

      setConversation((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-${messageUserId}`,
          role: messageRole as "client" | "therapist",
          message: messageContent,
        },
      ]);
    },
    [],
  );

  // Helper function to handle coaching notes
  const handleCoachingNote = useCallback(
    (
      msg: WebSocketMessage,
      locallyAddedMessages: React.MutableRefObject<Set<string>>,
      setCoachingNotes: React.Dispatch<React.SetStateAction<CoachingNote[]>>,
    ) => {
      const noteContent = msg.payload?.content;
      const noteAuthorId = msg.payload?.authorId;

      if (!noteContent || !noteAuthorId) {
        return;
      }

      const noteKey = createNoteKey(noteAuthorId, noteContent);

      if (locallyAddedMessages.current.has(noteKey)) {
        return;
      }

      // Construct a proper CoachingNote object with all required fields
      // Ensure timestamp exists (server should provide it, but handle missing case)
      const coachingNote: CoachingNote = {
        id: `note-${Date.now()}-${noteAuthorId}`,
        authorId: noteAuthorId,
        content: noteContent,
        timestamp: msg.payload?.timestamp || new Date().toISOString(),
      };

      setCoachingNotes((prev) => [...prev, coachingNote]);
    },
    [],
  );

  // Helper function to handle WebSocket messages
  const handleWebSocketMessage = useCallback(
    (
      event: MessageEvent,
      sessionId: string,
      locallyAddedMessages: React.MutableRefObject<Set<string>>,
      isAuthenticatedRef: React.MutableRefObject<boolean>,
      websocket: WebSocket,
      setConversation: React.Dispatch<
        React.SetStateAction<ConversationEntry[]>
      >,
      setCoachingNotes: React.Dispatch<React.SetStateAction<CoachingNote[]>>,
    ) => {
      try {
        const msg = JSON.parse(event.data) as WebSocketMessage;

        if (msg.type === "authenticated") {
          console.log("Authenticated with Training Server", msg.payload);
          isAuthenticatedRef.current = true;
          handleAuthenticated(websocket, sessionId);
          return;
        }

        if (msg.type === "session_joined") {
          console.log("Joined session", msg.payload);
          return;
        }

        if (msg.type === "error") {
          console.error("WebSocket error:", msg.payload?.message);
          return;
        }

        if (msg.type === "session_message") {
          handleSessionMessage(
            msg,
            locallyAddedMessages,
            roleRef.current,
            setConversation,
          );
          return;
        }

        if (msg.type === "coaching_note") {
          handleCoachingNote(msg, locallyAddedMessages, setCoachingNotes);
          return;
        }
      } catch (e) {
        console.error("Error parsing WS message", e);
      }
    },
    [handleAuthenticated, handleSessionMessage, handleCoachingNote],
  );

  useEffect(() => {
    // Load conversation history from memory
    memory.getConversationHistory().then((history) => {
      if (history && history.length > 0) {
        setConversation(
          history.map((m) => ({
            id: `msg-${m.timestamp || ""}-${m.id || m.content}`,
            role: (m.metadata?.role || "client") as "client" | "therapist",
            message: m.content,
          })),
        );
      }
    });
  }, [memory]);

  // WebSocket Connection - only reconnect when sessionId or userId changes, not when role changes
  useEffect(() => {
    // Clear deduplication set when reconnecting (new session or user)
    locallyAddedMessages.current.clear();
    // Reset authentication state on reconnect
    isAuthenticatedRef.current = false;

    // Get WebSocket URL from environment variable, fallback to localhost for development
    const wsUrl =
      import.meta.env.PUBLIC_TRAINING_WS_URL || "ws://localhost:8084";
    const websocket = new WebSocket(wsUrl);
    ws.current = websocket;

    websocket.onopen = async () => {
      console.log("Connected to Training Server");

      // First, authenticate with the server
      // Get actual auth token from auth context
      const authToken = (await getJournalResearchAuthToken()) || "";
      websocket.send(
        JSON.stringify({
          type: "authenticate",
          payload: {
            token: authToken,
          },
        }),
      );
    };

    websocket.onmessage = (event) => {
      handleWebSocketMessage(
        event,
        sessionId,
        locallyAddedMessages,
        isAuthenticatedRef,
        websocket,
        setConversation,
        setCoachingNotes,
      );
    };

    websocket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    websocket.onclose = () => {
      console.log("WebSocket connection closed");
    };

    return () => {
      // Cleanup: close the WebSocket connection when effect re-runs or component unmounts
      if (
        websocket.readyState === WebSocket.OPEN ||
        websocket.readyState === WebSocket.CONNECTING
      ) {
        websocket.close();
      }
      ws.current = null;
    };
  }, [sessionId, userId, handleWebSocketMessage]); // Removed 'role' from dependencies to prevent reconnection loops

  // Helper function to send join session message
  const sendJoinSession = useCallback(
    (websocket: WebSocket, sessionId: string) => {
      const currentUserId = userIdRef.current;
      websocket.send(
        JSON.stringify({
          type: "join_session",
          payload: {
            sessionId,
            role: roleRef.current,
            userId: currentUserId,
          },
        }),
      );
    },
    [],
  );

  // Helper function to send authentication
  const sendAuthentication = useCallback(async (websocket: WebSocket) => {
    const authToken = (await getJournalResearchAuthToken()) || "";
    websocket.send(
      JSON.stringify({
        type: "authenticate",
        payload: {
          token: authToken,
        },
      }),
    );
  }, []);

  // Handle role changes by sending a new join_session message without reconnecting
  useEffect(() => {
    locallyAddedMessages.current.clear();
    setConversation([
      {
        id: `msg-${Date.now()}`,
        role: "client",
        message: initialClientMessage,
      },
    ]);
    setEvaluation(null);

    if (!ws.current) {
      return;
    }

    // If WebSocket is not open yet, wait for it to open before sending
    if (ws.current.readyState === WebSocket.CONNECTING) {
      const handleOpen = async () => {
        if (isAuthenticatedRef.current) {
          sendJoinSession(ws.current!, sessionId);
        } else {
          await sendAuthentication(ws.current!);
        }
        ws.current?.removeEventListener("open", handleOpen);
      };
      ws.current.addEventListener("open", handleOpen);
      return () => {
        ws.current?.removeEventListener("open", handleOpen);
      };
    }

    // If WebSocket is closed, don't attempt to send (connection will be re-established)
    if (
      ws.current.readyState === WebSocket.CLOSED ||
      ws.current.readyState === WebSocket.CLOSING
    ) {
      return;
    }

    // WebSocket is OPEN, send immediately
    if (ws.current.readyState === WebSocket.OPEN) {
      if (isAuthenticatedRef.current) {
        sendJoinSession(ws.current, sessionId);
      } else {
        // Fire and forget - authentication will complete asynchronously
        sendAuthentication(ws.current).catch((error) => {
          console.error("Failed to send authentication:", error);
        });
      }
    }
  }, [role, sessionId, sendJoinSession, sendAuthentication]);

  // Handle observer note submission
  const handleObserverNote = useCallback(
    (
      noteContent: string,
      userId: string,
      ws: React.MutableRefObject<WebSocket | null>,
      locallyAddedMessages: React.MutableRefObject<Set<string>>,
      setCoachingNotes: React.Dispatch<React.SetStateAction<CoachingNote[]>>,
      setTherapistResponse: React.Dispatch<React.SetStateAction<string>>,
    ) => {
      if (!noteContent.trim()) {
        return;
      }

      const noteKey = createNoteKey(userId, noteContent);
      locallyAddedMessages.current.add(noteKey);

      setCoachingNotes((prev) => [
        ...prev,
        {
          authorId: userId,
          content: noteContent,
          timestamp: new Date().toISOString(),
        },
      ]);

      ws.current?.send(
        JSON.stringify({
          type: "coaching_note",
          payload: { content: noteContent },
        }),
      );

      setTherapistResponse("");
    },
    [],
  );

  // Handle trainee response submission
  const handleTraineeResponse = useCallback(
    async (
      response: string,
      conversation: ConversationEntry[],
      sessionId: string,
      userId: string,
      ws: React.MutableRefObject<WebSocket | null>,
      locallyAddedMessages: React.MutableRefObject<Set<string>>,
      memory: ReturnType<typeof useConversationMemory>,
      setConversation: React.Dispatch<
        React.SetStateAction<ConversationEntry[]>
      >,
      setEvaluation: React.Dispatch<React.SetStateAction<string | null>>,
      setTherapistResponse: React.Dispatch<React.SetStateAction<string>>,
    ) => {
      const therapistMessage: ConversationEntry = {
        id: `msg-${Date.now()}-${userId}`,
        role: "therapist",
        message: response,
      };

      // Create updated conversation that includes the therapist message
      const updatedConversation = [...conversation, therapistMessage];

      setConversation((prev) => [...prev, therapistMessage]);
      await memory.addMessage(response, "user");

      const messageKey = createMessageKey(userId, "therapist", response);
      locallyAddedMessages.current.add(messageKey);

      ws.current?.send(
        JSON.stringify({
          type: "session_message",
          payload: { content: response, role: "therapist" },
        }),
      );

      // Analyze bias and generate AI response in parallel
      // Pass updated conversation that includes the therapist message
      const [biasResult, nextClientMsg] = await Promise.all([
        analyzeBias(sessionId, updatedConversation, response, userId),
        generateAIResponse(updatedConversation, response),
      ]);

      setEvaluation(formatEvaluation(biasResult));

      const clientMessage: ConversationEntry = {
        id: `msg-${Date.now()}-${userId}`,
        role: "client",
        message: nextClientMsg,
      };

      setConversation((prev) => [...prev, clientMessage]);
      await memory.addMessage(nextClientMsg, "assistant");

      const clientMessageKey = createMessageKey(
        userId,
        "client",
        nextClientMsg,
      );
      locallyAddedMessages.current.add(clientMessageKey);

      ws.current?.send(
        JSON.stringify({
          type: "session_message",
          payload: { content: nextClientMsg, role: "client" },
        }),
      );

      setTherapistResponse("");
    },
    [],
  );

  const handleResponse = useCallback(async () => {
    const currentRole = roleRef.current;
    const currentUserId = userIdRef.current;

    if (currentRole === "observer") {
      handleObserverNote(
        therapistResponse,
        currentUserId,
        ws,
        locallyAddedMessages,
        setCoachingNotes,
        setTherapistResponse,
      );
      return;
    }

    await handleTraineeResponse(
      therapistResponse,
      conversation,
      sessionId,
      currentUserId,
      ws,
      locallyAddedMessages,
      memory,
      setConversation,
      setEvaluation,
      setTherapistResponse,
    );
  }, [
    therapistResponse,
    conversation,
    sessionId,
    memory,
    handleObserverNote,
    handleTraineeResponse,
  ]);

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">
            Therapist Training Session
          </h2>
          <div className="flex space-x-2">
            <button
              onClick={() => setRole("trainee")}
              className={`px-3 py-1 rounded text-sm ${role === "trainee" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300"}`}
            >
              Trainee
            </button>
            <button
              onClick={() => setRole("observer")}
              className={`px-3 py-1 rounded text-sm ${role === "observer" ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-300"}`}
            >
              Observer
            </button>
          </div>
        </div>

        <div className="mb-6 space-y-4 max-h-96 overflow-y-auto">
          {conversation.map((entry) => (
            <div
              key={entry.id}
              className={`p-4 rounded-lg ${
                entry.role === "client"
                  ? "bg-blue-500/20 border-l-4 border-blue-500"
                  : "bg-green-500/20 border-l-4 border-green-500"
              }`}
            >
              <div className="font-semibold text-sm text-gray-300 mb-1">
                {entry.role === "client" ? "Client" : "Therapist"}
              </div>
              <div className="text-white">{entry.message}</div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <textarea
            value={therapistResponse}
            onChange={(e) => setTherapistResponse(e.target.value)}
            rows={3}
            className={`w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 ${role === "observer" ? "focus:ring-purple-500" : "focus:ring-blue-500"}`}
            placeholder={
              role === "observer"
                ? "Add a coaching note..."
                : "Type your therapeutic response..."
            }
          />

          <button
            onClick={handleResponse}
            disabled={!therapistResponse.trim()}
            className={`w-full py-3 px-6 font-medium rounded-lg transition-colors text-white ${
              role === "observer"
                ? "bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600"
                : "bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600"
            }`}
          >
            {role === "observer" ? "Send Note" : "Send Response"}
          </button>
        </div>

        {evaluation && (
          <div className="mt-6 p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
            <div className="font-semibold text-yellow-300 mb-2">
              AI Feedback
            </div>
            <div className="text-white whitespace-pre-line">{evaluation}</div>
          </div>
        )}
      </div>

      {/* Sidebar for Coaching Notes */}
      <div className="md:col-span-1 bg-black/20 rounded-xl p-4">
        <h3 className="text-lg font-semibold text-purple-300 mb-4">
          Coaching Notes
        </h3>
        {coachingNotes.length === 0 ? (
          <div className="text-gray-400 text-sm italic">No notes yet.</div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {coachingNotes.map((note) => (
              <div
                key={note.id}
                className="bg-purple-900/30 border border-purple-500/30 p-3 rounded text-sm"
              >
                <div className="text-purple-200 mb-1">{note.content}</div>
                <div className="text-purple-400/50 text-xs">
                  {new Date(note.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
