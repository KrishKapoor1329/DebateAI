Tech Stack:
Node.js: The server-side runtime environment.
Express.js: Web application framework for Node.js, used for routing and middleware.
SQLite: Lightweight, serverless database used for storing user information and debate data.
Passport.js: Authentication middleware for Node.js, used here with Google OAuth 2.0 strategy.
OpenAI API: Used to generate AI responses in debates.
Google Cloud Speech-to-Text API: For transcribing audio to text.
Natural: A natural language processing library for Node.js, used for basic text analysis.
Multer: Middleware for handling multipart/form-data, used for file uploads (audio files).
Axios: Promise-based HTTP client for making API requests.
Express Rate Limit: Middleware to limit repeated requests to public APIs.
Key Components:
Authentication:
Uses Passport.js with Google OAuth 2.0 for user authentication.
Stores user information in the SQLite database.
Speech-to-Text:
Utilizes Google Cloud Speech-to-Text API to transcribe audio files.
AI Debate Assistant:
Integrates with OpenAI's GPT model to generate debate responses.
Database Operations:
Uses SQLite to store user data and debate transcripts.
Includes functions for initializing the database schema.
API Endpoints:
/api/debate: Handles debate interactions, including AI responses and feedback generation.
/api/transcribe: Handles audio transcription requests.
Various authentication-related endpoints.
Feedback Generation:
Implements a basic feedback system for debates, analyzing argument strength, clarity, and rebuttal quality.
Rate Limiting:
Implements rate limiting on API routes to prevent abuse.
Error Handling and Logging:
Includes error handling for API requests and database operations.
Logs various operations and errors for debugging.
9. Security Measures:
Uses environment variables for sensitive information (API keys, secrets).
Implements user authentication checks for protected routes.
