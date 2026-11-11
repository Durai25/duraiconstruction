import test from 'node:test';
import assert from 'node:assert/strict';

import { isAdminRecord } from '../admin-role.js';

test('administrator role record is recognized as admin', () => {
  assert.equal(isAdminRecord({ role: 'administrator' }), true);
  assert.equal(isAdminRecord({ role: 'Administrator' }), true);
  assert.equal(isAdminRecord({ admin: true }), true);
});

test('non-admin record is rejected', () => {
  assert.equal(isAdminRecord({ role: 'customer' }), false);
  assert.equal(isAdminRecord({ role: 'staff' }), false);
  assert.equal(isAdminRecord({}), false);
});
