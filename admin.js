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
const leadList = document.querySelector('#lead-list');
const leadSearch = document.querySelector('#lead-search');
const leadStatusFilter = document.querySelector('#lead-status-filter');
const leadStatuses = ['New', 'Contacted', 'Qualified', 'Won', 'Closed'];
let projects = new Map();
let leads = [];
let stopProjects;
let stopLeads;
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
  updateForm.elements.progressPercent.value = project.progressPercent ?? '';
  updateForm.elements.estimatedDeliveryDays.value = project.estimatedDeliveryDays ?? '';
  showStatus(updateStatus, '');
  showStatus(uploadStatus, '');
}

function updateMetrics() {
  const projectValues = [...projects.values()];
  document.querySelector('#metric-projects').textContent = String(projectValues.length);
  document.querySelector('#metric-active').textContent = String(projectValues.filter((project) => project.workStatus === 'In Progress').length);
  document.querySelector('#metric-completed').textContent = String(projectValues.filter((project) => project.workStatus === 'Completed').length);
  document.querySelector('#metric-leads').textContent = String(leads.length);
}

function renderLeads() {
  const search = leadSearch.value.trim().toLowerCase();
  const statusFilter = leadStatusFilter.value;
  const filteredLeads = leads.filter((lead) => {
    const status = lead.leadStatus || 'New';
    const searchableText = [
      lead.from_name,
      lead.reply_to,
      lead.phone,
      lead.project_type,
      lead.site_location,
      lead.request_type,
    ].join(' ').toLowerCase();
    return (!statusFilter || status === statusFilter) && (!search || searchableText.includes(search));
  });

  leadList.replaceChildren();
  if (!filteredLeads.length) {
    const empty = document.createElement('p');
    empty.className = 'portal-empty';
    empty.textContent = leads.length ? 'No enquiries match these filters.' : 'Website enquiries will appear here when Firestore archiving is configured.';
    leadList.append(empty);
    return;
  }

  for (const lead of filteredLeads) {
    const card = document.createElement('article');
    card.className = 'lead-card';
    const heading = document.createElement('div');
    heading.className = 'lead-card-heading';
    const title = document.createElement('h3');
    title.textContent = lead.from_name || 'New enquiry';
    const received = document.createElement('time');
    const createdAt = lead.createdAt?.toDate?.();
    received.textContent = createdAt
      ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(createdAt)
      : 'Date unavailable';
    heading.append(title, received);

    const summary = document.createElement('p');
    summary.className = 'lead-summary';
    summary.textContent = [lead.request_type, lead.project_type, lead.site_location].filter(Boolean).join(' · ') || 'Project enquiry';
    const contact = document.createElement('div');
    contact.className = 'lead-contact';
    const email = document.createElement('a');
    email.href = `mailto:${encodeURIComponent(lead.reply_to || '')}`;
    email.textContent = lead.reply_to || 'No email provided';
    contact.append(email);
    if (lead.phone) {
      const phone = document.createElement('span');
      phone.textContent = lead.phone;
      contact.append(phone);
    }
    const message = document.createElement('p');
    message.className = 'lead-message';
    message.textContent = lead.message || '';

    const form = document.createElement('form');
    form.className = 'lead-edit-form';
    const statusLabel = document.createElement('label');
    statusLabel.textContent = 'Follow-up status';
    const statusSelect = document.createElement('select');
    statusSelect.name = 'leadStatus';
    for (const status of leadStatuses) {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status;
      statusSelect.append(option);
    }
    statusSelect.value = lead.leadStatus || 'New';
    statusLabel.append(statusSelect);
    const noteLabel = document.createElement('label');
    noteLabel.textContent = 'Internal note';
    const notes = document.createElement('textarea');
    notes.name = 'adminNotes';
    notes.rows = 2;
    notes.maxLength = 2000;
    notes.value = lead.adminNotes || '';
    noteLabel.append(notes);
    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'button button-outline-dark';
    save.textContent = 'Save follow-up';
    const saveStatus = document.createElement('span');
    saveStatus.className = 'form-status';
    saveStatus.setAttribute('role', 'status');
    form.append(statusLabel, noteLabel, save, saveStatus);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!isAdmin) return;
      save.disabled = true;
      showStatus(saveStatus, 'Saving...');
      try {
        await updateDoc(doc(db, 'inquiries', lead.id), {
          leadStatus: statusSelect.value,
          adminNotes: notes.value.trim(),
        });
        showStatus(saveStatus, 'Follow-up saved.');
      } catch (error) {
        console.error('Unable to update enquiry follow-up:', error);
        showStatus(saveStatus, 'Follow-up could not be saved. Try again.', true);
      } finally {
        save.disabled = false;
      }
    });

    card.append(heading, summary, contact, message, form);
    leadList.append(card);
  }
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
  updateMetrics();
}

function watchProjects() {
  stopProjects?.();
  stopProjects = onSnapshot(collection(db, 'projects'), refreshProjectPicker, (error) => {
    console.error('Unable to load admin projects:', error);
    showStatus(globalStatus, 'Project list could not be loaded. Check Firestore rules and try again.', true);
  });
}

function watchLeads() {
  stopLeads?.();
  stopLeads = onSnapshot(collection(db, 'inquiries'), (snapshot) => {
    leads = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((left, right) => (right.createdAt?.toMillis?.() || 0) - (left.createdAt?.toMillis?.() || 0));
    updateMetrics();
    renderLeads();
  }, (error) => {
    console.error('Unable to load website enquiries:', error);
    leadList.textContent = 'Enquiries could not be loaded. Check Firestore rules and try again.';
    showStatus(globalStatus, 'The enquiry CRM is unavailable. Deploy the latest Firestore rules to enable admin access.', true);
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
  leadSearch.addEventListener('input', renderLeads);
  leadStatusFilter.addEventListener('change', renderLeads);
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
        progressPercent: 0,
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
    const progressPercent = String(formData.get('progressPercent') || '').trim();
    const estimatedDays = String(formData.get('estimatedDeliveryDays') || '').trim();
    const workStatus = String(formData.get('workStatus'));

    try {
      await updateDoc(doc(db, 'projects', projectId), {
        projectName: String(formData.get('projectName')).trim(),
        siteAddress: String(formData.get('siteAddress')).trim(),
        workStatus,
        paymentStatus: String(formData.get('paymentStatus')),
        contractAmount: contractAmount ? Number(contractAmount) : null,
        amountPaid: amountPaid ? Number(amountPaid) : null,
        progressPercent: workStatus === 'Completed' ? 100 : progressPercent ? Number(progressPercent) : null,
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
    stopLeads?.();
    stopProjects = undefined;
    stopLeads = undefined;
    isAdmin = false;
    if (!user) {
      projects = new Map();
      leads = [];
      updateMetrics();
      leadList.replaceChildren();
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
      watchLeads();
    } catch (error) {
      console.error('Unable to verify admin role:', error);
      showStatus(loginStatus, 'Unable to verify administrator access. Sign in again.', true);
      await signOut(auth);
    }
  });
}
