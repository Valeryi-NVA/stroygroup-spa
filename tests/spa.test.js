import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, normalizePhone, ymd } from '../js/utils.js';
import { DB, migrate, replaceDB, seed } from '../js/storage.js';

test('FNV-1a password hash matches reference values', function() {
  assert.equal(hashPassword('admin'), '34c83614');
  assert.equal(hashPassword('1234'), 'fdc422fd');
  assert.equal(hashPassword('Пароль'), 'cd85a7c7');
  assert.equal(hashPassword(''), '811c9dc5');
});

test('phone normalization accepts Russian local input', function() {
  assert.equal(normalizePhone('8 (900) 123-45-67'), '+79001234567');
  assert.equal(normalizePhone('+7 900 123-45-67'), '+79001234567');
  assert.equal(normalizePhone('bad input'), '');
});

test('date formatting does not depend on String.padStart', function() {
  assert.equal(ymd(new Date(2025, 0, 9)), '2025-01-09');
});

test('migrate repairs broken storage shapes and inserts admin once', function() {
  var migrated = migrate({ users: 'bad', objects: null, settings: null, session: 42 });
  assert.equal(Array.isArray(migrated.users), true);
  assert.equal(Array.isArray(migrated.objects), true);
  assert.equal(migrated.users.length, 1);
  assert.equal(migrated.users[0].role, 'admin');
  assert.equal(migrated.session, null);
  assert.equal(migrate(migrated).users.length, 1);
});

test('seed contains all required application collections and roles', function() {
  var data = seed();
  ['users', 'employees', 'objects', 'timesheet', 'trips', 'vehicles', 'works', 'output', 'costs', 'payments'].forEach(function(key) {
    assert.equal(Array.isArray(data[key]), true, key);
  });
  assert.equal(data.users[0].phone, '+79000000000');
  assert.equal(data.users[0].role, 'admin');
});

test('database restore preserves existing record references and rolls back edits', function() {
  var employee = DB.employees[0];
  var originalName = employee.name;
  var snapshot = JSON.parse(JSON.stringify(DB));
  employee.name = 'Unsaved change';

  replaceDB(snapshot);

  assert.equal(DB.employees[0], employee);
  assert.equal(employee.name, originalName);
});
