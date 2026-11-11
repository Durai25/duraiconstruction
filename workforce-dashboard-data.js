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

export function summarizeAttendance(records = []) {
  const attendance = Array.isArray(records) ? records : [];
  const present = attendance.filter((record) => String(record.status || '').trim().toLowerCase() === 'present');
  const leaveRecords = sortAttendanceBySection(
    attendance.filter((record) => String(record.status || '').trim().toLowerCase() === 'leave'),
  );
  const locations = new Map();

  for (const record of present) {
    const location = String(record.location || '').trim() || 'Location not set';
    locations.set(location, (locations.get(location) || 0) + 1);
  }

  return {
    workingCount: present.length,
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
    if (!employeeName || !workDate.startsWith(`${yearMonth}-`) || !['present', 'leave'].includes(status)) continue;

    const day = Number(workDate.slice(-2));
    if (!Number.isInteger(day) || day < 1 || day > daysInMonth) continue;

    const employeeKey = employeeName.toLowerCase();
    const employee = employees.get(employeeKey) || {
      employeeName,
      section: String(record.section || '').trim() || 'Unassigned section',
      days: Array(daysInMonth).fill(null),
      presentDays: 0,
      leaveDays: 0,
      salarySpend: 0,
      latestWorkDate: '',
      latestTimestamp: -1,
      dailyRecords: Array(daysInMonth).fill(null),
    };
    const recordedAt = record.recordedAt?.toMillis?.() || 0;
    const existingDayRecord = employee.dailyRecords[day - 1];
    if (!existingDayRecord || recordedAt >= existingDayRecord.recordedAt) {
      employee.dailyRecords[day - 1] = {
        status,
        dailyWage: toNumber(record.dailyWage),
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
      employee.days[index] = dailyRecord.status === 'present' ? 'P' : 'L';
      if (dailyRecord.status === 'present') {
        employee.presentDays += 1;
        employee.salarySpend += dailyRecord.dailyWage;
      } else {
        employee.leaveDays += 1;
      }
    }

    const { dailyRecords, latestWorkDate, latestTimestamp, ...row } = employee;
    return row;
  });

  return { daysInMonth, rows: sortAttendanceBySection(rows) };
}
