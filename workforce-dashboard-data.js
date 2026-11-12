function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function compareText(left, right) {
  return String(left || '').localeCompare(String(right || ''), undefined, { sensitivity: 'base' });
}

export function sortAttendanceBySection(records = []) {
  return [...records].sort((left, right) =>
    compareText(left.section, right.section) || compareText(left.employeeName, right.employeeName),
  );
}

export function summarizeAttendance(records = [], employees = []) {
  const attendance = Array.isArray(records) ? records : [];
  const present = attendance.filter((record) => String(record.status || '').trim().toLowerCase() === 'present');
  const explicitlyAbsent = attendance.filter((record) => String(record.status || '').trim().toLowerCase() === 'absent');
  const leaveRecords = sortAttendanceBySection(
    attendance.filter((record) => String(record.status || '').trim().toLowerCase() === 'leave'),
  );
  const recordedEmployeeNames = new Set(attendance
    .map((record) => String(record.employeeName || '').trim().toLocaleLowerCase())
    .filter(Boolean));
  const unrecordedEmployees = (Array.isArray(employees) ? employees : [])
    .filter((employee) => {
      const name = String(employee.employeeName || '').trim().toLocaleLowerCase();
      return name && !recordedEmployeeNames.has(name);
    });
  const locations = new Map();

  for (const record of present) {
    const location = String(record.location || '').trim() || 'Location not set';
    locations.set(location, (locations.get(location) || 0) + 1);
  }

  return {
    workingCount: present.length,
    absentCount: explicitlyAbsent.length + unrecordedEmployees.length,
    leaveCount: leaveRecords.length,
    dailySalarySpend: present.reduce((sum, record) => sum + toNumber(record.dailyWage), 0),
    locations: [...locations.entries()]
      .map(([location, count]) => ({ location, count }))
      .sort((left, right) => compareText(left.location, right.location)),
    leaveRecords,
  };
}

export function buildMonthlyAttendanceBook(records = [], yearMonth = '') {
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  if (!monthMatch) return { daysInMonth: 0, rows: [] };

  const year = Number(monthMatch[1]);
  const month = Number(monthMatch[2]);
  if (month < 1 || month > 12) return { daysInMonth: 0, rows: [] };
  const daysInMonth = new Date(year, month, 0).getDate();
  const employees = new Map();

  for (const record of Array.isArray(records) ? records : []) {
    const employeeName = String(record.employeeName || '').trim();
    const workDate = String(record.workDate || '');
    const status = String(record.status || '').trim().toLowerCase();
    if (!employeeName || !workDate.startsWith(`${yearMonth}-`) || !['present', 'absent', 'leave'].includes(status)) continue;

    const day = Number(workDate.slice(-2));
    if (!Number.isInteger(day) || day < 1 || day > daysInMonth) continue;

    const employeeKey = employeeName.toLowerCase();
    const employee = employees.get(employeeKey) || {
      employeeName,
      section: String(record.section || '').trim() || 'Unassigned section',
      days: Array(daysInMonth).fill(null),
      presentDays: 0,
      absentDays: 0,
      leaveDays: 0,
      salarySpend: 0,
      latestWorkDate: '',
      latestTimestamp: -1,
      dailyRecords: Array(daysInMonth).fill(null),
    };
    const recordedAt = Math.max(record.recordedAt?.toMillis?.() || 0, record.updatedAt?.toMillis?.() || 0);
    const existingDayRecord = employee.dailyRecords[day - 1];
    if (!existingDayRecord || recordedAt >= existingDayRecord.recordedAt) {
      employee.dailyRecords[day - 1] = {
        status,
        dailyWage: toNumber(record.dailyWage),
        section: String(record.section || '').trim() || 'Unassigned section',
        recordedAt,
      };
    }

    if (workDate > employee.latestWorkDate || (workDate === employee.latestWorkDate && recordedAt >= employee.latestTimestamp)) {
      employee.latestWorkDate = workDate;
      employee.latestTimestamp = recordedAt;
      employee.section = String(record.section || '').trim() || 'Unassigned section';
    }
    employees.set(employeeKey, employee);
  }

  const rows = [...employees.values()].map((employee) => {
    for (const [index, dailyRecord] of employee.dailyRecords.entries()) {
      if (!dailyRecord) continue;
      if (dailyRecord.status === 'present') {
        employee.days[index] = 'P';
        employee.presentDays += 1;
        employee.salarySpend += dailyRecord.dailyWage;
      } else if (dailyRecord.status === 'absent') {
        employee.days[index] = 'A';
        employee.absentDays += 1;
      } else {
        employee.days[index] = 'L';
        employee.leaveDays += 1;
      }
    }

    const earningEntries = employee.dailyRecords.flatMap((dailyRecord, index) =>
      dailyRecord?.status === 'present'
        ? [{
          workDate: `${yearMonth}-${String(index + 1).padStart(2, '0')}`,
          dailyWage: dailyRecord.dailyWage,
          section: dailyRecord.section,
        }]
        : [],
    );
    const { dailyRecords, latestWorkDate, latestTimestamp, ...row } = employee;
    return { ...row, earningEntries };
  });

  return { daysInMonth, rows: sortAttendanceBySection(rows) };
}

export function summarizeEmployeePayroll(attendanceRows = [], payoutRecords = []) {
  const employees = new Map();
  for (const employee of Array.isArray(attendanceRows) ? attendanceRows : []) {
    const employeeName = String(employee.employeeName || '').trim();
    if (!employeeName) continue;
    employees.set(employeeName.toLowerCase(), {
      employeeName,
      section: employee.section || 'Unassigned section',
      earnings: toNumber(employee.salarySpend),
      payouts: 0,
    });
  }

  for (const payout of Array.isArray(payoutRecords) ? payoutRecords : []) {
    const employeeName = String(payout.employeeName || '').trim();
    if (!employeeName) continue;
    const key = employeeName.toLowerCase();
    const employee = employees.get(key) || {
      employeeName,
      section: 'Unassigned section',
      earnings: 0,
      payouts: 0,
    };
    employee.payouts += toNumber(payout.amount);
    employees.set(key, employee);
  }

  return [...employees.values()]
    .map((employee) => ({
      ...employee,
      balance: employee.earnings - employee.payouts,
    }))
    .sort((left, right) => compareText(left.section, right.section) || compareText(left.employeeName, right.employeeName));
}

export function buildEmployeeLedger(attendanceRows = [], payoutRecords = [], employeeName = '') {
  const employeeKey = String(employeeName || '').trim().toLowerCase();
  if (!employeeKey) return [];

  const employee = (Array.isArray(attendanceRows) ? attendanceRows : [])
    .find((record) => String(record.employeeName || '').trim().toLowerCase() === employeeKey);
  const transactions = (employee?.earningEntries || []).map((earning) => ({
    workDate: earning.workDate,
    paidAt: null,
    description: `Daily wages - ${earning.section || employee.section || 'Unassigned section'}`,
    credit: toNumber(earning.dailyWage),
    debit: 0,
    sortTime: Date.parse(`${earning.workDate}T00:00:00Z`),
  }));

  for (const payout of Array.isArray(payoutRecords) ? payoutRecords : []) {
    if (String(payout.employeeName || '').trim().toLowerCase() !== employeeKey) continue;
    const timestamp = payout.paidAt?.toMillis?.();
    const hasTimestamp = Number.isFinite(timestamp);
    transactions.push({
      workDate: '',
      paidAt: hasTimestamp ? new Date(timestamp) : null,
      description: `Payout - ${String(payout.paymentMode || 'Other')}`,
      credit: 0,
      debit: toNumber(payout.amount),
      sortTime: hasTimestamp ? timestamp : Number.MAX_SAFE_INTEGER,
    });
  }

  transactions.sort((left, right) => left.sortTime - right.sortTime);
  let balance = 0;
  return transactions.map(({ sortTime, ...transaction }) => {
    balance += transaction.credit - transaction.debit;
    return { ...transaction, balance };
  });
}
