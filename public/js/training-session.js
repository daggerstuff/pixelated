/**
 * Pixelated Empathy Training Session JavaScript
 * Handles real-time interaction with AI client simulation
 * Integrates with existing Astro frontend architecture
 */

class TrainingSession {
  constructor() {
    this.sessionData = null;
    this.userData = null;
    this.socket = null;
    this.sessionTimer = null;
    this.startTime = null;
    this.isConnected = false;
    this.messageQueue = [];
    
    this.init();
  }
  
  init() {
    // Load session data from page
    this.loadSessionData();
    
    // Initialize WebSocket connection
    this.initializeSocket();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Start session timer
    this.startSessionTimer();
    
    // Initialize UI components
    this.initializeUI();
    
    console.log('🎭 Pixelated Empathy Training Session initialized');
  }
  
  loadSessionData() {
    const sessionScript = document.getElementById('session-data');
    const userScript = document.getElementById('user-data');
    
    if (sessionScript) {
      this.sessionData = JSON.parse(sessionScript.textContent);
    }
    
    if (userScript) {
      this.userData = JSON.parse(userScript.textContent);
    }
    
    console.log('Session data loaded:', this.sessionData);
  }
  
  initializeSocket() {
    // Connect to WebSocket server
    const socketUrl = window.location.protocol === 'https:' 
      ? `wss://${window.location.host}` 
      : `ws://${window.location.host}`;
    
    this.socket = io(socketUrl, {
      path: '/api/training/socket',
      auth: {
        sessionId: this.sessionData?.sessionId,
        userId: this.userData?.id,
        role: this.userData?.role
      }
    });
    
    this.socket.on('connect', () => {
      console.log('🔗 Connected to training session');
      this.isConnected = true;
      this.joinSession();
      this.processMessageQueue();
    });
    
    this.socket.on('disconnect', () => {
      console.log('🔌 Disconnected from training session');
      this.isConnected = false;
      this.showConnectionStatus(false);
    });
    
    this.socket.on('client_response', (data) => {
      this.handleClientResponse(data);
    });
    
    this.socket.on('session_update', (data) => {
      this.handleSessionUpdate(data);
    });
    
    this.socket.on('crisis_alert', (data) => {
      this.handleCrisisAlert(data);
    });
    
    this.socket.on('feedback_update', (data) => {
      this.handleFeedbackUpdate(data);
    });
    
    this.socket.on('supervisor_intervention', (data) => {
      this.handleSupervisorIntervention(data);
    });
  }
  
  setupEventListeners() {
    // Message sending
    const sendButton = document.getElementById('send-message');
    const messageInput = document.getElementById('message-input');
    
    if (sendButton) {
      sendButton.addEventListener('click', () => this.sendMessage());
    }
    
    if (messageInput) {
      messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
      
      messageInput.addEventListener('input', () => {
        this.updateMessageQuality();
        this.updateCharacterCount();
        this.updateSendButton();
      });
    }
    
    // Session controls
    const pauseButton = document.getElementById('pause-session');
    const endButton = document.getElementById('end-session');
    const emergencyButton = document.getElementById('emergency-button');
    const backButton = document.getElementById('back-button');
    
    if (pauseButton) {
      pauseButton.addEventListener('click', () => this.pauseSession());
    }
    
    if (endButton) {
      endButton.addEventListener('click', () => this.endSession());
    }
    
    if (emergencyButton) {
      emergencyButton.addEventListener('click', () => this.triggerEmergency());
    }
    
    if (backButton) {
      backButton.addEventListener('click', () => {
        window.location.href = '/training';
      });
    }
    
    // Suggestions button
    const suggestionsButton = document.getElementById('suggestions-button');
    if (suggestionsButton) {
      suggestionsButton.addEventListener('click', () => this.showSuggestions());
    }
    
    // Intervention type selector
    const interventionSelect = document.getElementById('intervention-type');
    if (interventionSelect) {
      interventionSelect.addEventListener('change', () => this.updateMessageQuality());
    }
  }
  
  startSessionTimer() {
    this.startTime = new Date();
    
    this.sessionTimer = setInterval(() => {
      const elapsed = new Date() - this.startTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      
      const timerElement = document.getElementById('session-timer');
      if (timerElement) {
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    }, 1000);
  }
  
  initializeUI() {
    // Initialize client avatar
    this.updateClientAvatar({
      emotionalState: 'neutral',
      trustLevel: 0.1,
      resistanceLevel: 0.5,
      crisisRisk: 0.1
    });
    
    // Initialize skill meters
    this.updateSkillMeters({
      rapport_building: 0,
      active_listening: 0,
      empathy: 0
    });
    
    // Show initial client message if available
    if (this.sessionData?.initialMessage) {
      this.addMessage('client', this.sessionData.initialMessage, {
        emotionalState: 'neutral',
        timestamp: new Date()
      });
    }
  }
  
  joinSession() {
    if (this.socket && this.isConnected) {
      this.socket.emit('join_session', {
        sessionId: this.sessionData?.sessionId,
        role: this.userData?.role
      });
    }
  }
  
  sendMessage() {
    const messageInput = document.getElementById('message-input');
    const interventionSelect = document.getElementById('intervention-type');
    
    if (!messageInput || !messageInput.value.trim()) return;
    
    const message = {
      content: messageInput.value.trim(),
      interventionType: interventionSelect?.value || 'reflection',
      timestamp: new Date().toISOString(),
      sessionId: this.sessionData?.sessionId
    };
    
    // Add message to UI immediately
    this.addMessage('therapist', message.content, {
      timestamp: new Date(),
      interventionType: message.interventionType
    });
    
    // Send to server
    if (this.isConnected) {
      this.socket.emit('therapist_message', message);
    } else {
      this.messageQueue.push(message);
      this.showConnectionStatus(false);
    }
    
    // Clear input
    messageInput.value = '';
    this.updateSendButton();
    this.updateCharacterCount();
    
    // Show typing indicator
    this.showTypingIndicator();
  }
  
  handleClientResponse(data) {
    // Remove typing indicator
    this.hideTypingIndicator();
    
    // Add client message
    this.addMessage('client', data.content, {
      emotionalState: data.emotionalState,
      timestamp: new Date(data.timestamp)
    });
    
    // Update client state
    this.updateClientAvatar({
      emotionalState: data.emotionalState,
      trustLevel: data.therapeuticProgress,
      resistanceLevel: data.resistanceLevel,
      crisisRisk: data.crisisRisk || 0
    });
    
    // Update nonverbal cues
    if (data.nonverbalCues) {
      this.updateNonverbalCues(data.nonverbalCues);
    }
  }
  
  handleSessionUpdate(data) {
    // Update skill meters
    if (data.skillFeedback) {
      this.updateSkillMeters(data.skillFeedback);
    }
    
    // Update session state
    if (data.sessionState) {
      this.updateSessionState(data.sessionState);
    }
  }
  
  handleCrisisAlert(data) {
    this.showCrisisAlert(data.message, data.severity);
    
    // Update crisis meter
    const crisisMeter = document.getElementById('crisis-meter');
    const crisisPercentage = document.getElementById('crisis-percentage');
    
    if (crisisMeter && crisisPercentage) {
      const riskLevel = data.riskLevel || 0.8;
      crisisMeter.style.width = `${riskLevel * 100}%`;
      crisisPercentage.textContent = `${Math.round(riskLevel * 100)}%`;
    }
  }
  
  handleFeedbackUpdate(data) {
    this.addFeedbackMessage(data.message, data.type);
    
    if (data.skillRatings) {
      this.updateSkillMeters(data.skillRatings);
    }
  }
  
  handleSupervisorIntervention(data) {
    this.showSupervisorMessage(data.message, data.type);
  }
  
  addMessage(sender, content, metadata = {}) {
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-bubble message-${sender}`;
    
    const timestamp = metadata.timestamp || new Date();
    const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let messageHTML = `
      <div class="message-content">${content}</div>
      <div class="message-meta text-xs opacity-75 mt-1">
        ${timeString}
    `;
    
    if (sender === 'client' && metadata.emotionalState) {
      messageHTML += ` • ${metadata.emotionalState}`;
    }
    
    if (sender === 'therapist' && metadata.interventionType) {
      messageHTML += ` • ${metadata.interventionType}`;
    }
    
    messageHTML += '</div>';
    messageDiv.innerHTML = messageHTML;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  showTypingIndicator() {
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) return;
    
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typing-indicator';
    typingDiv.className = 'typing-indicator';
    typingDiv.innerHTML = `
      <div class="message-bubble message-client">
        <div class="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div class="text-xs opacity-75 mt-1">Client is typing...</div>
      </div>
    `;
    
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  hideTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }
  
  updateClientAvatar(state) {
    const avatar = document.getElementById('client-avatar');
    const emotionSpan = document.getElementById('avatar-emotion');
    const emotionalState = document.getElementById('emotional-state');
    
    // Update emotional state display
    if (emotionalState) {
      emotionalState.textContent = state.emotionalState || 'Neutral';
    }
    
    // Update avatar emotion emoji
    if (emotionSpan) {
      const emotions = {
        'neutral': '😐',
        'calm': '😌',
        'anxious': '😰',
        'angry': '😠',
        'sad': '😢',
        'frustrated': '😤',
        'hopeful': '🙂',
        'resistant': '🙄',
        'engaged': '😊'
      };
      
      emotionSpan.textContent = emotions[state.emotionalState] || '😐';
    }
    
    // Update avatar border color based on state
    if (avatar) {
      let borderColor = '#93c5fd'; // Default blue
      
      if (state.crisisRisk > 0.6) {
        borderColor = '#ef4444'; // Crisis red
      } else if (state.resistanceLevel > 0.7) {
        borderColor = '#f59e0b'; // Resistance amber
      } else if (state.trustLevel > 0.6) {
        borderColor = '#10b981'; // Trust green
      }
      
      avatar.style.borderColor = borderColor;
    }
    
    // Update meters
    this.updateMeter('trust-meter', 'trust-percentage', state.trustLevel);
    this.updateMeter('resistance-meter', 'resistance-percentage', state.resistanceLevel);
    this.updateMeter('crisis-meter', 'crisis-percentage', state.crisisRisk || 0);
  }
  
  updateMeter(meterId, percentageId, value) {
    const meter = document.getElementById(meterId);
    const percentage = document.getElementById(percentageId);
    
    if (meter) {
      meter.style.width = `${(value || 0) * 100}%`;
    }
    
    if (percentage) {
      percentage.textContent = `${Math.round((value || 0) * 100)}%`;
    }
  }
  
  updateSkillMeters(skills) {
    const skillMappings = {
      'rapport_building': { meter: 'rapport-progress', score: 'rapport-score' },
      'active_listening': { meter: 'listening-progress', score: 'listening-score' },
      'empathy': { meter: 'empathy-progress', score: 'empathy-score' }
    };
    
    Object.entries(skills).forEach(([skill, value]) => {
      const mapping = skillMappings[skill];
      if (mapping) {
        const meter = document.getElementById(mapping.meter);
        const score = document.getElementById(mapping.score);
        
        if (meter) {
          meter.style.width = `${(value / 5) * 100}%`;
        }
        
        if (score) {
          score.textContent = `${value.toFixed(1)}/5`;
        }
      }
    });
  }
  
  updateNonverbalCues(cues) {
    const bodyLanguage = document.getElementById('body-language');
    const voiceTone = document.getElementById('voice-tone');
    const eyeContact = document.getElementById('eye-contact');
    
    if (bodyLanguage && cues.body_language) {
      bodyLanguage.textContent = cues.body_language;
    }
    
    if (voiceTone && cues.voice_tone) {
      voiceTone.textContent = cues.voice_tone;
    }
    
    if (eyeContact && cues.eye_contact) {
      eyeContact.textContent = cues.eye_contact;
    }
  }
  
  updateMessageQuality() {
    const messageInput = document.getElementById('message-input');
    const qualitySpan = document.getElementById('response-quality');
    const interventionSelect = document.getElementById('intervention-type');
    
    if (!messageInput || !qualitySpan) return;
    
    const message = messageInput.value.trim();
    const interventionType = interventionSelect?.value || 'reflection';
    
    // Simple quality assessment
    let quality = 'Fair';
    let score = 0.5;
    
    // Check for therapeutic language
    const therapeuticWords = [
      'understand', 'feel', 'sounds like', 'tell me more',
      'what was that like', 'how did you', 'i hear you'
    ];
    
    const problematicWords = [
      'should', 'must', 'have to', 'wrong', 'bad'
    ];
    
    therapeuticWords.forEach(word => {
      if (message.toLowerCase().includes(word)) score += 0.1;
    });
    
    problematicWords.forEach(word => {
      if (message.toLowerCase().includes(word)) score -= 0.1;
    });
    
    // Adjust based on intervention type
    if (interventionType === 'empathy' && message.toLowerCase().includes('feel')) {
      score += 0.1;
    }
    
    if (interventionType === 'inquiry' && message.includes('?')) {
      score += 0.1;
    }
    
    // Determine quality label
    if (score >= 0.8) quality = 'Excellent';
    else if (score >= 0.6) quality = 'Good';
    else if (score >= 0.4) quality = 'Fair';
    else quality = 'Poor';
    
    qualitySpan.textContent = quality;
    qualitySpan.className = `font-medium ${
      quality === 'Excellent' ? 'text-green-600' :
      quality === 'Good' ? 'text-blue-600' :
      quality === 'Fair' ? 'text-yellow-600' : 'text-red-600'
    }`;
  }
  
  updateCharacterCount() {
    const messageInput = document.getElementById('message-input');
    const charCount = document.getElementById('character-count');
    
    if (messageInput && charCount) {
      const count = messageInput.value.length;
      charCount.textContent = `${count}/1000`;
      charCount.className = count > 800 ? 'text-red-500' : 'text-gray-500';
    }
  }
  
  updateSendButton() {
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-message');
    
    if (messageInput && sendButton) {
      const hasText = messageInput.value.trim().length > 0;
      sendButton.disabled = !hasText || !this.isConnected;
      
      if (hasText && this.isConnected) {
        sendButton.classList.remove('opacity-50', 'cursor-not-allowed');
      } else {
        sendButton.classList.add('opacity-50', 'cursor-not-allowed');
      }
    }
  }
  
  showCrisisAlert(message, severity = 'high') {
    const alertsContainer = document.getElementById('crisis-alerts');
    const alertMessage = document.getElementById('crisis-message');
    
    if (alertsContainer && alertMessage) {
      alertMessage.textContent = message;
      alertsContainer.classList.remove('hidden');
      
      // Auto-hide after 10 seconds for non-critical alerts
      if (severity !== 'critical') {
        setTimeout(() => {
          alertsContainer.classList.add('hidden');
        }, 10000);
      }
    }
  }
  
  addFeedbackMessage(message, type = 'info') {
    const feedbackContainer = document.getElementById('feedback-messages');
    if (!feedbackContainer) return;
    
    const feedbackDiv = document.createElement('div');
    feedbackDiv.className = `p-2 rounded text-xs ${
      type === 'success' ? 'bg-green-100 text-green-800' :
      type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
      type === 'error' ? 'bg-red-100 text-red-800' :
      'bg-blue-100 text-blue-800'
    }`;
    
    feedbackDiv.textContent = message;
    feedbackContainer.insertBefore(feedbackDiv, feedbackContainer.firstChild);
    
    // Remove old feedback messages (keep last 5)
    while (feedbackContainer.children.length > 5) {
      feedbackContainer.removeChild(feedbackContainer.lastChild);
    }
  }
  
  showSuggestions() {
    // This would show a modal with therapeutic response suggestions
    // For now, just add a feedback message
    this.addFeedbackMessage('Suggestion feature coming soon! Focus on reflecting the client\'s emotions.', 'info');
  }
  
  showConnectionStatus(connected) {
    const statusMessage = connected ? 
      'Connected to training session' : 
      'Connection lost - attempting to reconnect...';
    
    this.addFeedbackMessage(statusMessage, connected ? 'success' : 'warning');
  }
  
  pauseSession() {
    if (this.socket && this.isConnected) {
      this.socket.emit('pause_session', { sessionId: this.sessionData?.sessionId });
    }
    
    this.addFeedbackMessage('Session paused', 'info');
  }
  
  endSession() {
    if (confirm('Are you sure you want to end this training session?')) {
      if (this.socket && this.isConnected) {
        this.socket.emit('end_session', { sessionId: this.sessionData?.sessionId });
      }
      
      // Redirect to session summary
      window.location.href = `/training/session/${this.sessionData?.sessionId}/summary`;
    }
  }
  
  triggerEmergency() {
    if (this.socket && this.isConnected) {
      this.socket.emit('emergency_intervention', { 
        sessionId: this.sessionData?.sessionId,
        reason: 'User triggered emergency button'
      });
    }
    
    this.showCrisisAlert('Emergency intervention requested - supervisor notified', 'critical');
  }
  
  processMessageQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      this.socket.emit('therapist_message', message);
    }
  }
  
  cleanup() {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
    }
    
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

// Initialize training session when page loads
document.addEventListener('DOMContentLoaded', () => {
  window.trainingSession = new TrainingSession();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (window.trainingSession) {
    window.trainingSession.cleanup();
  }
});