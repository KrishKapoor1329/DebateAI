# Debate AI Assistant

A web application that provides an AI-powered debate assistant, featuring speech-to-text capabilities, OpenAI integration for rebuttals, and user authentication.

## Features

- AI-powered debate rebuttals using OpenAI's GPT-3.5 Turbo
- Speech-to-text transcription using Google Cloud Speech
- User authentication with Google OAuth
- Debate feedback and scoring
- Rate limiting for API protection
- SQLite database for storing user data and debate history

## Prerequisites

- Node.js (v12 or higher recommended)
- npm (comes with Node.js)
- Google Cloud account with Speech-to-Text API enabled
- OpenAI API key
- Google OAuth credentials

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/debate-ai-assistant.git
   cd debate-ai-assistant
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory and add the following environment variables:
   ```
   PORT=3000
   OPENAI_API_KEY=your_openai_api_key
   GOOGLE_APPLICATION_CREDENTIALS=path/to/your/google-credentials.json
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   SESSION_SECRET=your_session_secret
   ```

## Configuration

1. Set up Google Cloud credentials:
   - Create a project in Google Cloud Console
   - Enable the Speech-to-Text API
   - Create a service account and download the JSON key
   - Set the path to this JSON file in the `GOOGLE_APPLICATION_CREDENTIALS` environment variable

2. Set up Google OAuth:
   - Create OAuth 2.0 credentials in the Google Cloud Console
   - Set the authorized JavaScript origins and redirect URIs
   - Add the client ID and secret to the `.env` file

3. Obtain an OpenAI API key and add it to the `.env` file

## Usage

1. Start the server:
   ```bash
   npm start
   ```

2. Open a web browser and navigate to `http://localhost:3000` (or the port you specified)

3. Log in using Google authentication

4. Use the web interface to engage in debates with the AI assistant

## API Endpoints

- `POST /api/debate`: Submit a debate argument and receive an AI rebuttal
- `POST /api/transcribe`: Transcribe audio to text
- `GET /api/user`: Get current user information
- `GET /api/logout`: Log out the current user
- `GET /api/protected`: Example protected route (requires authentication)

## Database

The application uses SQLite for data storage. Two main tables are used:

1. `users`: Stores user information
   - `id`: Primary key
   - `google_id`: Google user ID
   - `display_name`: User's display name
   - `email`: User's email
   - `created_at`: Timestamp of user creation

2. `debates`: Stores debate history and statistics
   - `id`: Primary key
   - `user_id`: Foreign key referencing users table
   - `user_speech`: User's debate argument
   - `ai_reply`: AI's rebuttal
   - `argument_strength`: Calculated strength of the argument
   - `clarity`: Calculated clarity of the argument
   - `rebuttal_quality`: Calculated quality of the AI rebuttal
   - `created_at`: Timestamp of the debate

## License

This project is licensed under the [MIT License](LICENSE).
