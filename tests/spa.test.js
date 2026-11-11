import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, ymd } from '../js/utils.js';
import { DB, migrate, replaceDB, seed } from '../js/storage.js';

test('phone normalization accepts Russian local input', function() {
  assert.equal(normalizePhone('8 (900) 123-45-67'), '+79001234567');
  assert.equal(normalizePhone('+7 900 123-45-67'), '+79001234567');
  assert.equal(normalizePhone('bad input'), '');
});

test('date formatting does not depend on String.padStart', function() {
  assert.equal(ymd(new Date(2025, 0, 9)), '2025-01-09');
});

test('migrate repairs broken server state without creating demo credentials', function() {
  var migrated = migrate({ users: 'bad', objects: null, settings: null, session: 42 });
  assert.equal(Array.isArray(migrated.users), true);
  assert.equal(Array.isArray(migrated.objects), true);
  assert.equal(migrated.users.length, 0);
  assert.equal(migrated.session, null);
  assert.equal(migrate(migrated).users.length, 0);
});

test('new workspaces start empty and have no browser-managed users', function() {
  var data = seed();
  ['users', 'employees', 'objects', 'timesheet', 'trips', 'vehicles', 'works', 'output', 'costs', 'payments'].forEach(function(key) {
    assert.equal(Array.isArray(data[key]), true, key);
  });
  assert.equal(data.users.length, 0);
});

test('database restore preserves existing record references and rolls back edits', function() {
  DB.employees.push({ id: 'employee-test', name: 'Initial' });
  var employee = DB.employees[0];
  var snapshot = JSON.parse(JSON.stringify(DB));
  employee.name = 'Unsaved change';

  replaceDB(snapshot);

  assert.equal(DB.employees[0], employee);
  assert.equal(employee.name, 'Initial');
});
