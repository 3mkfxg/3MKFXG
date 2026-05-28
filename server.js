const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS - allow requests from GitHub Pages and any browser-hosted front-end
app.use(cors({
  origin: true, // allow all origins (static site, local dev, GitHub Pages, etc.)
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-session-token', 'x-admin-key']
}));
app.options('*', cors()); // handle pre-flight requests

// Middleware
app.use(express.json());

// Auto-detect whether static files are in public/ subfolder or root
const publicDir = fs.existsSync(path.join(__dirname, 'public', 'index.html'))
  ? path.join(__dirname, 'public')
  : __dirname;
console.log('Serving static files from:', publicDir);
app.use(express.static(publicDir));


// Database Drivers Setup
const dbPath = path.join(__dirname, 'database.sqlite');
const firebaseKeyPath = path.join(__dirname, 'firebase-key.json');

let dbAdapter = null;
let isFirebase = false;

// Alphanumeric password generator (6-8 characters)
function generatePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const len = Math.floor(Math.random() * 3) + 6; // Length 6, 7, or 8
  let result = '';
  for (let i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// High-entropy, extremely secure random password generator (14-16 chars, numbers, symbols, mixed case)
function generateSecurePassword() {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const allChars = uppercase + lowercase + numbers + special;

  const len = Math.floor(Math.random() * 3) + 14; // 14, 15, or 16 characters
  let result = '';

  // Guarantee at least one of each class is present
  result += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
  result += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
  result += numbers.charAt(Math.floor(Math.random() * numbers.length));
  result += special.charAt(Math.floor(Math.random() * special.length));

  for (let i = 4; i < len; i++) {
    result += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }

  // Shuffle characters to ensure completely random layout
  return result.split('').sort(() => 0.5 - Math.random()).join('');
}

// SHA-256 helper
function getSha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// --- DUAL DATABASE INITIALIZATION ---
async function initDatabase() {
  if (fs.existsSync(firebaseKeyPath)) {
    try {
      const admin = require('firebase-admin');
      const serviceAccount = require(firebaseKeyPath);

      // Only init if no app exists already
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      }

      const firestore = admin.firestore();

      // ---- PING TEST: verify Firestore is actually reachable with a 2-second timeout ----
      const pingPromise = firestore.collection('_ping').limit(1).get();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Firestore ping timeout (2s)')), 2000)
      );
      await Promise.race([pingPromise, timeoutPromise]);
      // If we reach here, Firestore is working
      isFirebase = true;
      console.log('--------------------------------------------------');
      console.log('🚀 FIREBASE ACTIVE: Connected to Cloud Firestore!');
      console.log('🔒 SECURITY ACTIVE: Keys are fully isolated on server.');
      console.log('🔓 AUTH PASSWORDS: Raw plain-text storage (no hashes).');
      console.log('🛡️ USER ROLES ACTIVE: Auto-promote @3mkfxg as Admin.');
      console.log('--------------------------------------------------');

      dbAdapter = {
        // 1. User registrations
        registerUser: (username, password, callback) => {
          const userDocRef = firestore.collection('users').doc(username);

          userDocRef.get()
            .then(doc => {
              if (doc.exists) {
                return callback(null, { exists: true });
              }

              // Auto-promote 3mkfxg to admin role
              const role = (username.toLowerCase() === '3mkfxg') ? 'admin' : 'normal';

              userDocRef.set({
                username,
                password, // plain text
                role,
                created_at: new Date().toISOString()
              })
                .then(() => {
                  callback(null, { exists: false, id: username, role });
                })
                .catch(err => callback(err));
            })
            .catch(err => callback(err));
        },

        // 2. User logins
        loginUser: (username, callback) => {
          firestore.collection('users').doc(username).get()
            .then(doc => {
              if (!doc.exists) {
                return callback(null, null);
              }
              callback(null, { id: doc.id, ...doc.data() });
            })
            .catch(err => callback(err));
        },

        // 3. Session tracking
        createSession: (token, userId, callback) => {
          firestore.collection('sessions').doc(token).set({
            user_id: userId,
            created_at: new Date().toISOString()
          })
            .then(() => callback(null))
            .catch(err => callback(err));
        },

        deleteSession: (token, callback) => {
          firestore.collection('sessions').doc(token).delete()
            .then(() => callback(null))
            .catch(err => callback(err));
        },

        getSessionUser: (token, callback) => {
          firestore.collection('sessions').doc(token).get()
            .then(doc => {
              if (!doc.exists) {
                return callback(null, null);
              }
              const session = doc.data();
              firestore.collection('users').doc(session.user_id).get()
                .then(userDoc => {
                  if (!userDoc.exists) {
                    return callback(null, null);
                  }
                  const userData = userDoc.data();
                  callback(null, { id: userDoc.id, username: userData.username, role: userData.role || 'normal' });
                })
                .catch(err => callback(err));
            })
            .catch(err => callback(err));
        },

        // 4. Submissions logic
        createSubmission: (name, question, password, passwordSha256, isPrivate, userId, callback) => {
          firestore.collection('submissions').add({
            name,
            question,
            password, // plain text
            password_sha256: passwordSha256,
            is_private: isPrivate,
            user_id: userId || null,
            created_at: new Date().toISOString()
          })
            .then(docRef => {
              callback(null, docRef.id);
            })
            .catch(err => callback(err));
        },

        getPublicSubmissions: (userId, callback) => {
          firestore.collection('submissions')
            .where('is_private', '==', 0)
            .get()
            .then(snapshot => {
              const submissions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              }));

              submissions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

              if (submissions.length === 0) {
                return callback(null, []);
              }

              // Fetch likes
              firestore.collection('likes').get()
                .then(likeSnapshot => {
                  const likeCounts = {};
                  likeSnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    likeCounts[data.submission_id] = (likeCounts[data.submission_id] || 0) + 1;
                  });

                  const result = submissions.map(s => ({
                    id: s.id,
                    name: s.name,
                    question: s.question,
                    created_at: s.created_at,
                    likes: likeCounts[s.id] || 0,
                    is_own: s.user_id === userId ? 1 : 0
                  }));

                  callback(null, result);
                })
                .catch(err => callback(err));
            })
            .catch(err => callback(err));
        },

        getUserSubmissions: (userId, callback) => {
          firestore.collection('submissions')
            .where('user_id', '==', userId)
            .get()
            .then(snapshot => {
              const submissions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              }));

              submissions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

              if (submissions.length === 0) {
                return callback(null, []);
              }

              firestore.collection('likes').get()
                .then(likeSnapshot => {
                  const likeCounts = {};
                  likeSnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    likeCounts[data.submission_id] = (likeCounts[data.submission_id] || 0) + 1;
                  });

                  const result = submissions.map(s => ({
                    id: s.id,
                    question: s.question,
                    is_private: s.is_private,
                    created_at: s.created_at,
                    likes: likeCounts[s.id] || 0
                  }));

                  callback(null, result);
                })
                .catch(err => callback(err));
            })
            .catch(err => callback(err));
        },

        // 5. Likes tracking
        registerLike: (submissionId, passwordUsedSha256, userId, callback) => {
          const docId = `${submissionId}_${passwordUsedSha256}`;
          const likesRef = firestore.collection('likes').doc(docId);

          likesRef.get()
            .then(doc => {
              if (doc.exists) {
                return callback(new Error('You have already liked this message'));
              }
              likesRef.set({
                submission_id: submissionId,
                password_used_sha256: passwordUsedSha256,
                user_id: userId || null,
                created_at: new Date().toISOString()
              })
                .then(() => {
                  firestore.collection('likes').where('submission_id', '==', submissionId).get()
                    .then(snap => {
                      callback(null, snap.size);
                    })
                    .catch(err => callback(null, null));
                })
                .catch(err => callback(err));
            })
            .catch(err => callback(err));
        },

        checkSubmissionPassword: (submissionId, passwordSha256, callback) => {
          firestore.collection('submissions').doc(submissionId).get()
            .then(doc => {
              if (!doc.exists) {
                return callback(null, null);
              }
              callback(null, doc.data());
            })
            .catch(err => callback(err));
        },

        // 6. Admin methods
        getAdminSubmissions: (callback) => {
          firestore.collection('submissions').get()
            .then(snapshot => {
              const submissions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              }));

              submissions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

              if (submissions.length === 0) {
                return callback(null, []);
              }

              // Fetch users for verified flags
              firestore.collection('users').get()
                .then(userSnapshot => {
                  const users = {};
                  userSnapshot.docs.forEach(doc => {
                    users[doc.id] = doc.data().username;
                  });

                  firestore.collection('likes').get()
                    .then(likeSnapshot => {
                      const likeCounts = {};
                      likeSnapshot.docs.forEach(doc => {
                        const data = doc.data();
                        likeCounts[data.submission_id] = (likeCounts[data.submission_id] || 0) + 1;
                      });

                      const result = submissions.map(s => ({
                        id: s.id,
                        name: s.name,
                        question: s.question,
                        is_private: s.is_private,
                        created_at: s.created_at,
                        likes: likeCounts[s.id] || 0,
                        registered_user: s.user_id ? (users[s.user_id] || null) : null
                      }));

                      callback(null, result);
                    })
                    .catch(err => callback(err));
                })
                .catch(err => callback(err));
            })
            .catch(err => callback(err));
        },

        deleteSubmission: (submissionId, callback) => {
          firestore.collection('submissions').doc(submissionId).delete()
            .then(() => {
              firestore.collection('likes').where('submission_id', '==', submissionId).get()
                .then(snapshot => {
                  const batch = firestore.batch();
                  snapshot.docs.forEach(doc => batch.delete(doc.ref));
                  batch.commit()
                    .then(() => callback(null))
                    .catch(err => callback(err));
                })
                .catch(err => callback(err));
            })
            .catch(err => callback(err));
        },

        getAllUsers: (callback) => {
          firestore.collection('users').get()
            .then(snapshot => {
              const users = snapshot.docs.map(doc => ({
                id: doc.id,
                username: doc.data().username,
                password: doc.data().password,
                role: doc.data().role || 'normal',
                created_at: doc.data().created_at
              }));
              users.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
              callback(null, users);
            })
            .catch(err => callback(err));
        },

        updateSubmissionLikes: (submissionId, newCount, callback) => {
          const likesRef = firestore.collection('likes').where('submission_id', '==', submissionId);
          likesRef.get()
            .then(snapshot => {
              const currentCount = snapshot.size;

              if (newCount === currentCount) {
                return callback(null);
              }

              if (newCount > currentCount) {
                const batch = firestore.batch();
                for (let i = currentCount; i < newCount; i++) {
                  const dummyHash = getSha256(`dummy_${submissionId}_${i}_${Math.random()}`);
                  const docId = `${submissionId}_${dummyHash}`;
                  const ref = firestore.collection('likes').doc(docId);
                  batch.set(ref, {
                    submission_id: submissionId,
                    password_used_sha256: dummyHash,
                    user_id: null,
                    created_at: new Date().toISOString()
                  });
                }
                batch.commit()
                  .then(() => callback(null))
                  .catch(err => callback(err));
              } else {
                const batch = firestore.batch();
                const docsToDelete = snapshot.docs.slice(0, currentCount - newCount);
                docsToDelete.forEach(doc => {
                  batch.delete(doc.ref);
                });
                batch.commit()
                  .then(() => callback(null))
                  .catch(err => callback(err));
              }
            })
            .catch(err => callback(err));
        },

        updateUserPassword: (username, newPassword, callback) => {
          firestore.collection('users').where('username', '==', username).get()
            .then(snapshot => {
              if (snapshot.empty) return callback(new Error('User not found'));
              const docId = snapshot.docs[0].id;
              firestore.collection('users').doc(docId).update({ password: newPassword })
                .then(() => callback(null))
                .catch(err => callback(err));
            })
            .catch(err => callback(err));
        }
      };
    } catch (err) {
      console.error('Firebase init/ping failed, falling back to SQLite:', err.message);
      isFirebase = false;
    }
  }

  // Fallback database configuration (SQLite)
  if (!isFirebase) {
    return new Promise((resolve, reject) => {
      const sqlite3 = require('sqlite3').verbose();
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Error opening SQLite database:', err.message);
          reject(err);
        } else {
          console.log('--------------------------------------------------');
          console.log('💾 SQLITE ACTIVE: Connected to Local SQLite Database!');
          console.log('💡 TIP: Drop "firebase-key.json" in root folder to auto-upgrade to Firebase Cloud!');
          console.log('🔓 AUTH PASSWORDS: Raw plain-text storage (no hashes).');
          console.log('🛡️ USER ROLES ACTIVE: Auto-promote @3mkfxg as Admin.');
          console.log('--------------------------------------------------');
          initializeSQLiteDatabase();
        }
      });

      function initializeSQLiteDatabase() {
        db.serialize(() => {
          // 1. Users
          db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT DEFAULT 'normal',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

          db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'normal'`, () => { });

          // 2. Sessions
          db.run(`
        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

          // 3. Submissions
          db.run(`
        CREATE TABLE IF NOT EXISTS submissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          question TEXT NOT NULL,
          password TEXT NOT NULL,
          password_sha256 TEXT NOT NULL,
          is_private INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          user_id INTEGER DEFAULT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
      `);

          db.run(`ALTER TABLE submissions ADD COLUMN is_private INTEGER DEFAULT 0`, () => { });
          db.run(`ALTER TABLE submissions ADD COLUMN user_id INTEGER DEFAULT NULL`, () => { });

          db.run(`
        CREATE INDEX IF NOT EXISTS idx_submissions_password_sha256 
        ON submissions(password_sha256)
      `);

          // 4. Likes
          db.run(`
        CREATE TABLE IF NOT EXISTS likes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          submission_id INTEGER NOT NULL,
          password_used_sha256 TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          user_id INTEGER DEFAULT NULL,
          FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(submission_id, password_used_sha256)
        )
      `);

          db.run(`ALTER TABLE likes ADD COLUMN user_id INTEGER DEFAULT NULL`, () => { });

          console.log('SQLite tables initialized successfully.');
        });
      }

      dbAdapter = {
        registerUser: (username, password, callback) => {
          db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
            if (err) return callback(err);
            if (row) return callback(null, { exists: true });

            // Auto-promote 3mkfxg to admin
            const role = (username.toLowerCase() === '3mkfxg') ? 'admin' : 'normal';

            db.run(
              'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
              [username, password, role], // raw plain text
              function (insertErr) {
                if (insertErr) return callback(insertErr);
                callback(null, { exists: false, id: this.lastID, role });
              }
            );
          });
        },

        loginUser: (username, callback) => {
          db.get('SELECT id, username, password, role FROM users WHERE username = ?', [username], (err, row) => {
            if (err) return callback(err);
            callback(null, row || null);
          });
        },

        createSession: (token, userId, callback) => {
          db.run('INSERT INTO sessions (token, user_id) VALUES (?, ?)', [token, userId], (err) => {
            callback(err || null);
          });
        },

        deleteSession: (token, callback) => {
          db.run('DELETE FROM sessions WHERE token = ?', [token], (err) => {
            callback(err || null);
          });
        },

        getSessionUser: (token, callback) => {
          db.get(
            `SELECT s.user_id, u.username, u.role 
         FROM sessions s 
         JOIN users u ON s.user_id = u.id 
         WHERE s.token = ?`,
            [token],
            (err, row) => {
              if (err || !row) return callback(err || null, null);
              callback(null, { id: row.user_id, username: row.username, role: row.role || 'normal' });
            }
          );
        },

        createSubmission: (name, question, password, passwordSha256, isPrivate, userId, callback) => {
          db.run(
            `INSERT INTO submissions (name, question, password, password_sha256, is_private, user_id) VALUES (?, ?, ?, ?, ?, ?)`,
            [name, question, password, passwordSha256, isPrivate, userId || null],
            function (err) {
              if (err) return callback(err);
              callback(null, this.lastID);
            }
          );
        },

        getPublicSubmissions: (userId, callback) => {
          db.all(
            `SELECT s.id, s.name, s.question, s.created_at, COUNT(l.id) AS likes,
                (CASE WHEN s.user_id = ? THEN 1 ELSE 0 END) AS is_own
         FROM submissions s 
         LEFT JOIN likes l ON s.id = l.submission_id 
         WHERE s.is_private = 0
         GROUP BY s.id 
         ORDER BY s.created_at DESC`,
            [userId],
            (err, rows) => {
              if (err) return callback(err);
              callback(null, rows);
            }
          );
        },

        getUserSubmissions: (userId, callback) => {
          db.all(
            `SELECT s.id, s.question, s.is_private, s.created_at, COUNT(l.id) AS likes 
         FROM submissions s 
         LEFT JOIN likes l ON s.id = l.submission_id 
         WHERE s.user_id = ?
         GROUP BY s.id 
         ORDER BY s.created_at DESC`,
            [userId],
            (err, rows) => {
              if (err) return callback(err);
              callback(null, rows);
            }
          );
        },

        registerLike: (submissionId, passwordUsedSha256, userId, callback) => {
          db.get(
            `SELECT id FROM likes WHERE submission_id = ? AND password_used_sha256 = ?`,
            [submissionId, passwordUsedSha256],
            (err, row) => {
              if (err) return callback(err);
              if (row) return callback(new Error('You have already liked this message'));

              db.run(
                `INSERT INTO likes (submission_id, password_used_sha256, user_id) VALUES (?, ?, ?)`,
                [submissionId, passwordUsedSha256, userId || null],
                (insertErr) => {
                  if (insertErr) return callback(insertErr);

                  db.get(
                    `SELECT COUNT(id) AS likes FROM likes WHERE submission_id = ?`,
                    [submissionId],
                    (countErr, countRow) => {
                      callback(null, countRow ? countRow.likes : null);
                    }
                  );
                }
              );
            }
          );
        },

        checkSubmissionPassword: (submissionId, passwordSha256, callback) => {
          db.all(
            `SELECT id, password FROM submissions WHERE id = ? AND password_sha256 = ?`,
            [submissionId, passwordSha256],
            (err, rows) => {
              if (err || !rows || rows.length === 0) return callback(err || null, null);
              callback(null, rows[0]);
            }
          );
        },

        getAdminSubmissions: (callback) => {
          db.all(
            `SELECT s.id, s.name, s.question, s.is_private, s.created_at, COUNT(l.id) AS likes, u.username AS registered_user 
         FROM submissions s 
         LEFT JOIN likes l ON s.id = l.submission_id 
         LEFT JOIN users u ON s.user_id = u.id
         GROUP BY s.id 
         ORDER BY s.created_at DESC`,
            [],
            (err, rows) => {
              if (err) return callback(err);
              callback(null, rows);
            }
          );
        },

        deleteSubmission: (submissionId, callback) => {
          db.run(`DELETE FROM submissions WHERE id = ?`, [submissionId], function (err) {
            if (err) return callback(err);
            db.run(`DELETE FROM likes WHERE submission_id = ?`, [submissionId], (likeErr) => {
              callback(likeErr || null);
            });
          });
        },

        getAllUsers: (callback) => {
          db.all('SELECT id, username, password, role, created_at FROM users ORDER BY created_at DESC', [], (err, rows) => {
            if (err) return callback(err);
            callback(null, rows);
          });
        },

        updateSubmissionLikes: (submissionId, newCount, callback) => {
          db.get('SELECT COUNT(*) AS count FROM likes WHERE submission_id = ?', [submissionId], (err, row) => {
            if (err) return callback(err);
            const currentCount = row.count;

            if (newCount === currentCount) {
              return callback(null);
            }

            if (newCount > currentCount) {
              db.serialize(() => {
                const stmt = db.prepare('INSERT INTO likes (submission_id, password_used_sha256) VALUES (?, ?)');
                for (let i = currentCount; i < newCount; i++) {
                  const dummyHash = getSha256(`dummy_${submissionId}_${i}_${Math.random()}`);
                  stmt.run(submissionId, dummyHash);
                }
                stmt.finalize((finalizeErr) => {
                  callback(finalizeErr || null);
                });
              });
            } else {
              const limit = currentCount - newCount;
              db.run(
                `DELETE FROM likes WHERE id IN (
                   SELECT id FROM likes WHERE submission_id = ? LIMIT ?
                 )`,
                [submissionId, limit],
                (deleteErr) => {
                  callback(deleteErr || null);
                }
              );
            }
          });
        },

        updateUserPassword: (username, newPassword, callback) => {
          db.run('UPDATE users SET password = ? WHERE username = ?', [newPassword, username], (err) => {
            callback(err || null);
          });
        }
      };
    });
  }
} // end initDatabase()

// --- MIDDLEWARE FOR USER AUTH ---
function checkUserAuth(req, res, next) {
  const token = req.headers['x-session-token'];
  if (!token) {
    req.user = null;
    return next();
  }

  dbAdapter.getSessionUser(token, (err, user) => {
    req.user = user;
    next();
  });
}

// --- API AUTH ROUTES ---

// 1. Sign Up (Register with automatically generated high-security password)
app.post('/api/auth/register', (req, res) => {
  const { username } = req.body;

  if (!username || typeof username !== 'string' || username.trim() === '') {
    return res.status(400).json({ error: 'Username is required' });
  }

  const trimmedUsername = username.trim();
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!usernameRegex.test(trimmedUsername)) {
    return res.status(400).json({ error: 'Username must be 3-20 characters and contain only letters, numbers, and underscores' });
  }

  const securePassword = generateSecurePassword();

  dbAdapter.registerUser(trimmedUsername, securePassword, (err, result) => {
    if (err) {
      console.error('Register db error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (result.exists) {
      return res.status(409).json({ error: 'Username is already taken' });
    }

    const token = crypto.randomBytes(32).toString('hex');

    dbAdapter.createSession(token, result.id, (sessionErr) => {
      if (sessionErr) {
        console.error('Session establishment failure:', sessionErr);
        return res.status(500).json({ error: 'Failed to establish session' });
      }
      res.status(201).json({ token, username: trimmedUsername, password: securePassword, role: result.role });
    });
  });
});

// 2. Sign In (Login with direct plain-text comparisons)
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const trimmedUsername = username.trim();

  dbAdapter.loginUser(trimmedUsername, (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!user || password !== user.password) { // plain text match directly
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    dbAdapter.createSession(token, user.id, (sessionErr) => {
      if (sessionErr) {
        return res.status(500).json({ error: 'Failed to establish session' });
      }
      res.json({ token, username: trimmedUsername, role: user.role || 'normal' });
    });
  });
});

// 3. Log Out
app.post('/api/auth/logout', (req, res) => {
  const token = req.headers['x-session-token'];
  if (!token) {
    return res.json({ success: true });
  }

  dbAdapter.deleteSession(token, () => {
    res.json({ success: true });
  });
});

// 4. Get Current User Profile (me)
app.get('/api/auth/me', checkUserAuth, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }
  res.json({ id: req.user.id, username: req.user.username, role: req.user.role });
});

// 5. Get Logged-in User's own submissions
app.get('/api/user/whispers', checkUserAuth, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  dbAdapter.getUserSubmissions(req.user.id, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch user whispers' });
    }
    res.json(rows);
  });
});

// --- CORE QUESTIONS API ---

// 1. Submit a question
app.post('/api/questions', checkUserAuth, (req, res) => {
  const { name, question } = req.body;

  if (!question || typeof question !== 'string' || question.trim() === '') {
    return res.status(400).json({ error: 'Question is required' });
  }

  const trimmedQuestion = question.trim();
  if (trimmedQuestion.length > 300) {
    return res.status(400).json({ error: 'Question must be 300 characters or less' });
  }

  const isPrivateVal = (req.body.is_private === true || req.body.is_private === 1 || req.body.is_private === '1') ? 1 : 0;

  if (req.user) {
    const trimmedName = req.user.username;
    const dummyPassword = generatePassword();
    const password_sha256 = getSha256(dummyPassword);

    dbAdapter.createSubmission(trimmedName, trimmedQuestion, dummyPassword, password_sha256, isPrivateVal, req.user.id, (err, insertId) => {
      if (err) {
        console.error('Database insert error:', err);
        return res.status(500).json({ error: 'Failed to save question' });
      }

      res.status(201).json({
        id: insertId,
        authenticated: true,
        message: 'Question submitted successfully'
      });
    });
  } else {
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Name is required for anonymous posts' });
    }
    const trimmedName = name.trim();
    if (trimmedName.length > 50) {
      return res.status(400).json({ error: 'Name must be 50 characters or less' });
    }

    const password = generatePassword();
    const password_sha256 = getSha256(password);

    dbAdapter.createSubmission(trimmedName, trimmedQuestion, password, password_sha256, isPrivateVal, null, (err, insertId) => {
      if (err) {
        console.error('Database insert error:', err);
        return res.status(500).json({ error: 'Failed to save question' });
      }

      res.status(201).json({
        id: insertId,
        password: password,
        authenticated: false,
        message: 'Question submitted successfully'
      });
    });
  }
});

// 2. Get all questions (Public display)
app.get('/api/questions', checkUserAuth, (req, res) => {
  const userId = req.user ? req.user.id : null;
  dbAdapter.getPublicSubmissions(userId, (err, rows) => {
    if (err) {
      console.error('Database query error:', err);
      return res.status(500).json({ error: 'Failed to retrieve questions' });
    }
    res.json(rows);
  });
});

// 3. Like a question (Supports anonymous password or authenticated session)
app.post('/api/questions/:id/like', checkUserAuth, (req, res) => {
  const { id } = req.params;

  if (req.user) {
    const userId = req.user.id;
    const userVoteHash = getSha256(`user_${userId}`);

    dbAdapter.registerLike(id, userVoteHash, userId, (err, newCount) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      res.json({ success: true, likes: newCount });
    });
  } else {
    const { password } = req.body;
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required' });
    }

    const password_sha256 = getSha256(password.trim());

    dbAdapter.checkSubmissionPassword(id, password_sha256, (err, submission) => {
      if (err || !submission) {
        return res.status(401).json({ error: 'Invalid password. Submit a question to get a password.' });
      }

      // Match plain-text directly as requested
      if (password.trim() !== submission.password) {
        return res.status(401).json({ error: 'Invalid password.' });
      }

      dbAdapter.registerLike(id, password_sha256, null, (likeErr, newCount) => {
        if (likeErr) {
          return res.status(400).json({ error: likeErr.message });
        }
        res.json({ success: true, likes: newCount });
      });
    });
  }
});

// --- SECURE ADMIN ENDPOINTS (3MKFXG Dashboards) ---
const ADMIN_SECRET_KEY = '3mkfxgadmin';

// Gated middleware check supporting EITHER standard passcode OR verified user admin session!
function checkAdminAuth(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (key && key === ADMIN_SECRET_KEY) {
    return next();
  }

  const token = req.headers['x-session-token'] || req.query.token;
  if (token) {
    dbAdapter.getSessionUser(token, (err, user) => {
      if (user && user.role === 'admin') {
        req.adminUser = user;
        return next();
      }
      return res.status(401).json({ error: 'Unauthorized. Admin role credentials required.' });
    });
  } else {
    return res.status(401).json({ error: 'Unauthorized. Admin passcode or active session token required.' });
  }
}

// 1. Get ALL questions (both public & private, revealing submitter names)
app.get('/api/admin/questions', checkAdminAuth, (req, res) => {
  dbAdapter.getAdminSubmissions((err, rows) => {
    if (err) {
      console.error('Admin query error:', err);
      return res.status(500).json({ error: 'Failed to retrieve admin messages' });
    }
    res.json(rows);
  });
});

// 2. Delete a question completely
app.delete('/api/admin/questions/:id', checkAdminAuth, (req, res) => {
  const { id } = req.params;
  dbAdapter.deleteSubmission(id, (err) => {
    if (err) {
      console.error('Admin delete error:', err);
      return res.status(500).json({ error: 'Failed to delete message' });
    }
    res.json({ success: true, message: 'Message deleted successfully' });
  });
});

// 3. Get all registered users
app.get('/api/admin/users', checkAdminAuth, (req, res) => {
  dbAdapter.getAllUsers((err, users) => {
    if (err) {
      console.error('Admin users query error:', err);
      return res.status(500).json({ error: 'Failed to retrieve registered users' });
    }
    res.json(users);
  });
});

// 4. Update a question's likes count
app.post('/api/admin/questions/:id/likes', checkAdminAuth, (req, res) => {
  const { id } = req.params;
  const likesCount = parseInt(req.body.likes);

  if (isNaN(likesCount) || likesCount < 0) {
    return res.status(400).json({ error: 'Likes count must be a non-negative number' });
  }

  dbAdapter.updateSubmissionLikes(id, likesCount, (err) => {
    if (err) {
      console.error('Admin likes update error:', err);
      return res.status(500).json({ error: 'Failed to update likes count' });
    }
    res.json({ success: true, likes: likesCount });
  });
});

// 5. Update a user's password
app.post('/api/admin/users/:username/password', checkAdminAuth, (req, res) => {
  const { username } = req.params;
  const { password } = req.body;

  if (!password || typeof password !== 'string' || password.trim() === '') {
    return res.status(400).json({ error: 'Password is required' });
  }

  dbAdapter.updateUserPassword(username, password.trim(), (err) => {
    if (err) {
      console.error('Admin user password update error:', err);
      return res.status(500).json({ error: 'Failed to update user password' });
    }
    res.json({ success: true, message: `Password for @${username} updated successfully` });
  });
});

// Serve frontend routing (fallback for single-page apps)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server immediately so it binds to the port and passes Render's health checks
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Initialize database in the background
initDatabase()
  .then(() => {
    console.log('Database initialization completed successfully.');
  })
  .catch(err => {
    console.error('Fatal: could not initialize database:', err);
    server.close(() => {
      process.exit(1);
    });
  });
