import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, ymd } from '../js/utils.js';
import { DB, migrate, replaceDB, seed } from '../js/storage.js';
import { calcSalary } from '../js/business.js';

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

test('migration maps the previous daily rate to the employee work area', function() {
  var migrated = migrate({
    employees: [
      { id: 'shop', role: 'Цех', rate: 2500 },
      { id: 'installer', role: 'Монтажник', rate: 4000 }
    ]
  });
  assert.equal(migrated.employees[0].workshopRate, 2500);
  assert.equal(migrated.employees[0].installRate, 0);
  assert.equal(migrated.employees[1].workshopRate, 0);
  assert.equal(migrated.employees[1].installRate, 4000);
  assert.equal(Object.prototype.hasOwnProperty.call(migrated.employees[0], 'rate'), false);
});

test('daily payroll applies the workshop and installation rates separately', function() {
  var snapshot = JSON.parse(JSON.stringify(DB));
  try {
    DB.employees.push(
      { id: 'shop-rate', name: 'Сотрудник цеха', role: 'Цех', payType: 'day', workshopRate: 2500, installRate: 7000 },
      { id: 'install-rate', name: 'Монтажник', role: 'Монтажник', payType: 'day', workshopRate: 2500, installRate: 4000 }
    );
    DB.timesheet.push({ id: 'shop-day', empId: 'shop-rate', date: '2025-01-15', days: 2 });
    DB.trips.push({ id: 'install-day', seniorId: 'install-rate', crew: [], date: '2025-01-15' });

    var payroll = calcSalary('2025-01-01', '2025-01-31');
    assert.equal(payroll.find(function(row) { return row.emp.id === 'shop-rate'; }).base, 5000);
    assert.equal(payroll.find(function(row) { return row.emp.id === 'install-rate'; }).base, 4000);
  } finally {
    replaceDB(snapshot);
  }
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
