import { DB } from './storage.js';
import { calcSalary, costsFor, daysFor, empName, objName, paymentsFor, tripExpense, vehName } from './business.js';
import { fmt, fmtDays, esc, inR } from './utils.js';
import { table } from './ui.js';

function card(title, value, note, color) {
  return '<div class="card"><div class="k">' + esc(title) + '</div><div class="v ' + (color || '') + '">' + value + '</div>' +
    (note ? '<div class="s">' + esc(note) + '</div>' : '') + '</div>';
}

/** Render the general dashboard for management and accounting roles. */
export function renderDashFull() {
  var active = 0;
  var done = 0;
  var contract = 0;
  var paid = 0;
  var expenses = 0;
  var tripCount = DB.trips.length;
  var payroll = calcSalary(DB.settings.from, DB.settings.to);
  var payrollTotal = 0;
  var index;
  for (index = 0; index < DB.objects.length; index += 1) {
    var object = DB.objects[index];
    if (object.status === 'В работе') active += 1;
    if (object.status === 'Завершён') done += 1;
    contract += Number(object.amount) || 0;
    paid += paymentsFor(object.id);
    expenses += costsFor(object.id);
  }
  for (index = 0; index < payroll.length; index += 1) payrollTotal += payroll[index].total;
  var result = '<div class="head"><h2>Обзор</h2></div><div class="cards">' +
    card('Объектов', DB.objects.length) + card('В работе', active) + card('Завершено', done) +
    card('Сумма договоров', fmt(contract), 'Информационный показатель') +
    card('Оплачено', fmt(paid)) + card('Расходы по объектам', fmt(expenses)) +
    card('Разница поступлений и расходов', fmt(paid - expenses), '', paid >= expenses ? 'green' : 'red') +
    card('ФОТ за период', fmt(payrollTotal), DB.settings.from + ' — ' + DB.settings.to) +
    card('Выездов', tripCount) + '</div>';
  result += '<h3>Сводка объектов</h3>' + table([
    { t: 'Объект', f: function(row) { return '<b>' + esc(row.name) + '</b>'; } },
    { t: 'Статус', f: function(row) { return esc(row.status); } },
    { t: 'Оплачено', f: function(row) { return fmt(paymentsFor(row.id)); } },
    { t: 'Расходы', f: function(row) { return fmt(costsFor(row.id)); } },
    { t: 'Разница', f: function(row) { return fmt(paymentsFor(row.id) - costsFor(row.id)); } }
  ], DB.objects);
  var roleRows = {};
  for (index = 0; index < payroll.length; index += 1) {
    var role = payroll[index].emp.role;
    if (!roleRows[role]) roleRows[role] = { role: role, people: 0, total: 0 };
    roleRows[role].people += 1;
    roleRows[role].total += payroll[index].total;
  }
  result += '<h3>ФОТ по ролям (отдельно от расходов объектов)</h3>' + table([
    { t: 'Роль', f: function(row) { return esc(row.role); } },
    { t: 'Сотрудников', f: function(row) { return row.people; } },
    { t: 'Начислено', f: function(row) { return fmt(row.total); } }
  ], Object.keys(roleRows).map(function(key) { return roleRows[key]; }));
  return result;
}

/** Render the installer dashboard without revenue or payroll figures. */
export function renderDashInstaller() {
  var total = 0;
  var vehicles = {};
  var rows = DB.trips.slice().sort(function(left, right) { return String(right.date || '').localeCompare(String(left.date || '')); });
  var index;
  for (index = 0; index < rows.length; index += 1) {
    total += tripExpense(rows[index]);
    if (rows[index].vehicleId) vehicles[rows[index].vehicleId] = true;
  }
  var recent = rows.slice(0, 8);
  return '<div class="head"><h2>Мои выезды</h2></div><div class="cards">' +
    card('Выездов всего', rows.length) + card('Расходы по выездам', fmt(total)) +
    card('Машин задействовано', Object.keys(vehicles).length) + '</div>' +
    table([
      { t: 'Дата', f: function(row) { return esc(row.date); } },
      { t: 'Объект', f: function(row) { return esc(objName(row.objectId)); } },
      { t: 'Старший', f: function(row) { return esc(empName(row.seniorId)); } },
      { t: 'Машина', f: function(row) { return esc(vehName(row.vehicleId)); } },
      { t: 'Расход', f: function(row) { return fmt(tripExpense(row)); } }
    ], recent);
}

/** Render an employee dashboard without project financial information. */
export function renderDashWorker() {
  var user = null;
  var index;
  for (index = 0; index < DB.users.length; index += 1) if (DB.users[index].id === DB.session) user = DB.users[index];
  var employee = null;
  for (index = 0; index < DB.employees.length; index += 1) {
    if (user && (DB.employees[index].phone === user.phone || DB.employees[index].name === user.name)) employee = DB.employees[index];
  }
  var employeeId = employee ? employee.id : '';
  var days = employee ? daysFor(employee, DB.settings.from, DB.settings.to) : 0;
  var outputs = DB.output.filter(function(row) { return row.empId === employeeId && inR(row.date, DB.settings.from, DB.settings.to); });
  var pieceAmount = 0;
  for (index = 0; index < outputs.length; index += 1) {
    var work = null;
    for (var workIndex = 0; workIndex < DB.works.length; workIndex += 1) if (DB.works[workIndex].id === outputs[index].workId) work = DB.works[workIndex];
    if (work) pieceAmount += work.rate * outputs[index].qty;
  }
  var marks = DB.timesheet.filter(function(row) { return row.empId === employeeId; }).sort(function(left, right) { return String(right.date || '').localeCompare(String(left.date || '')); }).slice(0, 8);
  return '<div class="head"><h2>Мой обзор</h2></div><div class="cards">' +
    card('Дней в табеле', fmtDays(days)) + card('Записей выработки', outputs.length) +
    card('Сдельно начислено', fmt(pieceAmount)) + '</div>' +
    table([
      { t: 'Дата', f: function(row) { return esc(row.date); } },
      { t: 'Дней', f: function(row) { return fmtDays(row.days === undefined ? 1 : row.days); } },
      { t: 'Комментарий', f: function(row) { return esc(row.note || ''); } }
    ], marks);
}

/** Choose the dashboard variant for the current role. */
export function renderDash(user) {
  if (user.role === 'installer') return renderDashInstaller();
  if (user.role === 'worker') return renderDashWorker();
  return renderDashFull();
}
