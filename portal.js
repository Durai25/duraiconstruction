import {
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getBlob, ref } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { auth, db, firebaseReady, storage } from './firebase-client.js';
import { isAdminRecord } from './admin-role.js';

const loginView = document.querySelector('#login-view');
const dashboardView = document.querySelector('#dashboard-view');
const loginForm = document.querySelector('#login-form');
const loginStatus = document.querySelector('#login-status');
const googleSignInButton = document.querySelector('#google-sign-in');
const globalStatus = document.querySelector('#portal-status');
const projectList = document.querySelector('#project-list');
const mediaStates = new Map();
let stopProjects;
let stopUpdates = new Map();

const formatDate = (timestamp) => {
  if (!timestamp?.toDate) return 'Not updated yet';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(timestamp.toDate());
};

const formatMoney = (amount, currency = 'INR') => new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency,
  maximumFractionDigits: 2,
}).format(Number(amount) || 0);

function getProjectProgress(project) {
  if (project.progressPercent == null || project.progressPercent === '') {
    return project.workStatus === 'Completed' ? 100 : null;
  }
  const progress = Number(project.progressPercent);
  if (Number.isFinite(progress) && progress >= 0 && progress <= 100) return progress;
  return project.workStatus === 'Completed' ? 100 : null;
}

function updateProjectOverview(projects) {
  const progressValues = projects.map(getProjectProgress).filter((value) => value !== null);
  document.querySelector('#customer-project-count').textContent = String(projects.length);
  document.querySelector('#customer-active-count').textContent = String(projects.filter((project) => project.workStatus === 'In Progress').length);
  document.querySelector('#customer-average-progress').textContent = progressValues.length
    ? `${Math.round(progressValues.reduce((total, value) => total + value, 0) / progressValues.length)}%`
    : '—';
}

async function verifyAdminAccess(user) {
  if (!user) return false;

  try {
    const token = await user.getIdTokenResult();
    if (token.claims.admin === true) return true;
  } catch (error) {
    console.warn('Unable to read admin custom claims:', error);
  }

  const checks = [];
  if (user.uid) checks.push(getDoc(doc(db, 'admins', user.uid)));
  if (user.email) {
    checks.push(getDocs(query(collection(db, 'admins'), where('email', '==', user.email.trim().toLowerCase()))));
    checks.push(getDocs(query(collection(db, 'admins'), where('uid', '==', user.uid))));
  }

  for (const result of await Promise.all(checks)) {
    if (result && result.exists && result.exists()) {
      if (isAdminRecord(result.data())) return true;
      continue;
    }

    for (const adminDoc of result?.docs || []) {
      if (isAdminRecord(adminDoc.data())) return true;
    }
  }

  return false;
}

function clearProjectView() {
  stopProjects?.();
  stopProjects = undefined;
  for (const unsubscribe of stopUpdates.values()) unsubscribe();
  stopUpdates = new Map();
  for (const state of mediaStates.values()) clearMediaResources(state);
  mediaStates.clear();
  projectList.replaceChildren();
  document.querySelector('#customer-project-count').textContent = '0';
  document.querySelector('#customer-active-count').textContent = '0';
  document.querySelector('#customer-average-progress').textContent = '—';
}

function clearMediaResources(state) {
  state.generation += 1;
  for (const observer of state.observers) observer.disconnect();
  state.observers.clear();
  for (const url of state.urls) URL.revokeObjectURL(url);
  state.urls.clear();
}

function addDetail(parent, label, value) {
  const item = document.createElement('div');
  item.className = 'portal-detail';
  const name = document.createElement('span');
  name.textContent = label;
  const detail = document.createElement('strong');
  detail.textContent = value;
  item.append(name, detail);
  parent.append(item);
}

function renderProject(projectId, project) {
  const card = document.createElement('article');
  card.className = 'customer-project';
  const heading = document.createElement('div');
  heading.className = 'customer-project-heading';
  const titleGroup = document.createElement('div');
  const title = document.createElement('h2');
  title.textContent = project.projectName || 'Construction project';
  const location = document.createElement('p');
  location.textContent = project.siteAddress || 'Location to be confirmed';
  titleGroup.append(title, location);
  const status = document.createElement('span');
  status.className = 'project-status';
  status.textContent = project.workStatus || 'Planning';
  heading.append(titleGroup, status);

  const details = document.createElement('div');
  details.className = 'portal-details-grid';
  addDetail(details, 'Payment status', project.paymentStatus || 'Not provided');
  if (project.contractAmount != null && Number.isFinite(Number(project.contractAmount))) {
    addDetail(details, 'Contract amount', formatMoney(project.contractAmount, project.currency));
  }
  if (project.amountPaid != null && Number.isFinite(Number(project.amountPaid))) {
    addDetail(details, 'Paid to date', formatMoney(project.amountPaid, project.currency));
  }
  addDetail(details, 'Estimated days to handover', project.estimatedDeliveryDays == null ? 'To be confirmed' : `${project.estimatedDeliveryDays} days`);
  addDetail(details, 'Last updated', formatDate(project.updatedAt));

  const progressPanel = document.createElement('section');
  progressPanel.className = 'customer-progress';
  const progressHeading = document.createElement('div');
  progressHeading.className = 'customer-progress-heading';
  const progressLabel = document.createElement('strong');
  progressLabel.textContent = 'Project progress';
  const progressText = document.createElement('span');
  const progress = getProjectProgress(project);
  progressText.textContent = progress === null ? 'Awaiting update' : `${progress}%`;
  progressHeading.append(progressLabel, progressText);
  const progressBar = document.createElement('progress');
  progressBar.max = 100;
  progressBar.value = progress ?? 0;
  progressBar.setAttribute('aria-label', progress === null ? 'Project progress has not been reported' : `Project ${progress}% complete`);
  progressBar.hidden = progress === null;
  progressPanel.append(progressHeading, progressBar);

  const updates = document.createElement('div');
  updates.className = 'project-updates';
  updates.id = `updates-${projectId}`;
  updates.textContent = 'Loading site updates...';
  card.append(heading, details, progressPanel, updates);
  projectList.append(card);
  watchUpdates(projectId, updates);
}

function renderMedia(container, media, state) {
  for (const item of media || []) {
    const figure = document.createElement('figure');
    figure.className = 'update-media-item';
    const caption = document.createElement('figcaption');
    caption.textContent = item.name || (item.type?.startsWith('video/') ? 'Project video' : 'Project photo');
    figure.append(caption);
    const generation = state.generation;
    const loadMedia = () => {
      if (!container.isConnected || generation !== state.generation) return;
      getBlob(ref(storage, item.path)).then((blob) => {
        if (!container.isConnected || generation !== state.generation) return;
        const objectUrl = URL.createObjectURL(blob);
        state.urls.add(objectUrl);
        const element = item.type?.startsWith('video/')
          ? document.createElement('video')
          : document.createElement('img');
        element.src = objectUrl;
        if (element instanceof HTMLVideoElement) {
          element.controls = true;
          element.preload = 'metadata';
        } else {
          element.alt = caption.textContent;
          element.loading = 'lazy';
        }
        figure.insertBefore(element, caption);
      }).catch((error) => {
        console.error('Unable to load project media:', error);
        caption.textContent += ' (unavailable)';
      });
    };

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          state.observers.delete(observer);
          loadMedia();
        }
      }, { rootMargin: '160px' });
      state.observers.add(observer);
      observer.observe(figure);
    } else {
      loadMedia();
    }
    container.append(figure);
  }
}

function watchUpdates(projectId, container) {
  stopUpdates.get(projectId)?.();
  const updateQuery = collection(db, 'projects', projectId, 'updates');
  const unsubscribe = onSnapshot(updateQuery, (snapshot) => {
    let mediaState = mediaStates.get(container);
    if (!mediaState) {
      mediaState = { generation: 0, observers: new Set(), urls: new Set() };
      mediaStates.set(container, mediaState);
    }
    clearMediaResources(mediaState);
    container.replaceChildren();
    const updates = snapshot.docs
      .map((document) => ({ id: document.id, ...document.data() }))
      .sort((left, right) => (right.createdAt?.toMillis?.() || 0) - (left.createdAt?.toMillis?.() || 0));

    const title = document.createElement('h3');
    title.textContent = 'Site updates';
    container.append(title);
    if (!updates.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Your project updates will appear here.';
      container.append(empty);
      return;
    }

    for (const update of updates) {
      const entry = document.createElement('article');
      entry.className = 'project-update';
      const date = document.createElement('time');
      date.textContent = formatDate(update.createdAt);
      const note = document.createElement('p');
      note.textContent = update.message || 'Project progress update';
      entry.append(date, note);
      if (update.media?.length) {
        const mediaGrid = document.createElement('div');
        mediaGrid.className = 'update-media-grid';
        entry.append(mediaGrid);
        renderMedia(mediaGrid, update.media, mediaState);
      }
      container.append(entry);
    }
  }, (error) => {
    console.error('Unable to load project updates:', error);
    container.textContent = 'Project updates are temporarily unavailable.';
  });
  stopUpdates.set(projectId, unsubscribe);
}

function showConfigurationError() {
  loginStatus.textContent = 'Firebase is not configured. Add your project settings before enabling customer sign-in.';
  loginStatus.classList.add('error');
  loginForm.querySelector('button[type="submit"]').disabled = true;
  googleSignInButton.disabled = true;
}

if (!firebaseReady) {
  showConfigurationError();
} else {
  document.querySelector('#year').textContent = new Date().getFullYear();

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginStatus.classList.remove('error');
    loginStatus.textContent = 'Signing in...';
    const formData = new FormData(loginForm);
    try {
      await signInWithEmailAndPassword(auth, String(formData.get('email')).trim(), String(formData.get('password')));
    } catch (error) {
      console.error('Customer sign in failed:', error);
      loginStatus.textContent = 'Sign in failed. Check your email and password, then try again.';
      loginStatus.classList.add('error');
    }
  });

  googleSignInButton.addEventListener('click', async () => {
    loginStatus.classList.remove('error');
    loginStatus.textContent = 'Connecting to Google...';
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error('Google customer sign in failed:', error);
      if (error.code === 'auth/popup-closed-by-user') {
        loginStatus.textContent = 'Google sign-in was cancelled.';
      } else if (error.code === 'auth/popup-blocked') {
        loginStatus.textContent = 'Allow pop-ups for this site to continue with Google.';
        loginStatus.classList.add('error');
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        loginStatus.textContent = 'This email already uses another sign-in method. Sign in with that method instead.';
        loginStatus.classList.add('error');
      } else if (error.code === 'auth/operation-not-allowed') {
        loginStatus.textContent = 'Google sign-in is not enabled for this Firebase project.';
        loginStatus.classList.add('error');
      } else if (error.code === 'auth/unauthorized-domain') {
        loginStatus.textContent = 'This site domain is not authorized for Google sign-in in Firebase.';
        loginStatus.classList.add('error');
      } else if (error.code === 'auth/invalid-credential') {
        loginStatus.textContent = 'Google sign-in could not be verified. Check the Firebase Google provider settings and try again.';
        loginStatus.classList.add('error');
      } else {
        loginStatus.textContent = 'Google sign-in failed. Please try again.';
        loginStatus.classList.add('error');
      }
    }
  });

  document.querySelector('#reset-password').addEventListener('click', async () => {
    const email = loginForm.elements.email.value.trim();
    if (!email) {
      loginStatus.textContent = 'Enter your email address first.';
      loginStatus.classList.add('error');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      loginStatus.classList.remove('error');
      loginStatus.textContent = 'If an account exists for that address, a reset email has been sent.';
    } catch (error) {
      console.error('Password reset failed:', error);
      loginStatus.textContent = 'Unable to send a password reset email. Please try again later.';
      loginStatus.classList.add('error');
    }
  });

  document.querySelector('#sign-out').addEventListener('click', () => signOut(auth));

  onAuthStateChanged(auth, async (user) => {
    clearProjectView();
    globalStatus.textContent = '';
    if (!user) {
      loginView.hidden = false;
      dashboardView.hidden = true;
      return;
    }

    try {
      const isAuthorizedAdmin = await verifyAdminAccess(user);
      if (isAuthorizedAdmin) {
        window.location.replace('admin.html');
        return;
      }
      loginView.hidden = true;
      dashboardView.hidden = false;
      document.querySelector('#customer-email').textContent = user.email || '';
      const customerProjects = query(collection(db, 'projects'), where('customerId', '==', user.uid));
      stopProjects = onSnapshot(customerProjects, (snapshot) => {
        for (const unsubscribe of stopUpdates.values()) unsubscribe();
        stopUpdates = new Map();
        for (const state of mediaStates.values()) clearMediaResources(state);
        mediaStates.clear();
        projectList.replaceChildren();
        const projectData = snapshot.docs.map((project) => project.data());
        updateProjectOverview(projectData);
        if (snapshot.empty) {
          const empty = document.createElement('p');
          empty.className = 'portal-empty';
          empty.textContent = 'No projects are linked to your account yet. Contact your project manager for help.';
          projectList.append(empty);
          return;
        }
        snapshot.docs.forEach((project) => renderProject(project.id, project.data()));
      }, (error) => {
        console.error('Unable to load customer projects:', error);
        globalStatus.textContent = 'Your projects are temporarily unavailable. Please try again later.';
        globalStatus.classList.add('error');
      });
    } catch (error) {
      console.error('Unable to verify portal access:', error);
      await signOut(auth);
      loginStatus.textContent = 'Unable to verify account access. Please sign in again.';
      loginStatus.classList.add('error');
    }
  });
}
