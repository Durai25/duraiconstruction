import test from 'node:test';
import assert from 'node:assert/strict';

import { summarizeAdminWorkspace } from '../admin-dashboard-data.js';

test('admin dashboard summarizes customer and financial data', () => {
  const summary = summarizeAdminWorkspace(
    [
      {
        customerId: 'customer-1',
        projectName: 'Alpha Tower',
        contractAmount: 120000,
        amountPaid: 40000,
        workStatus: 'In Progress',
        progressPercent: 60,
      },
      {
        customerId: 'customer-2',
        projectName: 'Beta Villa',
        contractAmount: 250000,
        amountPaid: 250000,
        workStatus: 'Completed',
        progressPercent: 100,
      },
      {
        customerId: 'customer-1',
        projectName: 'Gamma Plot',
        contractAmount: 90000,
        amountPaid: 0,
        workStatus: 'Planning',
        progressPercent: 10,
      },
    ],
    [
      { leadStatus: 'Won', reply_to: 'a@example.com' },
      { leadStatus: 'Qualified', reply_to: 'b@example.com' },
      { leadStatus: 'New', reply_to: 'c@example.com' },
    ],
  );

  assert.equal(summary.customerCount, 2);
  assert.equal(summary.totalRevenue, 460000);
  assert.equal(summary.totalCollected, 290000);
  assert.equal(summary.outstanding, 170000);
  assert.equal(summary.activeProjects, 1);
  assert.equal(summary.completedProjects, 1);
  assert.equal(summary.wonLeads, 1);
  assert.equal(summary.pipelineLeads, 2);
  assert.equal(summary.averageProgress, 56.67);
});
