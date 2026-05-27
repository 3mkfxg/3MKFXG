// ==========================================================================
// 3MK F X G WORLD - Main Frontend Application Logic (User Auth Integrated)
// ==========================================================================

// ==== API BASE URL =================================================
const API_BASE = 'https://threemkfxg-imju.onrender.com'; // Render backend URL
// ====================================================================

// 3MK F X G WORLD - Main Frontend Application Logic (User Auth Integrated)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Authentication Elements
  const authGuestView = document.getElementById('auth-guest-view');
  const authUserView = document.getElementById('auth-user-view');
  const authUsername = document.getElementById('auth-username');
  const btnToggleDashboard = document.getElementById('btn-toggle-dashboard');
  const btnLogout = document.getElementById('btn-logout');

  // User Dashboard Elements
  const userDashboardSection = document.getElementById('user-dashboard-section');
  const userWhisperCount = document.getElementById('user-whisper-count');
  const userWhispersLoading = document.getElementById('user-whispers-loading');
  const userWhispersEmpty = document.getElementById('user-whispers-empty');
  const userWhispersGrid = document.getElementById('user-whispers-grid');

  // Core Feed Elements
  const questionsGrid = document.getElementById('questions-grid');
  const feedLoading = document.getElementById('feed-loading');
  const feedEmpty = document.getElementById('feed-empty');
  const questionCountBadge = document.getElementById('question-count');

  // Modals
  const modalSubmit = document.getElementById('modal-submit');
  const modalSuccess = document.getElementById('modal-success');
  const modalLike = document.getElementById('modal-like');

  // Forms & Inputs
  const formSubmit = document.getElementById('form-submit-question');
  const inputName = document.getElementById('input-name');
  const selectVisibility = document.getElementById('select-visibility');
  const inputQuestion = document.getElementById('input-question');
  const charCurrent = document.getElementById('char-current');

  const formLike = document.getElementById('form-like-verify');
  const inputLikePassword = document.getElementById('input-like-password');
  const btnToggleLikePassword = document.getElementById('btn-toggle-like-password');

  // Buttons
  const btnOpenSubmit = document.getElementById('btn-open-submit-modal');
  const btnCloseSubmit = document.getElementById('btn-close-submit-modal');
  const btnCloseSuccess = document.getElementById('btn-close-success');
  const btnCloseLike = document.getElementById('btn-close-like-modal');
  const btnCopyPassword = document.getElementById('btn-copy-password');

  // Dynamic Content Displays
  const displayPassword = document.getElementById('display-password');
  const toastContainer = document.getElementById('toast-container');

  // Application State
  let currentTargetLikeId = null;
  let currentUser = null;
  let sessionToken = localStorage.getItem('3mkfxg_session_token') || '';
  let isDashboardVisible = false;

  // --- LOCAL STORAGE UTILITIES ---
  const storageKeys = {
    password: '3mkfxg_saved_password',
    likedQuestions: '3mkfxg_liked_questions'
  };

  function getSavedPassword() {
    return localStorage.getItem(storageKeys.password) || '';
  }

  function savePassword(pwd) {
    if (pwd) localStorage.setItem(storageKeys.password, pwd.trim());
  }

  function getLikedQuestions() {
    try {
      return JSON.parse(localStorage.getItem(storageKeys.likedQuestions)) || {};
    } catch {
      return {};
    }
  }

  function markQuestionAsLiked(id) {
    const liked = getLikedQuestions();
    liked[id] = true;
    localStorage.setItem(storageKeys.likedQuestions, JSON.stringify(liked));
  }

  // --- OWN SUBMISSIONS UTILITIES ---
  function getOwnSubmissions() {
    try {
      return JSON.parse(localStorage.getItem('3mkfxg_own_submissions')) || {};
    } catch {
      return {};
    }
  }

  function markSubmissionAsOwn(id) {
    const own = getOwnSubmissions();
    own[id] = true;
    localStorage.setItem('3mkfxg_own_submissions', JSON.stringify(own));
  }


  // --- PREMIUM TOAST NOTIFICATION SYSTEM ---
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : 'toast-success'}`;
    
    const icon = document.createElement('i');
    if (type === 'error') {
      icon.className = 'fa-solid fa-circle-exclamation';
    } else {
      icon.className = 'fa-solid fa-circle-check';
    }
    
    const textNode = document.createElement('span');
    textNode.innerText = message;
    
    toast.appendChild(icon);
    toast.appendChild(textNode);
    toastContainer.appendChild(toast);
    
    // Smooth removal
    setTimeout(() => {
      toast.classList.add('toast-out');
      toast.addEventListener('animationend', () => {
        toast.remove();
      });
    }, 3500);
  }

  // --- TIME FORMATTING (Relative) ---
  function formatRelativeTime(dateString) {
    const now = new Date();
    const date = new Date(dateString);
    const seconds = Math.floor((now - date) / 1000);

    if (isNaN(date.getTime())) return 'some time ago';

    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60
    };

    if (seconds < 10) return 'just now';

    for (const [key, value] of Object.entries(intervals)) {
      const count = Math.floor(seconds / value);
      if (count >= 1) {
        return `${count} ${key}${count > 1 ? 's' : ''} ago`;
      }
    }
    return 'just now';
  }

  // --- IDENTITY VERIFICATION ---
  async function checkIdentity() {
    if (!sessionToken) {
      updateAuthUI(null);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { 'x-session-token': sessionToken }
      });

      if (!response.ok) throw new Error('Session invalid');

      const data = await response.json();
      updateAuthUI(data.username);
    } catch (err) {
      localStorage.removeItem('3mkfxg_session_token');
      sessionToken = '';
      updateAuthUI(null);
    }
  }

  function updateAuthUI(username) {
    currentUser = username;

    if (username) {
      // User state
      authGuestView.classList.add('hidden');
      authUserView.classList.remove('hidden');
      authUsername.innerText = `@${username}`;

      // Form overrides (Lock name to registered user)
      inputName.value = username;
      inputName.readOnly = true;
      inputName.style.background = 'rgba(0, 255, 102, 0.03)';
      inputName.style.borderColor = 'rgba(0, 255, 102, 0.15)';
      inputName.placeholder = '';
      
      const hint = formSubmit.querySelector('.label-hint');
      if (hint) hint.innerHTML = '<i class="fa-solid fa-lock" style="color: #00ff66;"></i> Identity Verified';
    } else {
      // Guest state
      authGuestView.classList.remove('hidden');
      authUserView.classList.add('hidden');
      userDashboardSection.classList.add('hidden');
      
      inputName.value = '';
      inputName.readOnly = false;
      inputName.style.background = '';
      inputName.style.borderColor = '';
      inputName.placeholder = 'e.g., Jane Doe';
      
      const hint = formSubmit.querySelector('.label-hint');
      if (hint) hint.innerText = '(Private — never shown publicly)';
    }
  }

  // --- USER DASHBOARD LOGS ---
  async function fetchUserWhispers() {
    if (!sessionToken) return;

    try {
      userWhispersLoading.classList.remove('hidden');
      userWhispersEmpty.classList.add('hidden');
      userWhispersGrid.classList.add('hidden');

      const response = await fetch('/api/user/whispers', {
        headers: { 'x-session-token': sessionToken }
      });

      if (!response.ok) throw new Error('Failed to fetch personal log');

      const whispers = await response.json();
      renderUserWhispers(whispers);
    } catch (error) {
      console.error(error);
      showToast('Could not load your personal console logs.', 'error');
      userWhispersLoading.classList.add('hidden');
    }
  }

  function renderUserWhispers(whispers) {
    userWhispersLoading.classList.add('hidden');
    userWhispersGrid.innerHTML = '';
    userWhisperCount.innerText = `${whispers.length} sent`;

    if (whispers.length === 0) {
      userWhispersEmpty.classList.remove('hidden');
      return;
    }

    userWhispersGrid.classList.remove('hidden');

    whispers.forEach(q => {
      const card = document.createElement('div');
      const isPrivate = q.is_private === 1;
      card.className = `whisper-card ${isPrivate ? 'private-whisper' : ''}`;
      
      const badgeHTML = isPrivate 
        ? `<span class="author-badge" style="color: #f87171; background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.2);"><i class="fa-solid fa-lock"></i> PRIVATE SECRET</span>`
        : `<span class="author-badge"><i class="fa-solid fa-globe"></i> PUBLIC WHISPER</span>`;

      card.innerHTML = `
        <div style="display: flex; flex-direction: column; justify-content: space-between; height: 100%; flex-grow: 1;">
          <div>
            ${badgeHTML}
            <p class="whisper-content" style="margin-top: 8px;">${escapeHTML(q.question)}</p>
          </div>
          <div class="whisper-footer" style="margin-top: 12px; padding-top: 6px;">
            <span class="whisper-time"><i class="fa-regular fa-clock"></i> ${formatRelativeTime(q.created_at)}</span>
            <span class="like-count" style="font-size: 0.8rem; font-weight: 600;"><i class="fa-solid fa-heart" style="color: var(--accent-purple);"></i> ${q.likes}</span>
          </div>
        </div>
      `;
      userWhispersGrid.appendChild(card);
    });
  }

  // --- API OPERATIONS ---

  // Fetch and Render Feed
  async function fetchQuestions() {
    try {
      feedLoading.classList.remove('hidden');
      feedEmpty.classList.add('hidden');
      questionsGrid.classList.add('hidden');

      const response = await fetch(`${API_BASE}/api/questions`);
      if (!response.ok) throw new Error('Failed to fetch questions');

      const questions = await response.json();
      renderQuestions(questions);
    } catch (error) {
      console.error(error);
      showToast('Could not load board whispers. Try again.', 'error');
      feedLoading.classList.add('hidden');
    }
  }

  function renderQuestions(questions) {
    feedLoading.classList.add('hidden');
    questionsGrid.innerHTML = '';
    
    // Update Badge
    questionCountBadge.innerText = `${questions.length} whisper${questions.length !== 1 ? 's' : ''}`;

    if (questions.length === 0) {
      feedEmpty.classList.remove('hidden');
      return;
    }

    questionsGrid.classList.remove('hidden');
    const likedList = getLikedQuestions();
    const ownSubmissions = getOwnSubmissions();

    questions.forEach(q => {
      const isAlreadyLiked = !!likedList[q.id];
      const isOwn = q.is_own === 1 || !!ownSubmissions[q.id];
      const card = document.createElement('div');
      card.className = 'whisper-card';
      card.setAttribute('data-id', q.id);

      const ownBadgeHTML = isOwn 
        ? `<span class="own-whisper-tag"><i class="fa-solid fa-user"></i> YOU</span>` 
        : '';

      const authorNameHTML = `<span class="whisper-author-name"><i class="fa-regular fa-user" style="opacity: 0.6; font-size: 0.7rem;"></i> Anonymous #${q.id}</span>`;

      card.innerHTML = `
        <div class="whisper-header-row" style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 4px; z-index: 1;">
          ${authorNameHTML}
          ${ownBadgeHTML}
        </div>
        <p class="whisper-content" style="flex-grow: 1; margin-bottom: 4px; z-index: 1;">${escapeHTML(q.question)}</p>
        <div class="whisper-footer" style="z-index: 1;">
          <span class="whisper-time">
            <i class="fa-regular fa-clock"></i> ${formatRelativeTime(q.created_at)}
          </span>
          <div class="like-action-wrapper">
            <span class="like-count" id="likes-count-${q.id}">${q.likes}</span>
            <button class="btn-like ${isAlreadyLiked ? 'liked' : ''}" data-id="${q.id}" aria-label="Like message">
              <i class="${isAlreadyLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
            </button>
          </div>
        </div>
      `;

      questionsGrid.appendChild(card);
    });

    // Wire up dynamic click listener for heart button inside card
    document.querySelectorAll('.btn-like').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const questionId = btn.getAttribute('data-id');
        handleLikeClick(questionId);
      });
    });
  }

  // HTML Escaping for security
  function escapeHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- ACTIONS & MODAL MANAGERS ---

  // Character Counter for form submission
  inputQuestion.addEventListener('input', () => {
    charCurrent.innerText = inputQuestion.value.length;
  });

  // Open modal helper with clean focus
  function openModal(modal) {
    modal.classList.remove('hidden');
  }

  function closeModal(modal) {
    modal.classList.add('hidden');
  }

  // Trigger Add Submission Modal
  btnOpenSubmit.addEventListener('click', () => {
    if (!currentUser) {
      // Guest: redirect to login page
      window.location.href = 'login.html';
      return;
    }
    // Logged-in flow
    inputQuestion.value = '';
    charCurrent.innerText = '0';
    openModal(modalSubmit);
    setTimeout(() => {
      inputQuestion.focus();
    }, 150);
  });

  btnCloseSubmit.addEventListener('click', () => closeModal(modalSubmit));

  // Submit Question Form
  formSubmit.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = inputName.value.trim();
    const question = inputQuestion.value.trim();
    const is_private = parseInt(selectVisibility.value) || 0;

    if (!question) return;
    if (!currentUser && !name) return;

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (sessionToken) headers['x-session-token'] = sessionToken;

      const response = await fetch(`${API_BASE}/api/questions`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ name, question, is_private })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit question');
      }

      // Handle Success
      closeModal(modalSubmit);
      
      if (data.id) {
        markSubmissionAsOwn(data.id);
      }

      if (data.authenticated) {
        // Authenticated direct success (no password shown)
        fetchQuestions();
        if (isDashboardVisible) fetchUserWhispers();
        showToast('Whisper posted successfully!');
      } else {
        // Anonymous success (show generated password)
        savePassword(data.password);
        displayPassword.innerText = data.password;
        openModal(modalSuccess);
        fetchQuestions();
        showToast('Whisper posted successfully!');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Close Success Modal
  btnCloseSuccess.addEventListener('click', () => {
    closeModal(modalSuccess);
  });

  // Copy Password Clipboard Action
  btnCopyPassword.addEventListener('click', () => {
    const text = displayPassword.innerText;
    navigator.clipboard.writeText(text).then(() => {
      showToast('Password copied to clipboard!');
      const icon = btnCopyPassword.querySelector('i');
      icon.className = 'fa-solid fa-check';
      setTimeout(() => {
        icon.className = 'fa-regular fa-copy';
      }, 2000);
    }).catch(() => {
      showToast('Could not copy automatically. Please select and copy.', 'error');
    });
  });

  // Toggle Password Input Visibility in Like Verification Form
  btnToggleLikePassword.addEventListener('click', () => {
    const type = inputLikePassword.getAttribute('type') === 'password' ? 'text' : 'password';
    inputLikePassword.setAttribute('type', type);
    const icon = btnToggleLikePassword.querySelector('i');
    icon.className = type === 'password' ? 'fa-regular fa-eye' : 'fa-regular fa-eye-slash';
  });

  // Handle Like Clicks
  async function handleLikeClick(id) {
    const likedList = getLikedQuestions();
    if (likedList[id]) {
      showToast('You already liked this message!', 'error');
      return;
    }

    if (sessionToken) {
      // Authenticated User flow: Authenticate instantly without prompting password modal!
      try {
        const response = await fetch(`${API_BASE}/api/questions/${id}/like`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-session-token': sessionToken 
          }
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to register like');

        markQuestionAsLiked(id);

        // Update UI
        const countEl = document.getElementById(`likes-count-${id}`);
        if (countEl && data.likes !== null) {
          countEl.innerText = data.likes;
        }
        
        const likeBtn = document.querySelector(`.btn-like[data-id="${id}"]`);
        if (likeBtn) {
          likeBtn.classList.add('liked');
          const heartIcon = likeBtn.querySelector('i');
          if (heartIcon) heartIcon.className = 'fa-solid fa-heart';
        }

        showToast('Like registered successfully!');
        if (isDashboardVisible) fetchUserWhispers();
      } catch (err) {
        showToast(err.message, 'error');
      }
    } else {
      // Anonymous Guest flow: prompt modal
      currentTargetLikeId = id;
      const cachedPassword = getSavedPassword();
      inputLikePassword.value = cachedPassword;
      inputLikePassword.setAttribute('type', 'password');
      btnToggleLikePassword.querySelector('i').className = 'fa-regular fa-eye';

      openModal(modalLike);
      setTimeout(() => inputLikePassword.focus(), 150);
    }
  }

  btnCloseLike.addEventListener('click', () => closeModal(modalLike));

  // Submit Like Verify Form (Anonymous flow)
  formLike.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = inputLikePassword.value.trim();
    if (!password || !currentTargetLikeId) return;

    try {
      const response = await fetch(`${API_BASE}/api/questions/${currentTargetLikeId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to register like');
      }

      // Success
      closeModal(modalLike);
      savePassword(password);
      markQuestionAsLiked(currentTargetLikeId);

      const countEl = document.getElementById(`likes-count-${currentTargetLikeId}`);
      if (countEl && data.likes !== null) {
        countEl.innerText = data.likes;
      }
      
      const likeBtn = document.querySelector(`.btn-like[data-id="${currentTargetLikeId}"]`);
      if (likeBtn) {
        likeBtn.classList.add('liked');
        const heartIcon = likeBtn.querySelector('i');
        if (heartIcon) heartIcon.className = 'fa-solid fa-heart';
      }

      showToast('Like registered successfully!');
      currentTargetLikeId = null;
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // --- LOG OUT ACTION ---
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: { 'x-session-token': sessionToken }
        });
      } catch (e) {}
      localStorage.removeItem('3mkfxg_session_token');
      showToast('Logged out of system dashboard.', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    });
  }

  // --- TOGGLE CONSOLE DASHBOARD ---
  if (btnToggleDashboard) {
    btnToggleDashboard.addEventListener('click', () => {
      isDashboardVisible = !isDashboardVisible;
      if (isDashboardVisible) {
        userDashboardSection.classList.remove('hidden');
        btnToggleDashboard.innerHTML = `<i class="fa-solid fa-folder-closed"></i> Hide Console`;
        btnToggleDashboard.style.background = 'rgba(0, 255, 102, 0.1)';
        btnToggleDashboard.style.borderColor = 'rgba(0, 255, 102, 0.3)';
        fetchUserWhispers();
      } else {
        userDashboardSection.classList.add('hidden');
        btnToggleDashboard.innerHTML = `<i class="fa-solid fa-laptop-code"></i> Console`;
        btnToggleDashboard.style.background = '';
        btnToggleDashboard.style.borderColor = '';
      }
    });
  }

// --- MULTI-LINGUAL WARNING POPUP MODAL ---
const modalWarning = document.getElementById('modal-warning');
const btnCloseWarning = document.getElementById('btn-close-warning-modal');
const btnAgreeWarning = document.getElementById('btn-agree-warning');
const tabBtns = document.querySelectorAll('.terminal-warning-card .tab-btn');
const tabContents = document.querySelectorAll('.terminal-warning-card .warning-tab-content');

// Show warning on every page load unless user is admin (username '3mkfxg')
function maybeShowWarning() {
  if (currentUser && currentUser.toLowerCase() === '3mkfxg') return;
  openModal(modalWarning);
}

// Dismiss warning without persisting flag
function dismissWarning() {
  closeModal(modalWarning);
}

// Attach dismiss handlers
if (btnCloseWarning) btnCloseWarning.addEventListener('click', dismissWarning);
if (btnAgreeWarning) btnAgreeWarning.addEventListener('click', dismissWarning);

// Call maybeShowWarning after identity check in init (added later)

  // Tab switching inside warning card
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      
      // Update buttons
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update contents
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `tab-${tabId}`) {
          content.classList.add('active');
        }
      });
    });
  });

  // Initial load sequences
  async function init() {
    await checkIdentity();
    maybeShowWarning(); // Show warning for non-admin users on every refresh
    fetchQuestions();
  }

  init();
});
