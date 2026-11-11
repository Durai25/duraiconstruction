import {
  getIdTokenResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  addDoc,
  collection,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  doc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  ref,
  uploadBytesResumable,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { auth, db, firebaseReady, storage } from './firebase-client.js';

const loginView = document.querySelector('#admin-login-view');
const dashboard = document.querySelector('#admin-dashboard');
const loginForm = document.querySelector('#admin-login-form');
const loginStatus = document.querySelector('#admin-login-status');
const globalStatus = document.querySelector('#admin-global-status');
const projectPicker = document.querySelector('#project-picker');
const createForm = document.querySelector('#create-project-form');
const updateForm = document.querySelector('#update-project-form');
const uploadForm = document.querySelector('#upload-media-form');
const createStatus = document.querySelector('#create-project-status');
const updateStatus = document.querySelector('#update-project-status');
const uploadStatus = document.querySelector('#upload-status');
const progress = document.querySelector('#upload-progress');
let projects = new Map();
let stopProjects;
let isAdmin = false;

function showStatus(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('error', isError);
}

function clearProjectForms() {
  updateForm.reset();
  uploadForm.reset();
  updateForm.querySelectorAll('input,select,textarea,button').forEach((field) => {
    field.disabled = true;
  });
  uploadForm.querySelectorAll('input,textarea,button').forEach((field) => {
    field.disabled = true;
  });
  progress.hidden = true;
  progress.value = 0;
}

function selectProject(projectId) {
  const project = projects.get(projectId);
  if (!project) {
    clearProjectForms();
    return;
  }
  for (const field of updateForm.querySelectorAll('input,select,textarea,button')) field.disabled = false;
  for (const field of uploadForm.querySelectorAll('input,textarea,button')) field.disabled = false;
  updateForm.elements.projectName.value = project.projectName || '';
  updateForm.elements.siteAddress.value = project.siteAddress || '';
  updateForm.elements.workStatus.value = project.workStatus || 'Planning';
  updateForm.elements.paymentStatus.value = project.paymentStatus || 'Not provided';
  updateForm.elements.contractAmount.value = project.contractAmount ?? '';
  updateForm.elements.amountPaid.value = project.amountPaid ?? '';
  updateForm.elements.estimatedDeliveryDays.value = project.estimatedDeliveryDays ?? '';
  showStatus(updateStatus, '');
  showStatus(uploadStatus, '');
}

function refreshProjectPicker(snapshot) {
  const selected = projectPicker.value;
  projects = new Map(snapshot.docs.map((item) => [item.id, item.data()]));
  projectPicker.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = projects.size ? 'Select a project' : 'No projects yet';
  projectPicker.append(placeholder);
  const sortedProjects = [...projects.entries()].sort((left, right) =>
    String(left[1].projectName || '').localeCompare(String(right[1].projectName || '')),
  );
  for (const [id, project] of sortedProjects) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = `${project.projectName || 'Untitled project'} · ${project.customerId}`;
    projectPicker.append(option);
  }
  if (projects.has(selected)) projectPicker.value = selected;
  selectProject(projectPicker.value);
}

function watchProjects() {
  stopProjects?.();
  stopProjects = onSnapshot(collection(db, 'projects'), refreshProjectPicker, (error) => {
    console.error('Unable to load admin projects:', error);
    showStatus(globalStatus, 'Project list could not be loaded. Check Firestore rules and try again.', true);
  });
}

function runUpload(file, storagePath) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, storagePath), file, {
      contentType: file.type,
    });
    task.on('state_changed', (snapshot) => {
      const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
      progress.value = percent;
      showStatus(uploadStatus, `Uploading ${file.name}: ${percent}%`);
    }, reject, () => resolve(task.snapshot));
  });
}

if (!firebaseReady) {
  showStatus(loginStatus, 'Firebase is not configured. Add your project settings before enabling admin sign-in.', true);
  loginForm.querySelector('button[type="submit"]').disabled = true;
} else {
  document.querySelector('#year').textContent = new Date().getFullYear();

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    showStatus(loginStatus, 'Signing in...');
    const formData = new FormData(loginForm);
    try {
      await signInWithEmailAndPassword(auth, String(formData.get('email')).trim(), String(formData.get('password')));
    } catch (error) {
      console.error('Admin sign in failed:', error);
      showStatus(loginStatus, 'Sign in failed. Check your admin account and try again.', true);
    }
  });

  document.querySelector('#admin-reset-password').addEventListener('click', async () => {
    const email = loginForm.elements.email.value.trim();
    if (!email) return showStatus(loginStatus, 'Enter your email address first.', true);
    try {
      await sendPasswordResetEmail(auth, email);
      showStatus(loginStatus, 'If an account exists for that address, a reset email has been sent.');
    } catch (error) {
      console.error('Admin password reset failed:', error);
      showStatus(loginStatus, 'Unable to send a password reset email. Please try again later.', true);
    }
  });

  document.querySelector('#admin-sign-out').addEventListener('click', () => signOut(auth));
  projectPicker.addEventListener('change', () => selectProject(projectPicker.value));
  clearProjectForms();

  createForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!isAdmin) return;
    const button = createForm.querySelector('button[type="submit"]');
    button.disabled = true;
    showStatus(createStatus, 'Creating project...');
    const formData = new FormData(createForm);
    try {
      const projectRef = await addDoc(collection(db, 'projects'), {
        customerId: String(formData.get('customerUid')).trim(),
        projectName: String(formData.get('projectName')).trim(),
        siteAddress: String(formData.get('siteAddress')).trim(),
        workStatus: 'Planning',
        paymentStatus: 'Not provided',
        contractAmount: null,
        amountPaid: null,
        estimatedDeliveryDays: null,
        currency: 'INR',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      createForm.reset();
      showStatus(createStatus, 'Project created and linked to the customer UID.');
      projectPicker.value = projectRef.id;
      selectProject(projectRef.id);
    } catch (error) {
      console.error('Unable to create project:', error);
      showStatus(createStatus, 'Project could not be created. Check the customer UID and try again.', true);
    } finally {
      button.disabled = false;
    }
  });

  updateForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!isAdmin || !projectPicker.value) return;
    const button = updateForm.querySelector('button[type="submit"]');
    button.disabled = true;
    showStatus(updateStatus, 'Saving project...');
    const formData = new FormData(updateForm);
    const projectId = projectPicker.value;
    const progressNote = String(formData.get('progressNote') || '').trim();
    const contractAmount = String(formData.get('contractAmount') || '').trim();
    const amountPaid = String(formData.get('amountPaid') || '').trim();
    const estimatedDays = String(formData.get('estimatedDeliveryDays') || '').trim();

    try {
      await updateDoc(doc(db, 'projects', projectId), {
        projectName: String(formData.get('projectName')).trim(),
        siteAddress: String(formData.get('siteAddress')).trim(),
        workStatus: String(formData.get('workStatus')),
        paymentStatus: String(formData.get('paymentStatus')),
        contractAmount: contractAmount ? Number(contractAmount) : null,
        amountPaid: amountPaid ? Number(amountPaid) : null,
        estimatedDeliveryDays: estimatedDays ? Number(estimatedDays) : null,
        currency: 'INR',
        updatedAt: serverTimestamp(),
      });
      if (progressNote) {
        await addDoc(collection(db, 'projects', projectId, 'updates'), {
          message: progressNote,
          media: [],
          createdAt: serverTimestamp(),
        });
      }
      updateForm.elements.progressNote.value = '';
      showStatus(updateStatus, 'Project details saved. The customer portal is updated.');
    } catch (error) {
      console.error('Unable to update project:', error);
      showStatus(updateStatus, 'Project details could not be saved. Try again.', true);
    } finally {
      button.disabled = false;
    }
  });

  uploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!isAdmin || !projectPicker.value) return;
    const files = [...uploadForm.elements.mediaFiles.files];
    const projectId = projectPicker.value;
    const caption = String(new FormData(uploadForm).get('caption') || '').trim();
    const button = uploadForm.querySelector('button[type="submit"]');

    if (!files.length || files.length > 8) {
      showStatus(uploadStatus, 'Choose between 1 and 8 files.', true);
      return;
    }
    const invalidFile = files.find((file) => {
      const isImage = file.type.startsWith('image/') && file.size <= 20 * 1024 * 1024;
      const isVideo = file.type.startsWith('video/') && file.size < 100 * 1024 * 1024;
      return !isImage && !isVideo;
    });
    if (invalidFile) {
      showStatus(uploadStatus, 'Images must be 20 MB or smaller. Videos must be under 100 MB.', true);
      return;
    }

    button.disabled = true;
    progress.hidden = false;
    progress.value = 0;
    const uploadedMedia = [];
    try {
      for (const [index, file] of files.entries()) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `projects/${projectId}/${Date.now()}_${index}_${safeName}`;
        await runUpload(file, path);
        uploadedMedia.push({ path, name: file.name, type: file.type });
      }
      await addDoc(collection(db, 'projects', projectId, 'updates'), {
        message: caption || 'New project photos and videos',
        media: uploadedMedia,
        createdAt: serverTimestamp(),
      });
      uploadForm.reset();
      showStatus(uploadStatus, `${uploadedMedia.length} file${uploadedMedia.length === 1 ? '' : 's'} added to the customer project.`);
    } catch (error) {
      console.error('Unable to upload project media:', error);
      showStatus(uploadStatus, 'Upload was not completed. Check the files and try again.', true);
    } finally {
      button.disabled = false;
      progress.hidden = true;
    }
  });

  onAuthStateChanged(auth, async (user) => {
    stopProjects?.();
    stopProjects = undefined;
    isAdmin = false;
    if (!user) {
      loginView.hidden = false;
      dashboard.hidden = true;
      return;
    }

    try {
      const token = await getIdTokenResult(user);
      if (token.claims.admin !== true) {
        showStatus(loginStatus, 'This account does not have administrator access.', true);
        await signOut(auth);
        return;
      }
      isAdmin = true;
      loginView.hidden = true;
      dashboard.hidden = false;
      document.querySelector('#admin-email-label').textContent = user.email || '';
      watchProjects();
    } catch (error) {
      console.error('Unable to verify admin role:', error);
      showStatus(loginStatus, 'Unable to verify administrator access. Sign in again.', true);
      await signOut(auth);
    }
  });
}
