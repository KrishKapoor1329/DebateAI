require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const OpenAI = require('openai');  // Assuming you're using the updated version of OpenAI
const speech = require('@google-cloud/speech');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const natural = require('natural');
const path = require('path');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const axiosRetry = require('axios-retry');
const sqlite3 = require('sqlite3').verbose();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');

const app = express();
const port = process.env.PORT || 3000;
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

app.use(bodyParser.json());
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_session_secret',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/callback"
  },
  function(accessToken, refreshToken, profile, cb) {
    // Here you would typically find or create a user in your database
    db.get("SELECT * FROM users WHERE google_id = ?", [profile.id], (err, row) => {
      if (err) {
        return cb(err);
      }
      if (!row) {
        // If the user doesn't exist, create a new one
        db.run("INSERT INTO users (google_id, display_name, email) VALUES (?, ?, ?)", 
          [profile.id, profile.displayName, profile.emails[0].value], 
          function(err) {
            if (err) {
              return cb(err);
            }
            return cb(null, { id: this.lastID, google_id: profile.id, display_name: profile.displayName });
          });
      } else {
        // If the user exists, return it
        return cb(null, row);
      }
    });
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
    done(err, row);
  });
});

// Serve the HTML file for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'front.html'));
});

app.post('/api/debate', ensureAuthenticated, async (req, res) => {
  const userSpeech = req.body.userSpeech;
  const userId = req.user.id;

  try {
    console.log('Sending request to OpenAI API...');
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a debate AI assistant. Provide brief rebuttals.' },
        { role: 'user', content: userSpeech }
      ],
      max_tokens: 100,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Received response from OpenAI API');
    const reply = response.data.choices[0].message.content.trim();
    
    // Generate feedback
    const feedback = generateFeedback(userSpeech, reply);

    // Save debate transcript and statistics
    db.run(`INSERT INTO debates (user_id, user_speech, ai_reply, argument_strength, clarity, rebuttal_quality) 
            VALUES (?, ?, ?, ?, ?, ?)`, 
      [userId, userSpeech, reply, feedback.argumentStrength, feedback.clarity, feedback.rebuttalQuality], 
      function(err) {
        if (err) {
          console.error('Error saving debate:', err.message);
        } else {
          console.log('Debate saved successfully');
        }
      });

    res.json({ reply, feedback });
  } catch (error) {
    console.error('Error with GPT API:', error.response ? error.response.data : error.message);
    
    // Fallback mechanism
    const fallbackReply = "I apologize, but I'm unable to provide a specific rebuttal at the moment. In general, a strong argument should be clear, well-supported, and address potential counterpoints.";
    const fallbackFeedback = {
      argumentStrength: 5,
      clarity: 5,
      rebuttalQuality: 5,
      tips: ["Support your arguments with evidence.", "Consider opposing viewpoints.", "Practice clear communication."]
    };
    
    res.json({ reply: fallbackReply, feedback: fallbackFeedback });
  }
});

function generateFeedback(userSpeech, aiReply) {
  // Simple metrics calculation (you may want to use more sophisticated NLP techniques)
  const argumentStrength = Math.min(10, natural.JaroWinklerDistance(userSpeech, aiReply) * 10);
  const clarity = Math.min(10, userSpeech.split(' ').length / 20);
  const rebuttalQuality = Math.min(10, aiReply.split(' ').length / 15);

  // Generate improvement tips (you can expand this based on your specific requirements)
  const tips = [];
  if (argumentStrength < 7) tips.push("Try to provide more evidence to support your argument.");
  if (clarity < 7) tips.push("Work on making your points more concise and clear.");
  if (rebuttalQuality < 7) tips.push("Consider addressing the opponent's key points more directly.");

  return {
    argumentStrength,
    clarity,
    rebuttalQuality,
    tips
  };
}

// Initialize Google Cloud Speech client
const credentialsPath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
const speechClient = new speech.SpeechClient({
  keyFilename: credentialsPath
});

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  try {
    const audioBytes = req.file.buffer.toString('base64');
    const audio = {
      content: audioBytes,
    };
    const config = {
      encoding: 'WEBM_OPUS',
      sampleRateHertz: 48000,  // Changed from 16000 to 48000
      languageCode: 'en-US',
    };
    const request = {
      audio: audio,
      config: config,
    };

    const [response] = await speechClient.recognize(request);
    const transcription = response.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');

    res.json({ transcription });
  } catch (error) {
    console.error('Error during transcription:', error);
    res.status(500).json({ error: 'An error occurred during transcription.' });
  }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50 // limit each IP to 50 requests per windowMs
});

// Apply rate limiter to API calls
app.use('/api/', apiLimiter);

// Connect to SQLite database
const db = new sqlite3.Database(path.join(__dirname, 'debaite.db'), (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initializeDatabase();
  }
});

// Initialize database schema
function initializeDatabase() {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE,
    display_name TEXT,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating users table:', err.message);
    } else {
      console.log('Users table created or already exists.');
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS debates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    user_speech TEXT,
    ai_reply TEXT,
    argument_strength REAL,
    clarity REAL,
    rebuttal_quality REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating debates table:', err.message);
    } else {
      console.log('Debates table created or already exists.');
      
      // Use a promise-based approach for better error handling
      new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(debates)`, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      })
      .then(rows => {
        console.log('PRAGMA result:', rows);  // Debug log
        const hasUserIdColumn = rows.some(row => row.name === 'user_id');
        if (!hasUserIdColumn) {
          return new Promise((resolve, reject) => {
            db.run(`ALTER TABLE debates ADD COLUMN user_id INTEGER REFERENCES users(id)`, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        }
      })
      .then(() => {
        console.log('Database initialization completed successfully.');
      })
      .catch(err => {
        console.error('Error during database initialization:', err.message);
      });
    }
  });
}

// Middleware
app.use(express.json());

// Test endpoint
app.get('/api/db-test', (req, res) => {
  db.all('SELECT name FROM sqlite_master WHERE type="table"', [], (err, tables) => {
    if (err) {
      res.status(500).json({ error: 'Database error', message: err.message });
    } else {
      res.json({ message: 'Connected to SQLite', tables: tables.map(t => t.name) });
    }
  });
});

// Example endpoint to save a debate
app.post('/api/debate', (req, res) => {
  const { userSpeech, aiReply, argumentStrength, clarity, rebuttalQuality } = req.body;
  db.run(`INSERT INTO debates (user_speech, ai_reply, argument_strength, clarity, rebuttal_quality) 
          VALUES (?, ?, ?, ?, ?)`, 
    [userSpeech, aiReply, argumentStrength, clarity, rebuttalQuality], 
    function(err) {
      if (err) {
        res.status(500).json({ error: 'Error saving debate', message: err.message });
      } else {
        res.json({ message: 'Debate saved successfully', id: this.lastID });
      }
    });
});

// Auth Routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/');
  });

app.get('/api/user', (req, res) => {
  res.json(req.user || null);
});

app.get('/api/logout', (req, res) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

// Middleware to check if user is authenticated
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Not authenticated' });
}

// Protected route example
app.get('/api/protected', ensureAuthenticated, (req, res) => {
  res.json({ message: 'This is a protected route', user: req.user });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Closed the database connection.');
    process.exit(0);
  });
});

