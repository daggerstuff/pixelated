export const TestData = {
  users: {
    validUser: {
      email: 'test@example.com',
      password: 'validpassword',
      name: 'Test User'
    },
    invalidUser: {
      email: 'invalid@example.com',
      password: 'wrongpassword'
    },
    adminUser: {
      email: 'admin@example.com',
      password: 'adminpassword',
      name: 'Admin User'
    }
  },
  
  messages: {
    supportRequest: 'I need some emotional support today.',
    greeting: 'Hello, how are you?',
    crisis: 'I am feeling very overwhelmed and need immediate help.',
    casual: 'What is the weather like today?',
    longMessage: 'This is a very long message that tests how the system handles extended text input and ensures that the UI can properly display and process longer conversations without any issues or truncation problems.'
  },
  
  apiEndpoints: {
    login: '/api/auth/login',
    chat: '/api/chat/message',
    history: '/api/chat/history',
    profile: '/api/user/profile'
  },
  
  selectors: {
    auth: {
      emailInput: '[data-testid="email-input"]',
      passwordInput: '[data-testid="password-input"]',
      loginButton: '[data-testid="login-button"]',
      errorMessage: '[data-testid="error-message"]'
    },
    chat: {
      messageInput: '[data-testid="message-input"]',
      sendButton: '[data-testid="send-button"]',
      chatHistory: '[data-testid="chat-history"]',
      aiResponse: '.ai-response',
      userMessage: '.user-message'
    },
    dashboard: {
      welcomeMessage: '[data-testid="welcome-message"]',
      navigationMenu: '[data-testid="navigation-menu"]',
      chatButton: '[data-testid="chat-button"]',
      settingsButton: '[data-testid="settings-button"]',
      userProfile: '[data-testid="user-profile"]'
    }
  },
  
  timeouts: {
    short: 5000,
    medium: 10000,
    long: 30000,
    apiResponse: 15000
  }
};
