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
  serverTimestamp,
  updateDoc,
  where,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  ref,
  uploadBytesResumable,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { auth, db, firebaseReady, storage } from './firebase-client.js';
import { isAdminRecord } from './admin-role.js';
import { getCustomerRows, getStatusBreakdown, summarizeAdminWorkspace } from './admin-dashboard-data.js';
import {
  buildMonthlyAttendanceBook,
  sortAttendanceBySection,
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
const uploadStatus = document.querySelector('#upload-status');
const progress = document.querySelector('#upload-progress');
const leadList = document.querySelector('#lead-list');
const leadSearch = document.querySelector('#lead-search');
const leadStatusFilter = document.querySelector('#lead-status-filter');
const sectionNavigation = document.querySelector('.admin-section-nav');
const sectionDetails = document.querySelector('#admin-section-details');
const sectionTitle = document.querySelector('#admin-section-title');
const sectionTiles = document.querySelectorAll('.admin-section-card');
const attendanceDate = document.querySelector('#attendance-date');
const attendanceBookMonth = document.querySelector('#attendance-book-month');
const attendanceBookCount = document.querySelector('#attendance-book-count');
const attendanceBookHeader = document.querySelector('#attendance-book-header');
const attendanceBookList = document.querySelector('#attendance-book-list');
const attendanceBookTotals = document.querySelector('#attendance-book-totals');
const attendanceForm = document.querySelector('#attendance-form');
const attendanceRecordList = document.querySelector('#attendance-record-list');
const leadStatuses = ['New', 'Contacted', 'Qualified', 'Won', 'Closed'];
let projects = new Map();
let leads = [];
let attendanceRecords = [];
let monthlyAttendanceRecords = [];
let stopProjects;
let stopLeads;
let stopAttendance;
let stopAttendanceBook;
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
  activeSectionTile = tile;
  sectionTitle.textContent = tile.querySelector('strong').textContent;
  sectionNavigation.hidden = true;
  sectionDetails.hidden = false;
  sectionDetails.scrollIntoView({ behavior: 'smooth', block: 'start' });
  sectionTitle.focus({ preventScroll: true });
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
  const summary = summarizeAdminWorkspace(projectValues, leads);
  document.querySelector('#metric-projects').textContent = String(projectValues.length);
  document.querySelector('#metric-active').textContent = String(summary.activeProjects);
  document.querySelector('#metric-completed').textContent = String(summary.completedProjects);
  document.querySelector('#metric-leads').textContent = String(summary.leadCount);

  renderBusinessSummary(summary);
}

function renderAttendance() {
  const summary = summarizeAttendance(attendanceRecords);
  const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });
  document.querySelector('#attendance-working-count').textContent = String(summary.workingCount);
  document.querySelector('#attendance-leave-count').textContent = String(summary.leaveCount);
  document.querySelector('#attendance-salary-spend').textContent = currencyFormatter.format(summary.dailySalarySpend);
  document.querySelector('#attendance-nav-summary').textContent = `${summary.workingCount} working · ${summary.leaveCount} on leave`;

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
  const sortedRecords = sortAttendanceBySection(attendanceRecords);
  if (!sortedRecords.length) {
    const row = document.createElement('tr');
    const empty = document.createElement('td');
    empty.colSpan = 6;
    empty.textContent = 'No attendance recorded for this date.';
    row.append(empty);
    attendanceRecordList.append(row);
    return;
  }

  let currentSection;
  for (const record of sortedRecords) {
    if (record.section !== currentSection) {
      currentSection = record.section;
      const sectionRow = document.createElement('tr');
      sectionRow.className = 'attendance-section-row';
      const sectionHeading = document.createElement('th');
      sectionHeading.colSpan = 6;
      sectionHeading.scope = 'rowgroup';
      sectionHeading.textContent = record.section || 'Unassigned section';
      sectionRow.append(sectionHeading);
      attendanceRecordList.append(sectionRow);
    }

    const row = document.createElement('tr');
    for (const value of [
      record.employeeName,
      record.section,
      record.location,
      record.status,
      currencyFormatter.format(Number(record.dailyWage) || 0),
    ]) {
      const cell = document.createElement('td');
      cell.textContent = value || '—';
      row.append(cell);
    }

    const actionCell = document.createElement('td');
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'button button-outline-dark attendance-remove-button';
    removeButton.textContent = 'Remove';
    removeButton.setAttribute('aria-label', `Remove attendance for ${record.employeeName || 'employee'}`);
    removeButton.addEventListener('click', async () => {
      if (!isAdmin || !window.confirm(`Remove attendance for ${record.employeeName || 'this employee'}?`)) return;
      removeButton.disabled = true;
      try {
        await deleteDoc(doc(db, 'employeeAttendance', record.id));
      } catch (error) {
        console.error('Unable to remove attendance record:', error);
        showStatus(globalStatus, 'Attendance record could not be removed. Check Firestore rules and try again.', true);
        removeButton.disabled = false;
      }
    });
    actionCell.append(removeButton);
    row.append(actionCell);
    attendanceRecordList.append(row);
  }
}

function renderAttendanceBook() {
  const monthValue = attendanceBookMonth.value;
  const { daysInMonth, rows } = buildMonthlyAttendanceBook(monthlyAttendanceRecords, monthValue);
  const columnCount = daysInMonth + 4;
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
  for (const label of ['Present', 'Leave', 'Wages']) {
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
        cell.classList.add(mark === 'P' ? 'attendance-mark-present' : 'attendance-mark-leave');
        cell.title = mark === 'P' ? 'Present' : 'Leave';
      }
      row.append(cell);
    }
    for (const value of [
      String(employee.presentDays),
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
  const totalPresentDays = rows.reduce((total, employee) => total + employee.presentDays, 0);
  const totalLeaveDays = rows.reduce((total, employee) => total + employee.leaveDays, 0);
  const totalWages = rows.reduce((total, employee) => total + employee.salarySpend, 0);

  for (const [label, dailyTotals, presentTotal, leaveTotal, wageTotal] of [
    ['Present totals', dailyPresentTotals, String(totalPresentDays), '', currencyFormatter.format(totalWages)],
    ['Leave totals', dailyLeaveTotals, '', String(totalLeaveDays), ''],
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
    for (const value of [presentTotal, leaveTotal, wageTotal]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    attendanceBookTotals.append(row);
  }
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
    },
    (error) => {
      console.error('Unable to load monthly employee attendance:', error);
      monthlyAttendanceRecords = [];
      renderAttendanceBook();
      attendanceBookCount.textContent = 'Attendance book could not be loaded.';
      showStatus(globalStatus, 'The monthly attendance book is unavailable. Check Firestore rules and try again.', true);
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
    { label: 'Avg. progress', value: `${summary.averageProgress.toFixed(1)}%` },
  ];

  const financeCards = [
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
  for (const tile of sectionTiles) {
    tile.setAttribute('aria-expanded', 'false');
    tile.addEventListener('click', () => showDashboardSection(tile));
  }
  document.querySelector('#admin-section-back').addEventListener('click', () => showDashboardSections(true));
  projectPicker.addEventListener('change', () => selectProject(projectPicker.value));
  leadSearch.addEventListener('input', renderLeads);
  leadStatusFilter.addEventListener('change', renderLeads);
  attendanceDate.value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  attendanceBookMonth.value = attendanceDate.value.slice(0, 7);
  attendanceDate.addEventListener('change', watchAttendance);
  attendanceBookMonth.addEventListener('change', watchAttendanceBook);
  clearProjectForms();

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
      || !['Present', 'Leave'].includes(status)
    ) {
      showStatus(document.querySelector('#attendance-status-message'), 'Enter an employee, work section, location, and valid daily wage.', true);
      return;
    }

    button.disabled = true;
    showStatus(document.querySelector('#attendance-status-message'), 'Saving attendance...');
    try {
      await addDoc(collection(db, 'employeeAttendance'), {
        employeeName,
        section,
        location,
        status,
        dailyWage,
        workDate: attendanceDate.value,
        recordedAt: serverTimestamp(),
      });
      attendanceForm.reset();
      showStatus(document.querySelector('#attendance-status-message'), 'Attendance recorded.');
    } catch (error) {
      console.error('Unable to record employee attendance:', error);
      showStatus(document.querySelector('#attendance-status-message'), 'Attendance could not be saved. Check Firestore rules and try again.', true);
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
    stopAttendance?.();
    stopAttendanceBook?.();
    stopProjects = undefined;
    stopLeads = undefined;
    stopAttendance = undefined;
    stopAttendanceBook = undefined;
    isAdmin = false;
    showDashboardSections();
    if (!user) {
      projects = new Map();
      leads = [];
      attendanceRecords = [];
      monthlyAttendanceRecords = [];
      updateMetrics();
      renderAttendance();
      renderAttendanceBook();
      leadList.replaceChildren();
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
      watchLeads();
      watchAttendance();
      watchAttendanceBook();
    } catch (error) {
      console.error('Unable to verify admin role:', error);
      showStatus(loginStatus, 'Unable to verify administrator access. Sign in again.', true);
      await signOut(auth);
    }
  });
}
