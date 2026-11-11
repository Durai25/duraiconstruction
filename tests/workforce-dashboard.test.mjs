import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMonthlyAttendanceBook,
  sortAttendanceBySection,
  summarizeAttendance,
} from '../workforce-dashboard-data.js';

test('attendance summary counts present workers and wages, groups locations, and lists leave', () => {
  const summary = summarizeAttendance([
    { employeeName: 'Kumar', section: 'Masonry', location: 'North site', status: 'Present', dailyWage: 900 },
    { employeeName: 'Anu', section: 'Finishing', location: 'South site', status: 'Present', dailyWage: 750 },
    { employeeName: 'Ravi', section: 'Masonry', location: 'North site', status: 'Leave', dailyWage: 800 },
  ]);

  assert.equal(summary.workingCount, 2);
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
    { status: 'Leave', dailyWage: 1000, location: 'Site' },
  ]);

  assert.equal(summary.dailySalarySpend, 0);
  assert.deepEqual(summary.locations, [{ location: 'Location not set', count: 1 }]);
});

test('monthly attendance book shows every employee by day with totals and deduplicates same-day records', () => {
  const timestamp = (value) => ({ toMillis: () => value });
  const book = buildMonthlyAttendanceBook([
    { employeeName: 'Anu', section: 'Finishing', workDate: '2026-03-01', status: 'Present', dailyWage: 500, recordedAt: timestamp(1) },
    { employeeName: 'ANU', section: 'Finishing', workDate: '2026-03-01', status: 'Present', dailyWage: 550, recordedAt: timestamp(2) },
    { employeeName: 'Anu', section: 'Finishing', workDate: '2026-03-10', status: 'Present', dailyWage: 500 },
    { employeeName: 'Anu', section: 'Finishing', workDate: '2026-03-11', status: 'Leave', dailyWage: 500 },
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
  assert.equal(book.rows[0].presentDays, 2);
  assert.equal(book.rows[0].leaveDays, 1);
  assert.equal(book.rows[0].salarySpend, 1050);
  assert.equal(book.rows[1].days[30], 'P');
});

test('monthly attendance book handles leap-year February and rejects invalid months', () => {
  assert.equal(buildMonthlyAttendanceBook([], '2024-02').daysInMonth, 29);
  assert.deepEqual(buildMonthlyAttendanceBook([], '2024-13'), { daysInMonth: 0, rows: [] });
});
