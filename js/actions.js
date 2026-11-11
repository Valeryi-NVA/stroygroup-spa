import { DB, replaceDB, save, seed } from './storage.js';
import { findById } from './business.js';
import { getCurrentUser } from './auth.js';
import { renderApp } from './router.js?v=mobile-drawer-20261111';
import { formCost, formEmployee, formObject, formOutput, formPayment, formTimesheet, formTrip, formUser, formVehicle, formWork } from './forms.js';
import { showMessage } from './ui.js';

function removeRecord(collection, id, message) {
  var snapshot;
  var index;
  if (!window.confirm(message)) return;
  snapshot = JSON.stringify(DB);
  for (index = collection.length - 1; index >= 0; index -= 1) if (collection[index].id === id) collection.splice(index, 1);
  if (save()) renderApp();
  else replaceDB(JSON.parse(snapshot));
}

/** Handle CRUD operations for the local demo application. */
export var ACTIONS = {
  reset: function() {
    var users;
    var session;
    if (!window.confirm('Удалить все данные рабочей области компании? Это действие нельзя отменить.')) return;
    users = DB.users.slice();
    session = DB.session;
    replaceDB(seed());
    DB.users = users;
    DB.session = session;
    if (save()) renderApp();
  },
  'obj-add': function() { formObject(null); },
  'obj-edit': function(data) { formObject(findById(DB.objects, data.id)); },
  'obj-del': function(data) { removeRecord(DB.objects, data.id, 'Удалить объект?'); },
  'emp-add': function() { formEmployee(null); },
  'emp-edit': function(data) { formEmployee(findById(DB.employees, data.id)); },
  'emp-del': function(data) { removeRecord(DB.employees, data.id, 'Удалить сотрудника?'); },
  'ts-add': function() { formTimesheet(null); },
  'ts-edit': function(data) { formTimesheet(findById(DB.timesheet, data.id)); },
  'ts-del': function(data) { removeRecord(DB.timesheet, data.id, 'Удалить отметку табеля?'); },
  'trip-add': function() { formTrip(null); },
  'trip-edit': function(data) { formTrip(findById(DB.trips, data.id)); },
  'trip-del': function(data) { removeRecord(DB.trips, data.id, 'Удалить выезд?'); },
  'work-add': function() { formWork(null); },
  'work-edit': function(data) { formWork(findById(DB.works, data.id)); },
  'work-del': function(data) { removeRecord(DB.works, data.id, 'Удалить расценку?'); },
  'out-add': function() { formOutput(null); },
  'out-edit': function(data) { formOutput(findById(DB.output, data.id)); },
  'out-del': function(data) { removeRecord(DB.output, data.id, 'Удалить запись выработки?'); },
  'veh-add': function() { formVehicle(null); },
  'veh-edit': function(data) { formVehicle(findById(DB.vehicles, data.id)); },
  'veh-del': function(data) { removeRecord(DB.vehicles, data.id, 'Удалить машину?'); },
  'cost-add': function(data) { formCost(null, data.obj); },
  'cost-del': function(data) { removeRecord(DB.costs, data.id, 'Удалить расход?'); },
  'pay-add': function(data) { formPayment(null, data.obj); },
  'pay-del': function(data) { removeRecord(DB.payments, data.id, 'Удалить поступление?'); },
  'user-del': function(data) {
    var me = getCurrentUser();
    var target = findById(DB.users, data.id);
    var adminCount = 0;
    var index;
    if (!me || me.role !== 'admin' || !target) return;
    if (target.id === me.id) { showMessage('Нельзя удалить собственную запись.'); return; }
    for (index = 0; index < DB.users.length; index += 1) if (DB.users[index].role === 'admin') adminCount += 1;
    if (target.role === 'admin' && adminCount <= 1) { showMessage('Нельзя удалить последнего администратора.'); return; }
    removeRecord(DB.users, target.id, 'Удалить пользователя «' + target.name + '»?');
  },
  'user-add': function() { formUser(); },
  'user-role': function(data) {
    var me = getCurrentUser();
    var target = findById(DB.users, data.id);
    var count = 0;
    var snapshot;
    var index;
    var allowed = ['admin', 'manager', 'foreman', 'accountant', 'designer', 'installer', 'worker'];
    if (!me || me.role !== 'admin' || !target) return;
    if (target.id === me.id) { renderApp(); showMessage('Нельзя менять собственную роль.'); return; }
    if (allowed.indexOf(data.role) === -1) { renderApp(); return; }
    for (index = 0; index < DB.users.length; index += 1) if (DB.users[index].role === 'admin') count += 1;
    if (target.role === 'admin' && data.role !== 'admin' && count <= 1) {
      renderApp();
      showMessage('Нельзя снять роль с последнего администратора.');
      return;
    }
    snapshot = JSON.stringify(DB);
    target.role = data.role;
    if (save()) renderApp();
    else {
      replaceDB(JSON.parse(snapshot));
      renderApp();
    }
  }
};
