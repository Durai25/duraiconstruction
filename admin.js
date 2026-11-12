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
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  ref,
  uploadBytesResumable,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { auth, db, firebaseReady, storage } from './firebase-client.js';
import { isAdminRecord } from './admin-role.js';
import { getCustomerRows, getStatusBreakdown, summarizeAdminWorkspace } from './admin-dashboard-data.js';
import { filterProjects, makeProjectCode, readProjectMaster } from './erp-projects.js';
import {
  buildEmployeeLedger,
  buildMonthlyAttendanceBook,
  summarizeEmployeePayroll,
  summarizeAttendance,
} from './workforce-dashboard-data.js';

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
const projectActivity = document.querySelector('#project-activity');
const uploadStatus = document.querySelector('#upload-status');
const progress = document.querySelector('#upload-progress');
const leadList = document.querySelector('#lead-list');
const leadSearch = document.querySelector('#lead-search');
const leadStatusFilter = document.querySelector('#lead-status-filter');
const sectionNavigation = document.querySelector('.admin-section-nav');
const sectionDetails = document.querySelector('#admin-section-details');
const sectionTitle = document.querySelector('#admin-section-title');
const attendanceSectionSwitcher = document.querySelector('#attendance-section-switcher');
const sectionTiles = document.querySelectorAll('.admin-section-card');
const attendanceViewButtons = document.querySelectorAll('[data-attendance-view-button]');
const attendanceDate = document.querySelector('#attendance-date');
const attendanceBookMonth = document.querySelector('#attendance-book-month');
const attendanceBookCount = document.querySelector('#attendance-book-count');
const attendanceBookHeader = document.querySelector('#attendance-book-header');
const attendanceBookList = document.querySelector('#attendance-book-list');
const attendanceBookTotals = document.querySelector('#attendance-book-totals');
const employeePayoutForm = document.querySelector('#employee-payout-form');
const employeePayoutStatus = document.querySelector('#employee-payout-status');
const employeePayoutMonth = document.querySelector('#employee-payout-month');
const employeeLedgerDialog = document.querySelector('#employee-ledger-dialog');
const employeeProfileDialog = document.querySelector('#employee-profile-dialog');
const employeeProfileTitle = document.querySelector('#employee-profile-title');
const employeeProfileDetails = document.querySelector('#employee-profile-details');
const employeeLedgerTitle = document.querySelector('#employee-ledger-title');
const employeeLedgerPeriod = document.querySelector('#employee-ledger-period');
const employeeLedgerEarnings = document.querySelector('#employee-ledger-earnings');
const employeeLedgerPayouts = document.querySelector('#employee-ledger-payouts');
const employeeLedgerBalance = document.querySelector('#employee-ledger-balance');
const employeeLedgerEntries = document.querySelector('#employee-ledger-entries');
const employeeForm = document.querySelector('#employee-form');
const employeeStatus = document.querySelector('#employee-status');
const employeeDirectoryList = document.querySelector('#employee-directory-list');
const employeeDirectoryNames = document.querySelector('#employee-directory-names');
const employeeCancelEditButton = document.querySelector('#employee-cancel-edit');
const employeePayrollSummary = document.querySelector('#employee-payroll-summary');
const employeePayrollTotals = document.querySelector('#employee-payroll-totals');
const employeePayoutHistory = document.querySelector('#employee-payout-history');
const attendanceForm = document.querySelector('#attendance-form');
const attendanceCancelEditButton = document.querySelector('#attendance-cancel-edit');
const attendanceRecordList = document.querySelector('#attendance-record-list');
const leadStatuses = ['New', 'Contacted', 'Qualified', 'Won', 'Closed'];
let projects = new Map();
let clients = new Map();
let projectPayments = [];
let projectUpdates = [];
let projectChanges = [];
let leads = [];
let attendanceRecords = [];
let monthlyAttendanceRecords = [];
let employeePayoutRecords = [];
let employeeRecords = [];
let editingAttendanceId;
let editingEmployeeId;
let stopProjects;
let stopClients;
let stopProjectActivity;
let stopLeads;
let stopAttendance;
let stopAttendanceBook;
let stopEmployeePayouts;
let stopEmployees;
let isAdmin = false;
let activeSectionTile;

function showStatus(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('error', isError);
}

function showDashboardSection(tile) {
  const sectionName = tile.dataset.adminSection;
  const detailPanels = document.querySelectorAll('[data-admin-section-detail]');
  let hasMatchingPanel = false;
  for (const panel of detailPanels) {
    const isMatch = panel.dataset.adminSectionDetail === sectionName;
    panel.hidden = !isMatch;
    if (isMatch) hasMatchingPanel = true;
  }

  if (!hasMatchingPanel) {
    showStatus(globalStatus, 'This dashboard section is unavailable.', true);
    return;
  }

  for (const sectionTile of sectionTiles) {
    sectionTile.setAttribute('aria-expanded', String(sectionTile === tile));
  }
  attendanceSectionSwitcher.hidden = sectionName !== 'attendance';
  if (sectionName === 'attendance') showAttendanceView('attendance');
  activeSectionTile = tile;
  sectionTitle.textContent = tile.querySelector('strong').textContent;
  sectionNavigation.hidden = true;
  sectionDetails.hidden = false;
  sectionDetails.scrollIntoView({ behavior: 'smooth', block: 'start' });
  sectionTitle.focus({ preventScroll: true });
}

function showAttendanceView(viewName) {
  for (const panel of document.querySelectorAll('[data-attendance-view-panel]')) {
    panel.hidden = panel.dataset.attendanceViewPanel !== viewName;
  }
  for (const button of attendanceViewButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.attendanceViewButton === viewName));
  }
}

function showDashboardSections(scrollToNavigation = false) {
  const returnFocusTile = activeSectionTile;
  activeSectionTile = undefined;
  sectionDetails.hidden = true;
  sectionNavigation.hidden = false;
  for (const tile of sectionTiles) tile.setAttribute('aria-expanded', 'false');
  if (scrollToNavigation) {
    sectionNavigation.scrollIntoView({ behavior: 'smooth', block: 'start' });
    returnFocusTile?.focus({ preventScroll: true });
  }
}

function resetAttendanceEditor() {
  editingAttendanceId = undefined;
  attendanceForm.reset();
  attendanceDate.disabled = false;
  attendanceForm.querySelector('button[type="submit"]').textContent = 'Add attendance';
  attendanceCancelEditButton.hidden = true;
  showStatus(document.querySelector('#attendance-status-message'), '');
}

function resetEmployeeEditor() {
  editingEmployeeId = undefined;
  employeeForm.reset();
  employeeForm.querySelector('button[type="submit"]').textContent = 'Add employee';
  employeeCancelEditButton.hidden = true;
  showStatus(employeeStatus, '');
}

function renderEmployeeNameOptions() {
  const namesByKey = new Map();
  for (const employee of employeeRecords) {
    const name = String(employee.employeeName || '').trim();
    if (name) namesByKey.set(name.toLocaleLowerCase(), name);
  }
  for (const record of monthlyAttendanceRecords) {
    const name = String(record.employeeName || '').trim();
    if (name && !namesByKey.has(name.toLocaleLowerCase())) {
      namesByKey.set(name.toLocaleLowerCase(), name);
    }
  }
  employeeDirectoryNames.replaceChildren(...[...namesByKey.values()]
    .sort((left, right) => left.localeCompare(right))
    .map((name) => {
      const option = document.createElement('option');
      option.value = name;
      return option;
    }));
}

function maskSensitiveValue(value) {
  const text = String(value || '');
  return text ? `•••• ${text.slice(-4)}` : '—';
}

function renderEmployeeDirectory() {
  renderEmployeeNameOptions();
  employeeDirectoryList.replaceChildren();
  if (!employeeRecords.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 9;
    cell.textContent = 'No employee profiles have been added.';
    row.append(cell);
    employeeDirectoryList.append(row);
    return;
  }

  const sortedEmployees = [...employeeRecords].sort((left, right) =>
    String(left.employeeName || '').localeCompare(String(right.employeeName || '')),
  );
  for (const employee of sortedEmployees) {
    const row = document.createElement('tr');
    const values = [
      employee.employeeName,
      maskSensitiveValue(employee.mobileNumber),
      maskSensitiveValue(employee.aadhaarNumber),
      maskSensitiveValue(employee.panNumber),
      maskSensitiveValue(employee.bankAccountNumber),
      employee.familySize,
      employee.hasBike ? 'Yes' : 'No',
      employee.hasValidLicence ? 'Yes' : 'No',
    ];
    for (const value of values) {
      const cell = document.createElement('td');
      cell.textContent = String(value ?? '—');
      row.append(cell);
    }
    const actionCell = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'attendance-actions';
    const viewButton = document.createElement('button');
    viewButton.className = 'button button-outline-dark attendance-edit-button';
    viewButton.type = 'button';
    viewButton.dataset.viewEmployee = employee.id;
    viewButton.textContent = 'View';
    const editButton = document.createElement('button');
    editButton.className = 'button button-outline-dark attendance-edit-button';
    editButton.type = 'button';
    editButton.dataset.editEmployee = employee.id;
    editButton.textContent = 'Edit details';
    actions.append(viewButton, editButton);
    actionCell.append(actions);
    row.append(actionCell);
    employeeDirectoryList.append(row);
  }
}

function openEmployeeProfile(employee) {
  employeeProfileTitle.textContent = employee.employeeName || 'Employee profile';
  const fields = [
    ['Employee name', employee.employeeName],
    ['Father name', employee.fatherName],
    ['Mother name', employee.motherName],
    ['Family size', employee.familySize],
    ['Residential address', employee.address],
    ['Aadhaar number', employee.aadhaarNumber],
    ['PAN number', employee.panNumber],
    ['Bank account number', employee.bankAccountNumber],
    ['Bank IFSC', employee.ifscCode],
    ['Mobile number', employee.mobileNumber],
    ['Emergency mobile number', employee.emergencyMobileNumber],
    ['Has bike', employee.hasBike ? 'Yes' : 'No'],
    ['Valid licence', employee.hasValidLicence ? 'Yes' : 'No'],
  ];
  employeeProfileDetails.replaceChildren(...fields.map(([label, value]) => {
    const group = document.createElement('div');
    const term = document.createElement('dt');
    term.textContent = label;
    const detail = document.createElement('dd');
    detail.textContent = String(value ?? '—');
    group.append(term, detail);
    return group;
  }));
  employeeProfileDialog.showModal();
}

function editEmployee(employee) {
  editingEmployeeId = employee.id;
  for (const field of [
    'employeeName',
    'fatherName',
    'motherName',
    'familySize',
    'address',
    'aadhaarNumber',
    'panNumber',
    'bankAccountNumber',
    'ifscCode',
    'mobileNumber',
    'emergencyMobileNumber',
  ]) {
    employeeForm.elements[field].value = employee[field] ?? '';
  }
  employeeForm.elements.hasBike.value = String(employee.hasBike);
  employeeForm.elements.hasValidLicence.value = String(employee.hasValidLicence);
  employeeForm.querySelector('button[type="submit"]').textContent = 'Save employee changes';
  employeeCancelEditButton.hidden = false;
  showStatus(employeeStatus, `Editing ${employee.employeeName || 'employee'} details.`);
  employeeForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
  employeeForm.elements.employeeName.focus({ preventScroll: true });
}

async function verifyAdminAccess(user) {
  if (!user) return false;

  try {
    const token = await getIdTokenResult(user);
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

function clearProjectForms() {
  stopProjectActivity?.();
  stopProjectActivity = undefined;
  projectPayments = [];
  projectUpdates = [];
  projectChanges = [];
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
  renderProjectActivity();
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
  for (const [key, value] of Object.entries({
    projectType: project.projectType || 'Residential', projectCategory: project.projectCategory || '',
    projectManager: project.projectManager || '', siteEngineer: project.siteEngineer || '',
    contractor: project.contractor || '',
    plotArea: project.plotArea ?? '', builtUpArea: project.builtUpArea ?? '', floors: project.floors ?? '',
    priority: project.priority || 'Normal', startDate: project.startDate || '',
    expectedCompletionDate: project.expectedCompletionDate || '', actualCompletionDate: project.actualCompletionDate || '',
    budget: project.budget ?? '', gpsLocation: project.gpsLocation || '',
  })) updateForm.elements[key].value = value;
  updateForm.elements.workStatus.value = project.workStatus || 'Planning';
  updateForm.elements.paymentStatus.value = project.paymentStatus || 'Not provided';
  updateForm.elements.contractAmount.value = project.contractAmount ?? '';
  updateForm.elements.amountPaid.value = project.amountPaid ?? '';
  for (const number of [1, 2, 3]) {
    updateForm.elements[`installment${number}`].value = '';
    updateForm.elements[`installment${number}`].disabled = true;
  }
  updateForm.elements.progressPercent.value = project.progressPercent ?? '';
  updateForm.elements.estimatedDeliveryDays.value = project.estimatedDeliveryDays ?? '';
  stopProjectActivity?.();
  projectPayments = [];
  projectUpdates = [];
  projectChanges = [];
  renderProjectActivity();
  const stopPayments = onSnapshot(collection(db, 'projects', projectId, 'payments'), (snapshot) => {
    projectPayments = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((left, right) => Number(left.installment) - Number(right.installment));
    const recordedInstallments = new Set(projectPayments.map((payment) => Number(payment.installment)));
    for (const number of [1, 2, 3]) {
      const input = updateForm.elements[`installment${number}`];
      input.disabled = recordedInstallments.has(number);
    }
    renderProjectActivity();
  }, (error) => {
    console.error('Unable to load project payments:', error);
    showStatus(updateStatus, 'Project activity could not be loaded. Try again before recording an installment.', true);
  });
  const stopUpdates = onSnapshot(collection(db, 'projects', projectId, 'updates'), (snapshot) => {
    projectUpdates = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderProjectActivity();
  }, (error) => {
    console.error('Unable to load project updates:', error);
    showStatus(updateStatus, 'Project activity could not be loaded.', true);
  });
  const stopChanges = onSnapshot(collection(db, 'projects', projectId, 'activity'), (snapshot) => {
    projectChanges = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderProjectActivity();
  }, (error) => {
    console.error('Unable to load project change history:', error);
    showStatus(updateStatus, 'Project activity could not be loaded.', true);
  });
  stopProjectActivity = () => {
    stopPayments();
    stopUpdates();
    stopChanges();
  };
  showStatus(updateStatus, '');
  showStatus(uploadStatus, '');
}

function renderProjectActivity() {
  projectActivity.replaceChildren();
  const activityItems = [
    ...projectPayments.map((payment) => ({
      id: `payment-${payment.id}`,
      title: 'Payment received',
      message: `Installment ${payment.installment}: ${new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
      }).format(Number(payment.amount) || 0)}`,
      createdAt: payment.paidAt,
    })),
    ...projectUpdates.map((update) => ({
      id: `update-${update.id}`,
      title: 'Site update',
      message: [update.message || 'Project progress update', ...(update.media || []).map((item) => item.name || 'Project media')]
        .join(' · '),
      createdAt: update.createdAt,
    })),
    ...projectChanges.map((change) => ({
      id: `change-${change.id}`,
      title: change.type === 'project_created' ? 'Project created' : 'Project details changed',
      message: change.message,
      createdAt: change.createdAt,
    })),
  ].sort((left, right) =>
    (right.createdAt?.toMillis?.() || 0) - (left.createdAt?.toMillis?.() || 0),
  );
  if (!activityItems.length) {
    const empty = document.createElement('li');
    empty.className = 'project-activity-empty';
    empty.textContent = 'No activity recorded yet.';
    projectActivity.append(empty);
    return;
  }

  const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  for (const item of activityItems) {
    const entry = document.createElement('li');
    entry.className = 'project-activity-entry';
    const heading = document.createElement('div');
    heading.className = 'project-activity-heading';
    const title = document.createElement('strong');
    title.textContent = item.title;
    const time = document.createElement('time');
    const date = item.createdAt?.toDate?.();
    time.textContent = date ? dateTimeFormatter.format(date) : 'Timestamp pending';
    heading.append(title, time);
    const message = document.createElement('p');
    message.textContent = item.message || '';
    entry.append(heading, message);
    projectActivity.append(entry);
  }
}

function updateMetrics() {
  const projectValues = [...projects.values()];
  const summary = summarizeAdminWorkspace(projectValues, leads);
  document.querySelector('#metric-projects').textContent = String(projectValues.length);
  document.querySelector('#metric-active').textContent = String(summary.activeProjects);
  document.querySelector('#metric-completed').textContent = String(summary.completedProjects);
  document.querySelector('#metric-leads').textContent = String(summary.leadCount);

  renderBusinessSummary(summary);
}

async function saveAttendanceStatus(employeeName, status, buttonGroup) {
  if (!isAdmin || !attendanceDate.value) return;
  const buttons = [...buttonGroup.querySelectorAll('button')];
  buttons.forEach((button) => { button.disabled = true; });
  try {
    const employeeKey = employeeName.trim().toLocaleLowerCase();
    const matchingRecords = attendanceRecords.filter((record) =>
      String(record.employeeName || '').trim().toLocaleLowerCase() === employeeKey,
    );
    const currentRecord = matchingRecords[0];
    const previousRecord = [...monthlyAttendanceRecords]
      .filter((record) => String(record.employeeName || '').trim().toLocaleLowerCase() === employeeKey)
      .sort((left, right) => String(right.workDate || '').localeCompare(String(left.workDate || '')))[0];
    const attendanceData = {
      employeeName,
      section: currentRecord?.section || previousRecord?.section || 'Unassigned section',
      location: currentRecord?.location || previousRecord?.location || 'Not set',
      status,
      dailyWage: Number(currentRecord?.dailyWage ?? previousRecord?.dailyWage) || 0,
      workDate: attendanceDate.value,
    };
    if (matchingRecords.length > 1) {
      const batch = writeBatch(db);
      batch.update(doc(db, 'employeeAttendance', currentRecord.id), {
        ...attendanceData,
        updatedAt: serverTimestamp(),
      });
      for (const duplicate of matchingRecords.slice(1)) {
        batch.delete(doc(db, 'employeeAttendance', duplicate.id));
      }
      await batch.commit();
    } else if (currentRecord) {
      await updateDoc(doc(db, 'employeeAttendance', currentRecord.id), { ...attendanceData, updatedAt: serverTimestamp() });
    } else {
      await addDoc(collection(db, 'employeeAttendance'), {
        ...attendanceData,
        recordedAt: serverTimestamp(),
      });
    }
    showStatus(document.querySelector('#attendance-status-message'), `${employeeName} marked ${status.toLowerCase()} for ${attendanceDate.value}.`);
  } catch (error) {
    console.error('Unable to update attendance status:', error);
    showStatus(document.querySelector('#attendance-status-message'), `Could not mark ${employeeName} ${status.toLowerCase()}. Check Firestore rules and try again.`, true);
    buttons.forEach((button) => { button.disabled = false; });
  }
}

function renderAttendance() {
  // Employees without a record for the selected date are counted as absent.
  // This keeps the daily headcount tied to the employee directory even before
  // an attendance entry has been submitted for every employee.
  const summary = summarizeAttendance(attendanceRecords, employeeRecords);
  const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });
  document.querySelector('#attendance-working-count').textContent = String(summary.workingCount);
  document.querySelector('#attendance-absent-count').textContent = String(summary.absentCount);
  document.querySelector('#attendance-leave-count').textContent = String(summary.leaveCount);
  document.querySelector('#attendance-salary-spend').textContent = currencyFormatter.format(summary.dailySalarySpend);
  document.querySelector('#attendance-nav-summary').textContent = `${summary.workingCount} present · ${summary.absentCount} absent · ${summary.leaveCount} leave`;

  const locationSummary = document.querySelector('#attendance-location-summary');
  locationSummary.replaceChildren();
  if (!summary.locations.length) {
    const empty = document.createElement('p');
    empty.textContent = 'No workers recorded.';
    locationSummary.append(empty);
  } else {
    locationSummary.replaceChildren(...summary.locations.map(({ location, count }) => {
      const row = document.createElement('p');
      const name = document.createElement('span');
      name.textContent = location;
      const headcount = document.createElement('strong');
      headcount.textContent = String(count);
      row.append(name, headcount);
      return row;
    }));
  }

  const leaveList = document.querySelector('#attendance-leave-list');
  leaveList.replaceChildren();
  for (const record of summary.leaveRecords) {
    const employee = document.createElement('p');
    employee.textContent = `${record.employeeName} · ${record.section}`;
    leaveList.append(employee);
  }

  attendanceRecordList.replaceChildren();
  const roster = new Map();
  for (const employee of employeeRecords) {
    const employeeName = String(employee.employeeName || '').trim();
    if (employeeName) roster.set(employeeName.toLocaleLowerCase(), { employeeName });
  }
  for (const record of attendanceRecords) {
    const employeeName = String(record.employeeName || '').trim();
    if (employeeName && !roster.has(employeeName.toLocaleLowerCase())) {
      roster.set(employeeName.toLocaleLowerCase(), { employeeName });
    }
  }
  const sortedEmployees = [...roster.values()].sort((left, right) =>
    left.employeeName.localeCompare(right.employeeName, undefined, { sensitivity: 'base' }),
  );
  if (!sortedEmployees.length) {
    const row = document.createElement('tr');
    const empty = document.createElement('td');
    empty.colSpan = 7;
    empty.textContent = employeeRecords.length ? 'Loading employee attendance...' : 'Add employees to the directory to start the daily register.';
    row.append(empty);
    attendanceRecordList.append(row);
    return;
  }

  for (const employee of sortedEmployees) {
    const record = attendanceRecords.find((item) =>
      String(item.employeeName || '').trim().toLocaleLowerCase() === employee.employeeName.toLocaleLowerCase(),
    );
    const row = document.createElement('tr');
    for (const value of [employee.employeeName, record?.section || '—', record?.location || '—',
      record ? currencyFormatter.format(Number(record.dailyWage) || 0) : '—']) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }

    const statusCell = document.createElement('td');
    const status = record?.status || 'Not marked';
    statusCell.textContent = status;
    statusCell.className = `attendance-status-cell attendance-status-${String(status).toLowerCase().replace(/[^a-z]+/g, '-')}`;
    row.append(statusCell);

    const markCell = document.createElement('td');
    const markActions = document.createElement('div');
    markActions.className = 'attendance-actions';
    for (const nextStatus of ['Present', 'Absent']) {
      const markButton = document.createElement('button');
      markButton.type = 'button';
      markButton.className = `button button-outline-dark attendance-mark-button attendance-mark-${nextStatus.toLowerCase()}`;
      markButton.textContent = nextStatus;
      markButton.setAttribute('aria-pressed', String(record?.status === nextStatus));
      markButton.setAttribute('aria-label', `Mark ${employee.employeeName} ${nextStatus.toLowerCase()} for ${attendanceDate.value}`);
      markButton.addEventListener('click', () => saveAttendanceStatus(employee.employeeName, nextStatus, markActions));
      markActions.append(markButton);
    }
    markCell.append(markActions);
    row.append(markCell);

    const actionCell = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'attendance-actions';
    if (record) {
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'button button-outline-dark attendance-edit-button';
      editButton.textContent = 'Edit details';
      editButton.setAttribute('aria-label', `Edit attendance details for ${employee.employeeName}`);
      editButton.addEventListener('click', () => {
        if (!isAdmin) return;
        editingAttendanceId = record.id;
        attendanceForm.elements.employeeName.value = record.employeeName || '';
        attendanceForm.elements.section.value = record.section || '';
        attendanceForm.elements.location.value = record.location || '';
        attendanceForm.elements.status.value = record.status || 'Present';
        attendanceForm.elements.dailyWage.value = record.dailyWage ?? '';
        attendanceDate.disabled = true;
        attendanceForm.querySelector('button[type="submit"]').textContent = 'Save attendance';
        attendanceCancelEditButton.hidden = false;
        showStatus(document.querySelector('#attendance-status-message'), `Editing ${record.employeeName}'s attendance for ${attendanceDate.value}.`);
        attendanceForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        attendanceForm.elements.employeeName.focus({ preventScroll: true });
      });
      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'button button-outline-dark attendance-remove-button';
      removeButton.textContent = 'Remove';
      removeButton.setAttribute('aria-label', `Remove attendance for ${employee.employeeName}`);
      removeButton.addEventListener('click', async () => {
        if (!isAdmin || !window.confirm(`Remove attendance for ${employee.employeeName}?`)) return;
        removeButton.disabled = true;
        try {
          await deleteDoc(doc(db, 'employeeAttendance', record.id));
          if (editingAttendanceId === record.id) resetAttendanceEditor();
        } catch (error) {
          console.error('Unable to remove attendance record:', error);
          showStatus(globalStatus, 'Attendance record could not be removed. Check Firestore rules and try again.', true);
          removeButton.disabled = false;
        }
      });
      actions.append(editButton, removeButton);
    }
    actionCell.append(actions);
    row.append(actionCell);
    attendanceRecordList.append(row);
  }
}

function renderAttendanceBook() {
  const monthValue = attendanceBookMonth.value;
  const { daysInMonth, rows } = buildMonthlyAttendanceBook(monthlyAttendanceRecords, monthValue);
  const columnCount = daysInMonth + 5;
  const [year, month] = monthValue.split('-').map(Number);
  const monthLabel = month && year
    ? new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
    : '';
  const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });

  attendanceBookCount.textContent = `${rows.length} employee${rows.length === 1 ? '' : 's'} recorded${monthLabel ? ` for ${monthLabel}` : ''}`;

  const headerRow = document.createElement('tr');
  const employeeHeading = document.createElement('th');
  employeeHeading.scope = 'col';
  employeeHeading.textContent = 'Employee / section';
  headerRow.append(employeeHeading);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const heading = document.createElement('th');
    heading.className = 'attendance-day-cell';
    heading.scope = 'col';
    heading.textContent = String(day);
    heading.setAttribute('aria-label', `Day ${day}`);
    headerRow.append(heading);
  }
  for (const label of ['Present', 'Absent', 'Leave', 'Wages']) {
    const heading = document.createElement('th');
    heading.scope = 'col';
    heading.textContent = label;
    headerRow.append(heading);
  }
  attendanceBookHeader.replaceChildren(headerRow);
  attendanceBookList.replaceChildren();
  attendanceBookTotals.replaceChildren();

  if (!rows.length) {
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = columnCount;
    emptyCell.textContent = monthValue ? 'No attendance records for this month.' : 'Select a month to view attendance.';
    emptyRow.append(emptyCell);
    attendanceBookList.append(emptyRow);
    return;
  }

  let currentSection;
  for (const employee of rows) {
    if (employee.section !== currentSection) {
      currentSection = employee.section;
      const sectionRow = document.createElement('tr');
      sectionRow.className = 'attendance-section-row';
      const sectionHeading = document.createElement('th');
      sectionHeading.colSpan = columnCount;
      sectionHeading.scope = 'rowgroup';
      sectionHeading.textContent = employee.section;
      sectionRow.append(sectionHeading);
      attendanceBookList.append(sectionRow);
    }

    const row = document.createElement('tr');
    const employeeCell = document.createElement('th');
    employeeCell.scope = 'row';
    employeeCell.textContent = employee.employeeName;
    row.append(employeeCell);
    for (const mark of employee.days) {
      const cell = document.createElement('td');
      cell.className = 'attendance-day-cell';
      cell.textContent = mark || '—';
      if (mark) {
        const markClass = { P: 'present', A: 'absent', L: 'leave' }[mark];
        cell.classList.add(`attendance-mark-${markClass}`);
        cell.title = { P: 'Present', A: 'Absent', L: 'Leave' }[mark];
      }
      row.append(cell);
    }
    for (const value of [
      String(employee.presentDays),
      String(employee.absentDays),
      String(employee.leaveDays),
      currencyFormatter.format(employee.salarySpend),
    ]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    attendanceBookList.append(row);
  }

  const dailyPresentTotals = Array.from({ length: daysInMonth }, (_, index) =>
    rows.reduce((total, employee) => total + (employee.days[index] === 'P' ? 1 : 0), 0),
  );
  const dailyLeaveTotals = Array.from({ length: daysInMonth }, (_, index) =>
    rows.reduce((total, employee) => total + (employee.days[index] === 'L' ? 1 : 0), 0),
  );
  const dailyAbsentTotals = Array.from({ length: daysInMonth }, (_, index) =>
    rows.reduce((total, employee) => total + (employee.days[index] === 'A' ? 1 : 0), 0),
  );
  const totalPresentDays = rows.reduce((total, employee) => total + employee.presentDays, 0);
  const totalAbsentDays = rows.reduce((total, employee) => total + employee.absentDays, 0);
  const totalLeaveDays = rows.reduce((total, employee) => total + employee.leaveDays, 0);
  const totalWages = rows.reduce((total, employee) => total + employee.salarySpend, 0);

  for (const [label, dailyTotals, presentTotal, absentTotal, leaveTotal, wageTotal] of [
    ['Present totals', dailyPresentTotals, String(totalPresentDays), '', '', currencyFormatter.format(totalWages)],
    ['Absent totals', dailyAbsentTotals, '', String(totalAbsentDays), '', ''],
    ['Leave totals', dailyLeaveTotals, '', '', String(totalLeaveDays), ''],
  ]) {
    const row = document.createElement('tr');
    const labelCell = document.createElement('th');
    labelCell.scope = 'row';
    labelCell.textContent = label;
    row.append(labelCell);
    for (const total of dailyTotals) {
      const cell = document.createElement('td');
      cell.className = 'attendance-day-cell';
      cell.textContent = String(total);
      row.append(cell);
    }
    for (const value of [presentTotal, absentTotal, leaveTotal, wageTotal]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    attendanceBookTotals.append(row);
  }
}

function renderEmployeePayroll() {
  const monthValue = attendanceBookMonth.value;
  const attendanceRows = buildMonthlyAttendanceBook(monthlyAttendanceRecords, monthValue).rows;
  const payrollRows = summarizeEmployeePayroll(attendanceRows, employeePayoutRecords);
  const [year, month] = monthValue.split('-').map(Number);
  employeePayoutMonth.textContent = month && year
    ? new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
    : 'Not selected';
  const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  });
  const balanceLabel = (balance) => balance >= 0
    ? currencyFormatter.format(balance)
    : `Advance ${currencyFormatter.format(Math.abs(balance))}`;

  renderEmployeeNameOptions();
  employeePayrollSummary.replaceChildren();
  employeePayrollTotals.replaceChildren();
  if (!payrollRows.length) {
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = 5;
    emptyCell.textContent = 'No employee earnings or payouts for this month.';
    emptyRow.append(emptyCell);
    employeePayrollSummary.append(emptyRow);
  } else {
    for (const employee of payrollRows) {
      const row = document.createElement('tr');
      const employeeCell = document.createElement('td');
      const ledgerButton = document.createElement('button');
      ledgerButton.className = 'employee-ledger-open';
      ledgerButton.type = 'button';
      ledgerButton.dataset.employeeLedger = employee.employeeName;
      ledgerButton.setAttribute('aria-haspopup', 'dialog');
      ledgerButton.textContent = employee.employeeName;
      employeeCell.append(ledgerButton);
      row.append(employeeCell);
      for (const value of [
        employee.section,
        currencyFormatter.format(employee.earnings),
        currencyFormatter.format(employee.payouts),
        balanceLabel(employee.balance),
      ]) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      }
      employeePayrollSummary.append(row);
    }

    const totalEarnings = payrollRows.reduce((total, employee) => total + employee.earnings, 0);
    const totalPayouts = payrollRows.reduce((total, employee) => total + employee.payouts, 0);
    const totalBalance = totalEarnings - totalPayouts;
    const totalsRow = document.createElement('tr');
    const totalsHeading = document.createElement('th');
    totalsHeading.scope = 'row';
    totalsHeading.textContent = 'Month totals';
    totalsRow.append(totalsHeading);
    for (const value of [
      '—',
      currencyFormatter.format(totalEarnings),
      currencyFormatter.format(totalPayouts),
      balanceLabel(totalBalance),
    ]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      totalsRow.append(cell);
    }
    employeePayrollTotals.append(totalsRow);
  }

  employeePayoutHistory.replaceChildren();
  const sortedPayouts = [...employeePayoutRecords].sort((left, right) =>
    (right.paidAt?.toMillis?.() || 0) - (left.paidAt?.toMillis?.() || 0),
  );
  if (!sortedPayouts.length) {
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = 4;
    emptyCell.textContent = 'No payouts recorded for this month.';
    emptyRow.append(emptyCell);
    employeePayoutHistory.append(emptyRow);
    return;
  }

  const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  for (const payout of sortedPayouts) {
    const row = document.createElement('tr');
    const paidAt = payout.paidAt?.toDate?.();
    for (const value of [
      payout.employeeName,
      currencyFormatter.format(Number(payout.amount) || 0),
      payout.paymentMode,
      paidAt ? dateTimeFormatter.format(paidAt) : 'Timestamp pending',
    ]) {
      const cell = document.createElement('td');
      cell.textContent = value || '—';
      row.append(cell);
    }
    employeePayoutHistory.append(row);
  }
}

function openEmployeeLedger(employeeName) {
  const monthValue = attendanceBookMonth.value;
  const attendanceRows = buildMonthlyAttendanceBook(monthlyAttendanceRecords, monthValue).rows;
  const transactions = buildEmployeeLedger(attendanceRows, employeePayoutRecords, employeeName);
  const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  });
  const dateFormatter = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' });
  const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const earnings = transactions.reduce((total, transaction) => total + transaction.credit, 0);
  const payouts = transactions.reduce((total, transaction) => total + transaction.debit, 0);
  const closingBalance = transactions.length ? transactions[transactions.length - 1].balance : 0;
  const [year, month] = monthValue.split('-').map(Number);
  const period = year && month
    ? new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
    : 'Selected month';

  employeeLedgerTitle.textContent = employeeName;
  employeeLedgerPeriod.textContent = `Statement period: ${period}`;
  employeeLedgerEarnings.textContent = currencyFormatter.format(earnings);
  employeeLedgerPayouts.textContent = currencyFormatter.format(payouts);
  employeeLedgerBalance.textContent = currencyFormatter.format(closingBalance);
  employeeLedgerEntries.replaceChildren();
  if (!transactions.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.textContent = 'No earnings or payouts recorded for this employee in this month.';
    row.append(cell);
    employeeLedgerEntries.append(row);
  } else {
    for (const transaction of transactions) {
      const row = document.createElement('tr');
      const dateCell = document.createElement('td');
      if (transaction.paidAt) {
        dateCell.textContent = dateTimeFormatter.format(transaction.paidAt);
      } else if (transaction.workDate) {
        const [entryYear, entryMonth, entryDay] = transaction.workDate.split('-').map(Number);
        dateCell.textContent = dateFormatter.format(new Date(entryYear, entryMonth - 1, entryDay));
      } else {
        dateCell.textContent = 'Timestamp pending';
      }
      row.append(dateCell);
      for (const value of [
        transaction.description,
        transaction.credit ? currencyFormatter.format(transaction.credit) : '—',
        transaction.debit ? currencyFormatter.format(transaction.debit) : '—',
        currencyFormatter.format(transaction.balance),
      ]) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      }
      employeeLedgerEntries.append(row);
    }
  }
  employeeLedgerDialog.showModal();
}

function watchAttendance() {
  stopAttendance?.();
  const workDate = attendanceDate.value;
  attendanceRecords = [];
  renderAttendance();
  if (!workDate) return;
  stopAttendance = onSnapshot(
    query(collection(db, 'employeeAttendance'), where('workDate', '==', workDate)),
    (snapshot) => {
      attendanceRecords = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderAttendance();
    },
    (error) => {
      console.error('Unable to load employee attendance:', error);
      attendanceRecords = [];
      renderAttendance();
      showStatus(globalStatus, 'Attendance could not be loaded. Deploy the latest Firestore rules and try again.', true);
    },
  );
}

function watchAttendanceBook() {
  stopAttendanceBook?.();
  monthlyAttendanceRecords = [];
  renderAttendanceBook();
  renderEmployeePayroll();
  const monthValue = attendanceBookMonth.value;
  const monthParts = /^(\d{4})-(\d{2})$/.exec(monthValue);
  if (!monthParts) return;

  const year = Number(monthParts[1]);
  const month = Number(monthParts[2]);
  if (month < 1 || month > 12) return;
  const nextMonth = new Date(year, month, 1);
  const startDate = `${monthValue}-01`;
  const endDate = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
  attendanceBookCount.textContent = `Loading attendance for ${monthValue}...`;
  stopAttendanceBook = onSnapshot(
    query(
      collection(db, 'employeeAttendance'),
      where('workDate', '>=', startDate),
      where('workDate', '<', endDate),
    ),
    (snapshot) => {
      monthlyAttendanceRecords = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderAttendanceBook();
      renderEmployeePayroll();
    },
    (error) => {
      console.error('Unable to load monthly employee attendance:', error);
      monthlyAttendanceRecords = [];
      renderAttendanceBook();
      renderEmployeePayroll();
      attendanceBookCount.textContent = 'Attendance book could not be loaded.';
      showStatus(globalStatus, 'The monthly attendance book is unavailable. Check Firestore rules and try again.', true);
    },
  );
}

function watchEmployeePayouts() {
  stopEmployeePayouts?.();
  employeePayoutRecords = [];
  renderEmployeePayroll();
  const monthValue = attendanceBookMonth.value;
  if (!monthValue) return;
  stopEmployeePayouts = onSnapshot(
    query(collection(db, 'employeePayouts'), where('earningMonth', '==', monthValue)),
    (snapshot) => {
      employeePayoutRecords = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderEmployeePayroll();
    },
    (error) => {
      console.error('Unable to load employee payouts:', error);
      employeePayoutRecords = [];
      renderEmployeePayroll();
      showStatus(globalStatus, 'Employee payouts could not be loaded. Check Firestore rules and try again.', true);
    },
  );
}

function watchEmployees() {
  stopEmployees?.();
  employeeRecords = [];
  renderEmployeeDirectory();
  stopEmployees = onSnapshot(
    collection(db, 'employees'),
    (snapshot) => {
      employeeRecords = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderEmployeeDirectory();
      renderAttendance();
    },
    (error) => {
      console.error('Unable to load employee profiles:', error);
      employeeRecords = [];
      renderEmployeeDirectory();
      renderAttendance();
      showStatus(employeeStatus, 'Employee profiles could not be loaded. Check Firestore rules and try again.', true);
    },
  );
}

function renderBusinessSummary(summary) {
  const summaryGrid = document.querySelector('#dashboard-summary-grid');
  const panelGrid = document.querySelector('#project-dashboard-panel');
  const financeGrid = document.querySelector('#finance-summary-grid');
  const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });

  const cards = [
    { label: 'Revenue booked', value: currencyFormatter.format(summary.totalRevenue) },
    { label: 'Collected', value: currencyFormatter.format(summary.totalCollected) },
    { label: 'Outstanding', value: currencyFormatter.format(summary.outstanding) },
    { label: 'Customer count', value: String(summary.customerCount) },
  ];

  const panelCards = [
    { label: 'Projects', value: String(summary.totalProjects) },
    { label: 'Active', value: String(summary.activeProjects) },
    { label: 'Completed', value: String(summary.completedProjects) },
    { label: 'Delayed', value: String(summary.delayedProjects) },
    { label: 'On hold', value: String(summary.onHoldProjects) },
    { label: 'Avg. progress', value: `${summary.averageProgress.toFixed(1)}%` },
  ];

  const financeCards = [
    { label: 'Estimated cost', value: currencyFormatter.format(summary.estimatedCost) },
    { label: 'Actual cost recorded', value: currencyFormatter.format(summary.actualCost) },
    { label: 'Won leads', value: String(summary.wonLeads) },
    { label: 'Pipeline', value: String(summary.pipelineLeads) },
    { label: 'Total customers', value: String(summary.customerCount) },
    { label: 'Avg. progress', value: `${summary.averageProgress.toFixed(1)}%` },
  ];

  for (const [target, values] of [[summaryGrid, cards], [panelGrid, panelCards], [financeGrid, financeCards]]) {
    if (!target) continue;
    target.replaceChildren(...values.map((item) => {
      const wrapper = document.createElement('div');
      const label = document.createElement('span');
      label.textContent = item.label;
      const strong = document.createElement('strong');
      strong.textContent = item.value;
      wrapper.append(label, strong);
      return wrapper;
    }));
  }

  const customerList = document.querySelector('#customer-list');
  if (customerList) {
    const customerRows = getCustomerRows(projects);
    if (!customerRows.length) {
      customerList.innerHTML = '<tr><td colspan="5">No customers have been linked to a project yet.</td></tr>';
    } else {
      customerList.replaceChildren(...customerRows.map((item) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${item.customerId}</td>
          <td>${item.projectCount}</td>
          <td>${currencyFormatter.format(item.totalRevenue)}</td>
          <td>${currencyFormatter.format(item.totalCollected)}</td>
          <td>${Math.round(item.latestProgress)}%</td>
        `;
        return row;
      }));
    }
  }

  const chart = document.querySelector('#project-chart');
  if (chart) {
    const statusBreakdown = getStatusBreakdown(projects);
    const maxCount = Math.max(...statusBreakdown.map((item) => item.count), 1);
    chart.replaceChildren(...statusBreakdown.map((item) => {
      const row = document.createElement('div');
      row.className = 'chart-bar-row';
      const label = document.createElement('span');
      label.className = 'chart-bar-label';
      label.textContent = item.label;
      const track = document.createElement('div');
      track.className = 'chart-track';
      const fill = document.createElement('span');
      fill.className = 'chart-fill';
      fill.style.width = `${(item.count / maxCount) * 100}%`;
      track.append(fill);
      const value = document.createElement('span');
      value.className = 'chart-value';
      value.textContent = String(item.count);
      row.append(label, track, value);
      return row;
    }));
  }
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
    const followUpLabel = document.createElement('label');
    followUpLabel.textContent = 'Next follow-up date';
    const followUpDate = document.createElement('input');
    followUpDate.type = 'date';
    followUpDate.name = 'followUpDate';
    followUpDate.value = lead.followUpDate || '';
    followUpLabel.append(followUpDate);
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
    form.append(statusLabel, followUpLabel, noteLabel, save, saveStatus);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!isAdmin) return;
      save.disabled = true;
      showStatus(saveStatus, 'Saving...');
      try {
        await updateDoc(doc(db, 'inquiries', lead.id), {
          leadStatus: statusSelect.value,
          adminNotes: notes.value.trim(),
          followUpDate: followUpDate.value || null,
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
  renderProjectList();
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
    option.textContent = `${project.projectCode || makeProjectCode(id)} · ${project.projectName || 'Untitled project'} · Client ID: ${project.customerId || 'unavailable'}`;
    projectPicker.append(option);
  }
  if (projects.has(selected)) projectPicker.value = selected;
  refreshClientPicker();
  selectProject(projectPicker.value);
  updateMetrics();
}

function renderProjectList() {
  const projectList = document.querySelector('#admin-project-list');
  if (projectList) {
    const rows = filteredProjectRows();
    if (!rows.length) {
      projectList.innerHTML = '<tr><td colspan="7">No projects match these filters.</td></tr>';
    } else {
      projectList.replaceChildren(...rows.map(([id, project]) => {
        const row = document.createElement('tr');
        for (const value of [
          project.projectName || 'Untitled project',
          project.projectCode || id,
          project.customerId || 'Client ID unavailable',
          [project.projectType, project.projectCategory].filter(Boolean).join(' / ') || '—',
          project.workStatus || 'Not set',
          [project.startDate, project.expectedCompletionDate].filter(Boolean).join(' – ') || 'Not scheduled',
          `${Math.round(Number(project.progressPercent) || 0)}%`,
        ]) {
          const cell = document.createElement('td');
          cell.textContent = String(value);
          row.append(cell);
        }
        return row;
      }));
    }
  }
}

function refreshClientPicker() {
  const customerPicker = document.querySelector('#customer-uid');
  if (!customerPicker) return;
  const selected = customerPicker.value;
  customerPicker.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = clients.size ? 'Select a client' : 'No client accounts available';
  customerPicker.append(placeholder);
  const sortedClients = [...clients.entries()].sort((left, right) => {
    const leftLabel = left[1].displayName || left[1].name || left[1].email || left[0];
    const rightLabel = right[1].displayName || right[1].name || right[1].email || right[0];
    return String(leftLabel).localeCompare(String(rightLabel));
  });
  for (const [id, client] of sortedClients) {
    const option = document.createElement('option');
    option.value = client.uid || id;
    const label = client.displayName || client.name || client.email || 'Client';
    option.textContent = `${label} · Client ID: ${client.uid || id}`;
    customerPicker.append(option);
  }
  if ([...customerPicker.options].some((option) => option.value === selected)) customerPicker.value = selected;
  const projectClientFilter = document.querySelector('#project-client-filter');
  if (projectClientFilter) {
    const filterValue = projectClientFilter.value;
    projectClientFilter.replaceChildren(new Option('All clients', ''));
    for (const option of [...customerPicker.options].filter((item) => item.value)) {
      projectClientFilter.append(new Option(option.textContent, option.value));
    }
    projectClientFilter.value = filterValue;
  }
}

function filteredProjectRows() {
  const rows = [...projects.entries()].map(([id, project]) => [id, { ...project, id }]);
  const filtered = filterProjects(rows.map(([, project]) => project), {
    status: document.querySelector('#project-status-filter')?.value || '',
    clientId: document.querySelector('#project-client-filter')?.value || '',
    search: document.querySelector('#project-search-filter')?.value || '',
    startFrom: document.querySelector('#project-start-filter')?.value || '',
    completeBy: document.querySelector('#project-end-filter')?.value || '',
  });
  return filtered.sort((left, right) => String(left.projectName || '').localeCompare(String(right.projectName || '')))
    .map((project) => [project.id, project]);
}

function watchClients() {
  stopClients?.();
  stopClients = onSnapshot(collection(db, 'customers'), (snapshot) => {
    clients = new Map(snapshot.docs.map((item) => [item.id, item.data()]));
    refreshClientPicker();
  }, (error) => {
    console.error('Unable to load admin clients:', error);
    clients = new Map();
    refreshClientPicker();
    showStatus(globalStatus, 'Client list could not be loaded. Check Firestore rules and try again.', true);
  });
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
  for (const tile of sectionTiles) {
    tile.setAttribute('aria-expanded', 'false');
    tile.addEventListener('click', () => showDashboardSection(tile));
  }
  for (const button of attendanceViewButtons) {
    button.addEventListener('click', () => showAttendanceView(button.dataset.attendanceViewButton));
  }
  document.querySelector('#admin-section-back').addEventListener('click', () => showDashboardSections(true));
  projectPicker.addEventListener('change', () => selectProject(projectPicker.value));
  for (const filter of ['#project-status-filter', '#project-client-filter', '#project-search-filter', '#project-start-filter', '#project-end-filter']) {
    document.querySelector(filter)?.addEventListener(filter.endsWith('search-filter') ? 'input' : 'change', renderProjectList);
  }
  leadSearch.addEventListener('input', renderLeads);
  leadStatusFilter.addEventListener('change', renderLeads);
  attendanceDate.value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  attendanceBookMonth.value = attendanceDate.value.slice(0, 7);
  attendanceDate.addEventListener('change', watchAttendance);
  attendanceBookMonth.addEventListener('change', () => {
    watchAttendanceBook();
    watchEmployeePayouts();
  });
  attendanceCancelEditButton.addEventListener('click', resetAttendanceEditor);
  employeeCancelEditButton.addEventListener('click', resetEmployeeEditor);
  employeeDirectoryList.addEventListener('click', (event) => {
    const viewButton = event.target.closest('button[data-view-employee]');
    if (viewButton) {
      const employee = employeeRecords.find((record) => record.id === viewButton.dataset.viewEmployee);
      if (employee) openEmployeeProfile(employee);
      return;
    }
    const button = event.target.closest('button[data-edit-employee]');
    if (!button) return;
    const employee = employeeRecords.find((record) => record.id === button.dataset.editEmployee);
    if (!employee) {
      showStatus(employeeStatus, 'That employee profile is no longer available. Refresh the directory and try again.', true);
      return;
    }
    editEmployee(employee);
  });
  employeePayrollSummary.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-employee-ledger]');
    if (button) openEmployeeLedger(button.dataset.employeeLedger);
  });
  clearProjectForms();

  employeeForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!isAdmin) return;
    const formData = new FormData(employeeForm);
    const employeeName = String(formData.get('employeeName') || '').trim();
    const fatherName = String(formData.get('fatherName') || '').trim();
    const motherName = String(formData.get('motherName') || '').trim();
    const familySize = Number(formData.get('familySize'));
    const address = String(formData.get('address') || '').trim();
    const aadhaarNumber = String(formData.get('aadhaarNumber') || '').trim();
    const panNumber = String(formData.get('panNumber') || '').trim().toUpperCase();
    const bankAccountNumber = String(formData.get('bankAccountNumber') || '').trim();
    const ifscCode = String(formData.get('ifscCode') || '').trim().toUpperCase();
    const mobileNumber = String(formData.get('mobileNumber') || '').trim();
    const emergencyMobileNumber = String(formData.get('emergencyMobileNumber') || '').trim();
    const hasBike = formData.get('hasBike') === 'true';
    const hasValidLicence = formData.get('hasValidLicence') === 'true';
    if (
      !employeeName
      || !fatherName
      || !motherName
      || !Number.isInteger(familySize)
      || familySize < 1
      || !address
      || !/^[0-9]{12}$/.test(aadhaarNumber)
      || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber)
      || !/^[0-9]{6,18}$/.test(bankAccountNumber)
      || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)
      || !/^[+]?[0-9]{10,15}$/.test(mobileNumber)
      || !/^[+]?[0-9]{10,15}$/.test(emergencyMobileNumber)
      || !['true', 'false'].includes(String(formData.get('hasBike')))
      || !['true', 'false'].includes(String(formData.get('hasValidLicence')))
    ) {
      showStatus(employeeStatus, 'Check the required details and formats, including 12-digit Aadhaar, PAN, bank, IFSC, and phone numbers.', true);
      return;
    }

    const employeeData = {
      employeeName,
      fatherName,
      motherName,
      familySize,
      address,
      aadhaarNumber,
      panNumber,
      bankAccountNumber,
      ifscCode,
      mobileNumber,
      emergencyMobileNumber,
      hasBike,
      hasValidLicence,
      updatedAt: serverTimestamp(),
    };
    const button = employeeForm.querySelector('button[type="submit"]');
    const isEditing = Boolean(editingEmployeeId);
    button.disabled = true;
    employeeCancelEditButton.disabled = true;
    showStatus(employeeStatus, isEditing ? 'Saving employee changes...' : 'Adding employee...');
    try {
      if (isEditing) {
        await updateDoc(doc(db, 'employees', editingEmployeeId), employeeData);
      } else {
        await addDoc(collection(db, 'employees'), {
          ...employeeData,
          createdAt: serverTimestamp(),
        });
      }
      resetEmployeeEditor();
      showStatus(employeeStatus, isEditing ? 'Employee details updated.' : 'Employee added.');
    } catch (error) {
      console.error('Unable to save employee profile:', error);
      showStatus(employeeStatus, 'Employee details could not be saved. Check Firestore rules and try again.', true);
    } finally {
      button.disabled = false;
      employeeCancelEditButton.disabled = false;
    }
  });

  employeePayoutForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!isAdmin) return;
    const formData = new FormData(employeePayoutForm);
    const employeeName = String(formData.get('employeeName') || '').trim();
    const amountValue = String(formData.get('amount') || '').trim();
    const amount = Number(amountValue);
    const paymentMode = String(formData.get('paymentMode') || '');
    const earningMonth = attendanceBookMonth.value;
    if (
      !employeeName
      || !amountValue
      || !Number.isFinite(amount)
      || amount <= 0
      || !earningMonth
      || !['Cash', 'Bank transfer', 'UPI', 'Cheque', 'Other'].includes(paymentMode)
    ) {
      showStatus(employeePayoutStatus, 'Enter an employee, a payout amount greater than zero, and a payment mode.', true);
      return;
    }

    const button = employeePayoutForm.querySelector('button[type="submit"]');
    button.disabled = true;
    showStatus(employeePayoutStatus, 'Recording payout...');
    try {
      await addDoc(collection(db, 'employeePayouts'), {
        employeeName,
        amount,
        paymentMode,
        earningMonth,
        paidAt: serverTimestamp(),
      });
      employeePayoutForm.reset();
      showStatus(employeePayoutStatus, 'Payout recorded with its date and time.');
    } catch (error) {
      console.error('Unable to record employee payout:', error);
      showStatus(employeePayoutStatus, 'Payout could not be recorded. Check Firestore rules and try again.', true);
    } finally {
      button.disabled = false;
    }
  });

  attendanceForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!isAdmin) return;
    const button = attendanceForm.querySelector('button[type="submit"]');
    const formData = new FormData(attendanceForm);
    const employeeName = String(formData.get('employeeName') || '').trim();
    const section = String(formData.get('section') || '').trim();
    const location = String(formData.get('location') || '').trim();
    const dailyWageValue = String(formData.get('dailyWage') || '').trim();
    const dailyWage = Number(dailyWageValue);
    const status = String(formData.get('status') || '');
    if (
      !employeeName
      || !section
      || !location
      || !attendanceDate.value
      || !dailyWageValue
      || !Number.isFinite(dailyWage)
      || dailyWage < 0
      || !['Present', 'Absent', 'Leave'].includes(status)
    ) {
      showStatus(document.querySelector('#attendance-status-message'), 'Enter an employee, work section, location, and valid daily wage.', true);
      return;
    }

    button.disabled = true;
    const isEditing = Boolean(editingAttendanceId);
    const existingRecord = !isEditing && attendanceRecords.find((record) =>
      String(record.employeeName || '').trim().toLocaleLowerCase() === employeeName.toLocaleLowerCase(),
    );
    showStatus(document.querySelector('#attendance-status-message'), isEditing || existingRecord ? 'Saving attendance changes...' : 'Saving attendance...');
    try {
      const attendanceData = {
        employeeName,
        section,
        location,
        status,
        dailyWage,
        workDate: attendanceDate.value,
      };
      if (isEditing) {
        await updateDoc(doc(db, 'employeeAttendance', editingAttendanceId), {
          ...attendanceData,
          updatedAt: serverTimestamp(),
        });
      } else if (existingRecord) {
        await updateDoc(doc(db, 'employeeAttendance', existingRecord.id), {
          ...attendanceData,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'employeeAttendance'), {
          ...attendanceData,
          recordedAt: serverTimestamp(),
        });
      }
      resetAttendanceEditor();
      showStatus(document.querySelector('#attendance-status-message'), isEditing || existingRecord ? 'Attendance updated.' : 'Attendance recorded.');
    } catch (error) {
      console.error(isEditing ? 'Unable to update employee attendance:' : 'Unable to record employee attendance:', error);
      showStatus(document.querySelector('#attendance-status-message'), `Attendance could not be ${isEditing ? 'updated' : 'saved'}. Check Firestore rules and try again.`, true);
    } finally {
      button.disabled = false;
    }
  });

  createForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!isAdmin) return;
    const button = createForm.querySelector('button[type="submit"]');
    button.disabled = true;
    showStatus(createStatus, 'Creating project...');
    const formData = new FormData(createForm);
    const startDate = String(formData.get('startDate') || '').trim();
    const completionDate = String(formData.get('expectedCompletionDate') || '').trim();
    if (startDate && completionDate && completionDate < startDate) {
      showStatus(createStatus, 'Expected completion must be on or after the project start date.', true);
      button.disabled = false;
      return;
    }
    try {
      const projectRef = doc(collection(db, 'projects'));
      const actor = auth.currentUser?.uid || '';
      const activityRef = doc(collection(db, 'projects', projectRef.id, 'activity'));
      const batch = writeBatch(db);
      batch.set(projectRef, {
        customerId: String(formData.get('customerUid')).trim(),
        projectName: String(formData.get('projectName')).trim(),
        siteAddress: String(formData.get('siteAddress')).trim(),
        projectCode: makeProjectCode(projectRef.id),
        ...readProjectMaster(formData),
        workStatus: 'Planning',
        paymentStatus: 'Not provided',
        contractAmount: null,
        amountPaid: null,
        progressPercent: 0,
        estimatedDeliveryDays: null,
        currency: 'INR',
        createdBy: actor,
        updatedBy: actor,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(activityRef, {
        type: 'project_created',
        message: 'Project linked to the customer account.',
        createdAt: serverTimestamp(),
      });
      await batch.commit();
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
    const progressPercent = String(formData.get('progressPercent') || '').trim();
    const estimatedDays = String(formData.get('estimatedDeliveryDays') || '').trim();
    const workStatus = String(formData.get('workStatus'));
    const startDate = String(formData.get('startDate') || '').trim();
    const plannedEnd = String(formData.get('expectedCompletionDate') || '').trim();
    if (startDate && plannedEnd && plannedEnd < startDate) {
      showStatus(updateStatus, 'Expected completion must be on or after the project start date.', true);
      button.disabled = false;
      return;
    }
    const newInstallments = [1, 2, 3]
      .map((number) => ({
        installment: number,
        amount: String(formData.get(`installment${number}`) || '').trim(),
      }))
      .filter((installment) => installment.amount !== '');
    const invalidInstallment = newInstallments.find((installment) => {
      const amount = Number(installment.amount);
      return !Number.isFinite(amount) || amount <= 0;
    });
    if (invalidInstallment) {
      showStatus(updateStatus, 'Each installment amount must be greater than zero.', true);
      button.disabled = false;
      return;
    }

    try {
      const projectRef = doc(db, 'projects', projectId);
      const progressUpdateRef = progressNote
        ? doc(collection(db, 'projects', projectId, 'updates'))
        : null;
      const saved = await runTransaction(db, async (transaction) => {
        const projectSnapshot = await transaction.get(projectRef);
        const paymentSnapshots = await Promise.all(newInstallments.map((payment) =>
          transaction.get(doc(db, 'projects', projectId, 'payments', `installment-${payment.installment}`)),
        ));
        if (!projectSnapshot.exists()) throw new Error('Project no longer exists.');
        if (paymentSnapshots.some((payment) => payment.exists())) return false;

        const currentProject = projectSnapshot.data();
        const additionalPaid = newInstallments.reduce((total, payment) => total + Number(payment.amount), 0);
        const paidToDate = (Number(currentProject.amountPaid) || 0) + additionalPaid;
        const parsedContract = contractAmount ? Number(contractAmount) : null;
        let paymentStatus = String(formData.get('paymentStatus'));
        if (additionalPaid && parsedContract > 0) {
          paymentStatus = paidToDate >= parsedContract ? 'Paid' : 'Partially paid';
        }
        const update = {
          projectName: String(formData.get('projectName')).trim(),
          siteAddress: String(formData.get('siteAddress')).trim(),
          ...readProjectMaster(formData),
          workStatus,
          actualCompletionDate: workStatus === 'Completed'
            ? (String(formData.get('actualCompletionDate') || '').trim() || new Date().toISOString().slice(0, 10))
            : (String(formData.get('actualCompletionDate') || '').trim() || null),
          paymentStatus,
          contractAmount: contractAmount ? Number(contractAmount) : null,
          progressPercent: workStatus === 'Completed'
            ? 100
            : progressPercent ? Number(progressPercent) : Number(currentProject.progressPercent) || 0,
          estimatedDeliveryDays: estimatedDays ? Number(estimatedDays) : null,
          currency: 'INR',
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.uid || '',
        };
        if (additionalPaid) update.amountPaid = paidToDate;
        const trackedFields = [
          ['Project name', currentProject.projectName, update.projectName],
          ['Site address', currentProject.siteAddress, update.siteAddress],
          ['Work status', currentProject.workStatus, update.workStatus],
          ['Payment status', currentProject.paymentStatus, update.paymentStatus],
          ['Contract amount', currentProject.contractAmount, update.contractAmount],
          ['Progress', currentProject.progressPercent, update.progressPercent],
          ['Estimated handover days', currentProject.estimatedDeliveryDays, update.estimatedDeliveryDays],
          ['Expected completion', currentProject.expectedCompletionDate, update.expectedCompletionDate],
          ['Budget', currentProject.budget, update.budget],
        ];
        const changes = trackedFields
          .filter(([, previous, next]) => !Object.is(previous ?? null, next ?? null))
          .map(([label, previous, next]) => `${label}: ${previous ?? 'Not set'} → ${next ?? 'Not set'}`);
        transaction.update(projectRef, update);
        if (changes.length) {
          transaction.set(doc(collection(db, 'projects', projectId, 'activity')), {
            type: 'project_changed',
            message: changes.join('; '),
            createdAt: serverTimestamp(),
          });
        }
        if (progressUpdateRef) {
          transaction.set(progressUpdateRef, {
            message: progressNote,
            media: [],
            createdAt: serverTimestamp(),
          });
        }
        for (const payment of newInstallments) {
          transaction.set(doc(db, 'projects', projectId, 'payments', `installment-${payment.installment}`), {
            installment: payment.installment,
            amount: Number(payment.amount),
            paidAt: serverTimestamp(),
          });
        }
        return true;
      });
      if (!saved) {
        showStatus(updateStatus, 'An installment was already recorded. Refresh the project and try again.', true);
        return;
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
    stopClients?.();
    stopLeads?.();
    stopAttendance?.();
    stopAttendanceBook?.();
    stopEmployeePayouts?.();
    stopEmployees?.();
    stopProjects = undefined;
    stopClients = undefined;
    stopLeads = undefined;
    stopAttendance = undefined;
    stopAttendanceBook = undefined;
    stopEmployeePayouts = undefined;
    stopEmployees = undefined;
    isAdmin = false;
    if (employeeLedgerDialog.open) employeeLedgerDialog.close();
    resetAttendanceEditor();
    resetEmployeeEditor();
    showDashboardSections();
    if (!user) {
      projects = new Map();
      clients = new Map();
      leads = [];
      attendanceRecords = [];
      monthlyAttendanceRecords = [];
      employeePayoutRecords = [];
      employeeRecords = [];
      updateMetrics();
      renderAttendance();
      renderAttendanceBook();
      renderEmployeeDirectory();
      renderEmployeePayroll();
      leadList.replaceChildren();
      refreshClientPicker();
      loginView.hidden = false;
      dashboard.hidden = true;
      return;
    }

    try {
      const isAuthorizedAdmin = await verifyAdminAccess(user);
      if (!isAuthorizedAdmin) {
        showStatus(loginStatus, 'This account does not have administrator access.', true);
        await signOut(auth);
        return;
      }
      isAdmin = true;
      loginView.hidden = true;
      dashboard.hidden = false;
      document.querySelector('#admin-email-label').textContent = user.email || '';
      watchProjects();
      watchClients();
      watchLeads();
      watchAttendance();
      watchAttendanceBook();
      watchEmployeePayouts();
      watchEmployees();
    } catch (error) {
      console.error('Unable to verify admin role:', error);
      showStatus(loginStatus, 'Unable to verify administrator access. Sign in again.', true);
      await signOut(auth);
    }
  });
}
