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
// We wrap init in an async function so we can await a Firestore ping test
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
    
    // ---- PING TEST: verify Firestore is actually reachable ----
    await firestore.collection('_ping').limit(1).get();
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
      }
    };
  } catch (err) {
    console.error('Firebase init/ping failed, falling back to SQLite:', err.message);
    isFirebase = false;
  }
}

// Fallback database configuration (SQLite)
if (!isFirebase) {
  const sqlite3 = require('sqlite3').verbose();
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening SQLite database:', err.message);
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

      db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'normal'`, () => {});

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

      db.run(`ALTER TABLE submissions ADD COLUMN is_private INTEGER DEFAULT 0`, () => {});
      db.run(`ALTER TABLE submissions ADD COLUMN user_id INTEGER DEFAULT NULL`, () => {});

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

      db.run(`ALTER TABLE likes ADD COLUMN user_id INTEGER DEFAULT NULL`, () => {});

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
    }
  };
}
} // end initDatabase()
  });
}).catch(err => {
  console.error('Fatal: could not initialize database:', err);
  process.exit(1);
});
