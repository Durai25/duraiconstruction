import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEmployeeLedger,
  buildMonthlyAttendanceBook,
  sortAttendanceBySection,
  summarizeEmployeePayroll,
  summarizeAttendance,
} from '../workforce-dashboard-data.js';

test('attendance summary counts present and absent workers, wages, locations, and leave', () => {
  const summary = summarizeAttendance([
    { employeeName: 'Kumar', section: 'Masonry', location: 'North site', status: 'Present', dailyWage: 900 },
    { employeeName: 'Anu', section: 'Finishing', location: 'South site', status: 'Present', dailyWage: 750 },
    { employeeName: 'Ravi', section: 'Masonry', location: 'North site', status: 'Leave', dailyWage: 800 },
    { employeeName: 'Bala', section: 'Masonry', location: 'North site', status: 'Absent', dailyWage: 800 },
  ]);

  assert.equal(summary.workingCount, 2);
  assert.equal(summary.absentCount, 1);
  assert.equal(summary.leaveCount, 1);
  assert.equal(summary.dailySalarySpend, 1650);
  assert.deepEqual(summary.locations, [
    { location: 'North site', count: 1 },
    { location: 'South site', count: 1 },
  ]);
  assert.equal(summary.leaveRecords[0].employeeName, 'Ravi');
});

test('attendance records sort by work section then employee name without changing the source', () => {
  const records = [
    { employeeName: 'Ravi', section: 'Masonry' },
    { employeeName: 'Bala', section: 'Electrical' },
    { employeeName: 'Anu', section: 'Masonry' },
  ];

  assert.deepEqual(
    sortAttendanceBySection(records).map((record) => `${record.section}:${record.employeeName}`),
    ['Electrical:Bala', 'Masonry:Anu', 'Masonry:Ravi'],
  );
  assert.equal(records[0].employeeName, 'Ravi');
});

test('leave and invalid wages do not increase the daily salary spend', () => {
  const summary = summarizeAttendance([
    { status: 'Present', dailyWage: -5, location: '' },
    { status: 'Absent', dailyWage: 1000, location: 'Site' },
    { status: 'Leave', dailyWage: 1000, location: 'Site' },
  ]);

  assert.equal(summary.dailySalarySpend, 0);
  assert.equal(summary.absentCount, 1);
  assert.equal(summary.leaveCount, 1);
  assert.deepEqual(summary.locations, [{ location: 'Location not set', count: 1 }]);
});

test('monthly attendance book shows every employee by day with totals and deduplicates same-day records', () => {
  const timestamp = (value) => ({ toMillis: () => value });
  const book = buildMonthlyAttendanceBook([
    { employeeName: 'Anu', section: 'Finishing', workDate: '2026-03-01', status: 'Present', dailyWage: 500, recordedAt: timestamp(1) },
    { employeeName: 'ANU', section: 'Finishing', workDate: '2026-03-01', status: 'Present', dailyWage: 550, recordedAt: timestamp(2) },
    { employeeName: 'Anu', section: 'Finishing', workDate: '2026-03-10', status: 'Present', dailyWage: 500 },
    { employeeName: 'Anu', section: 'Finishing', workDate: '2026-03-11', status: 'Leave', dailyWage: 500 },
    { employeeName: 'Anu', section: 'Finishing', workDate: '2026-03-12', status: 'Absent', dailyWage: 500 },
    { employeeName: 'Kishor', section: 'Masonry', workDate: '2026-03-31', status: 'Present', dailyWage: 900 },
    { employeeName: 'Ravi', section: 'Masonry', workDate: '2026-04-01', status: 'Present', dailyWage: 1000 },
  ], '2026-03');

  assert.equal(book.daysInMonth, 31);
  assert.deepEqual(book.rows.map(({ employeeName, section }) => `${section}:${employeeName}`), [
    'Finishing:Anu',
    'Masonry:Kishor',
  ]);
  assert.equal(book.rows[0].days[0], 'P');
  assert.equal(book.rows[0].days[9], 'P');
  assert.equal(book.rows[0].days[10], 'L');
  assert.equal(book.rows[0].days[11], 'A');
  assert.equal(book.rows[0].presentDays, 2);
  assert.equal(book.rows[0].absentDays, 1);
  assert.equal(book.rows[0].leaveDays, 1);
  assert.equal(book.rows[0].salarySpend, 1050);
  assert.equal(book.rows[1].days[30], 'P');
});

test('monthly attendance book handles leap-year February and rejects invalid months', () => {
  assert.equal(buildMonthlyAttendanceBook([], '2024-02').daysInMonth, 29);
  assert.deepEqual(buildMonthlyAttendanceBook([], '2024-13'), { daysInMonth: 0, rows: [] });
});

test('employee payroll totals attendance earnings, payouts, and advances', () => {
  const payroll = summarizeEmployeePayroll(
    [
      { employeeName: 'Anu', section: 'Finishing', salarySpend: 1200 },
      { employeeName: 'Kumar', section: 'Masonry', salarySpend: 900 },
    ],
    [
      { employeeName: 'Anu', amount: 500 },
      { employeeName: 'ANU', amount: 300 },
      { employeeName: 'Kumar', amount: 1000 },
    ],
  );

  assert.deepEqual(payroll, [
    { employeeName: 'Anu', section: 'Finishing', earnings: 1200, payouts: 800, balance: 400 },
    { employeeName: 'Kumar', section: 'Masonry', earnings: 900, payouts: 1000, balance: -100 },
  ]);
});

test('employee ledger orders deduplicated wage credits and payouts with a running balance', () => {
  const timestamp = (value) => ({ toMillis: () => value });
  const attendanceRows = buildMonthlyAttendanceBook([
    { employeeName: 'Anu', section: 'Finishing', workDate: '2026-03-01', status: 'Present', dailyWage: 500, recordedAt: timestamp(1) },
    { employeeName: 'ANU', section: 'Finishing', workDate: '2026-03-01', status: 'Present', dailyWage: 550, recordedAt: timestamp(2) },
    { employeeName: 'Anu', section: 'Finishing', workDate: '2026-03-02', status: 'Absent', dailyWage: 500 },
    { employeeName: 'Anu', section: 'Masonry', workDate: '2026-03-03', status: 'Present', dailyWage: 200 },
  ], '2026-03').rows;
  const ledger = buildEmployeeLedger(attendanceRows, [
    { employeeName: 'ANU', amount: 300, paymentMode: 'UPI', paidAt: timestamp(Date.parse('2026-03-02T10:00:00Z')) },
    { employeeName: 'Kumar', amount: 1000, paymentMode: 'Cash', paidAt: timestamp(Date.parse('2026-03-02T11:00:00Z')) },
  ], 'Anu');

  assert.deepEqual(ledger.map(({ description, credit, debit, balance }) => ({ description, credit, debit, balance })), [
    { description: 'Daily wages - Finishing', credit: 550, debit: 0, balance: 550 },
    { description: 'Payout - UPI', credit: 0, debit: 300, balance: 250 },
    { description: 'Daily wages - Masonry', credit: 200, debit: 0, balance: 450 },
  ]);
});
