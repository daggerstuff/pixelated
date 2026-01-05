---
title: 'Quick Start Guide'
description: 'Get started with Pixelated in minutes'
pubDate: '2025-01-01'
author: 'Pixelated Empathy Team'
draft: false
toc: true
share: true
---

## Prerequisites

Before you begin, ensure you have the following:

- Node.js >= 22.14.0
- Python >= 3.11
- A Supabase account
- API keys for:
  - OpenAI
  - Anthropic
  - Google AI

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/vivirox/gradiant.git
cd gradiant
```

### 2. Install Dependencies

```bash
# Install frontend dependencies
bun install  # or npm install

# Install backend dependencies
cd backend
bun install  # or npm install
cd ..

# Install Python dependencies
poetry install
```

### 3. Configure Environment Variables

Create `.env` files for both frontend and backend:

```bash
# Create frontend .env
cp .env.example .env

# Create backend .env
cd backend
cp .env.example .env
cd ..
```

Configure the following environment variables:

```bash
# Frontend (.env)
VITE_API_URL=http://localhost:3000/api
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Backend (backend/.env)
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
OPENAI_$1=YOUR_API_KEY_HERE
$1=YOUR_API_KEY_HERE
GOOGLE_AI_$1=YOUR_API_KEY_HERE
```

### 4. Start the Development Servers

```bash
# Start the backend server
cd backend
bun dev  # or npm run dev

# In a new terminal, start the frontend
cd ..
bun dev  # or npm run dev
```

The application will be available at:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000`

## Basic Usage

### 1. Create an Account

1. Navigate to `http://localhost:5173`
2. Click "Sign Up"
3. Enter your email and password
4. Verify your email address

### 2. Start a Session

1. Log in to your account
2. Click "New Session"
3. Choose a session mode:
   - Text Chat
   - Voice Call
   - Video Call
4. Start communicating with the AI assistant

### 3. Use AI Features

During a session, you can:

- Enable real-time sentiment analysis
- Request topic summaries
- Get suggested responses
- Generate session notes

### 4. Manage Sessions

Access session management features:

- View session history
- Download transcripts
- Generate reports
- Set follow-up reminders

## Next Steps

<CardGroup>
  <Card title="Core Concepts" icon="book" href="/core/architecture">
    Learn about Pixelated Healths architecture and key concepts
  </Card>
  <Card
    title="API Documentation"
    icon="code"
    href="/api-reference/introduction"
  >
    Explore the API for custom integrations
  </Card>
  <Card title="Deployment Guide" icon="server" href="/deployment/requirements">
    Learn how to deploy to production
  </Card>
</CardGroup>

## Troubleshooting

### Common Issues

1. **Database Connection Issues**

   - Verify MongoDB Atlas credentials
   - Check network connectivity
   - Ensure proper environment variables

2. **API Authentication Errors**

   - Verify JWT secret
   - Check token expiration
   - Ensure proper CORS configuration

3. **WebSocket Connection Issues**
   - Check firewall settings
   - Verify WebSocket server status
   - Ensure proper SSL configuration

For more help, check our [deployment guide](/deployment/requirements) or [contact support](mailto:support@gemcity.xyz).
