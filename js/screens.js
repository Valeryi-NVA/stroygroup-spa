import { DB, save, seed, replaceDB } from './storage.js';
import { calcSalary, costsFor, empName, findById, objName, paymentsFor, tripExpense, vehName } from './business.js';
import { fmt, fmtDays, fmtN, esc } from './utils.js';
import { badge, miniTable, table } from './ui.js';

function actions(id, editAction, deleteAction) {
  return '<div class="row-actions"><button class="btn xs" data-action="' + editAction + '" data-id="' + esc(id) + '" title="Изменить">✎</button>' +
    '<button class="btn xs danger" data-action="' + deleteAction + '" data-id="' + esc(id) + '" title="Удалить">✕</button></div>';
}

/** Render construction objects with expense-only totals. */
export function renderObjects() {
  return '<div class="head"><h2>Объекты</h2><button class="btn primary" data-action="obj-add">+ Объект</button></div>' +
    table([
      { t: 'Наименование', f: function(row) { return '<b>' + esc(row.name) + '</b><div class="sub">' + esc(row.comment || '') + '</div>'; } },
      { t: 'Адрес', f: function(row) { return esc(row.address); } },
      { t: 'Заказчик', f: function(row) { return esc(row.phone); } },
      { t: 'Статус', f: function(row) { return badge(row.status); } },
      { t: 'Расходы', f: function(row) { return fmt(costsFor(row.id)); } },
      { t: '', f: function(row) { return actions(row.id, 'obj-edit', 'obj-del'); } }
    ], DB.objects);
}

/** Render the employee directory and pay-type information. */
export function renderStaff() {
  return '<div class="head"><h2>Сотрудники</h2><button class="btn primary" data-action="emp-add">+ Сотрудник</button></div>' +
    table([
      { t: 'ФИО', f: function(row) { return '<b>' + esc(row.name) + '</b><div class="sub">' + esc(row.phone || '') + '</div>'; } },
      { t: 'Роль', f: function(row) { return esc(row.role); } },
      { t: 'Тип оплаты', f: function(row) { return esc({ day: 'Дневная ставка', piece: 'Сдельная', salary: 'Оклад', premium: 'Премия' }[row.payType] || row.payType); } },
      { t: 'Ставка/день', f: function(row) { return row.payType === 'day' ? fmt(row.rate) : '—'; } },
      { t: 'Оклад', f: function(row) { return row.payType === 'salary' ? fmt(row.salary) : '—'; } },
      { t: '', f: function(row) { return actions(row.id, 'emp-edit', 'emp-del'); } }
    ], DB.employees);
}

/** Render attendance records with day counts and no hourly fields. */
export function renderTimesheet() {
  var rows = DB.timesheet.slice().sort(function(left, right) { return String(right.date || '').localeCompare(String(left.date || '')); });
  return '<div class="head"><h2>Табель цеха</h2><button class="btn primary" data-action="ts-add">+ Отметка</button></div>' +
    table([
      { t: 'Дата', f: function(row) { return esc(row.date); } },
      { t: 'Сотрудник', f: function(row) { return '<b>' + esc(empName(row.empId)) + '</b>'; } },
      { t: 'Дней', f: function(row) { return fmtDays(row.days === undefined ? 1 : row.days); } },
      { t: 'Объект', f: function(row) { return row.objectId ? esc(objName(row.objectId)) : '—'; } },
      { t: 'Комментарий', f: function(row) { return esc(row.note || ''); } },
      { t: '', f: function(row) { return actions(row.id, 'ts-edit', 'ts-del'); } }
    ], rows);
}

/** Render installation trips and their direct expense breakdown. */
export function renderTrips() {
  var rows = DB.trips.slice().sort(function(left, right) { return String(right.date || '').localeCompare(String(left.date || '')); });
  return '<div class="head"><h2>Выезды монтажников</h2><button class="btn primary" data-action="trip-add">+ Выезд</button></div>' +
    table([
      { t: 'Дата', f: function(row) { return esc(row.date); } },
      { t: 'Объект', f: function(row) { return esc(objName(row.objectId)); } },
      { t: 'Старший', f: function(row) { return esc(empName(row.seniorId)); } },
      { t: 'Бригада', f: function(row) { return esc((row.crew || []).map(empName).join(', ')); } },
      { t: 'Машина', f: function(row) { return esc(vehName(row.vehicleId)); } },
      { t: 'Транспорт', f: function(row) { return fmt(row.fuel); } },
      { t: 'Материалы', f: function(row) { return fmt(row.materials); } },
      { t: 'Прочее', f: function(row) { return fmt(row.other); } },
      { t: 'Расходы', f: function(row) { return '<b>' + fmt(tripExpense(row)) + '</b>'; } },
      { t: '', f: function(row) { return actions(row.id, 'trip-edit', 'trip-del'); } }
    ], rows);
}

/** Render the piece-work rate catalogue and employee output records. */
export function renderWorks() {
  return '<div class="head"><h2>Сдельные работы</h2><button class="btn primary" data-action="work-add">+ Расценка</button></div>' +
    table([
      { t: 'Работа / изделие', f: function(row) { return '<b>' + esc(row.name) + '</b>'; } },
      { t: 'Ставка за единицу', f: function(row) { return fmt(row.rate); } },
      { t: '', f: function(row) { return actions(row.id, 'work-edit', 'work-del'); } }
    ], DB.works) +
    '<div class="head"><h3>Выработка</h3><button class="btn" data-action="out-add">+ Выработка</button></div>' +
    table([
      { t: 'Дата', f: function(row) { return esc(row.date); } },
      { t: 'Сотрудник', f: function(row) { return esc(empName(row.empId)); } },
      { t: 'Работа', f: function(row) { var work = findById(DB.works, row.workId); return esc(work ? work.name : '—'); } },
      { t: 'Количество', f: function(row) { return fmtN(row.qty); } },
      { t: 'Начислено', f: function(row) { var work = findById(DB.works, row.workId); return fmt(work ? work.rate * row.qty : 0); } },
      { t: '', f: function(row) { return actions(row.id, 'out-edit', 'out-del'); } }
    ], DB.output);
}

/** Render the vehicle directory. */
export function renderFleet() {
  return '<div class="head"><h2>Автопарк</h2><button class="btn primary" data-action="veh-add">+ Машина</button></div>' +
    table([
      { t: 'Госномер', f: function(row) { return '<b>' + esc(row.plate) + '</b>'; } },
      { t: 'Модель', f: function(row) { return esc(row.model); } },
      { t: 'Водитель', f: function(row) { return esc(empName(row.driverId)); } },
      { t: '', f: function(row) { return actions(row.id, 'veh-edit', 'veh-del'); } }
    ], DB.vehicles);
}

function expenseRowsForObject(objectId) {
  var result = [];
  var index;
  for (index = 0; index < DB.costs.length; index += 1) {
    if (DB.costs[index].objectId === objectId) {
      result.push({ date: DB.costs[index].date, type: DB.costs[index].type, amount: DB.costs[index].amount, note: DB.costs[index].note, id: DB.costs[index].id, source: 'Расход' });
    }
  }
  for (index = 0; index < DB.trips.length; index += 1) {
    var trip = DB.trips[index];
    if (trip.objectId !== objectId) continue;
    if (Number(trip.fuel) > 0) result.push({ date: trip.date, type: 'Транспорт · выезд', amount: trip.fuel, note: '', id: trip.id + '-fuel', source: 'Выезд' });
    if (Number(trip.materials) > 0) result.push({ date: trip.date, type: 'Материалы · выезд', amount: trip.materials, note: '', id: trip.id + '-materials', source: 'Выезд' });
    if (Number(trip.other) > 0) result.push({ date: trip.date, type: 'Прочее · выезд', amount: trip.other, note: '', id: trip.id + '-other', source: 'Выезд' });
  }
  return result;
}

/** Render the accounting expense summary by object, with no income or payroll. */
export function renderFinance() {
  var html = '<div class="head"><h2>Сводка расходов по объектам</h2></div>' +
    '<div class="sub">Только фактические расходы и затраты выездов. Доходы и зарплата в сводку не включаются.</div>' +
    table([
      { t: 'Объект', f: function(row) { return '<b>' + esc(row.name) + '</b><div class="sub">' + esc(row.address || '') + '</div>'; } },
      { t: 'Материалы', f: function(row) { return fmt(row.materials); } },
      { t: 'Транспорт', f: function(row) { return fmt(row.transport); } },
      { t: 'Инструменты', f: function(row) { return fmt(row.tools); } },
      { t: 'Проживание', f: function(row) { return fmt(row.accommodation); } },
      { t: 'Прочее', f: function(row) { return fmt(row.other); } },
      { t: 'Итого расходов', f: function(row) { return '<b>' + fmt(row.total) + '</b>'; } },
      { t: '', f: function(row) { return '<button class="btn xs" data-action="cost-add" data-obj="' + esc(row.id) + '">+ Расход</button>'; } }
    ], DB.objects.map(function(object) {
      var summary = { id: object.id, name: object.name, address: object.address, materials: 0, transport: 0, tools: 0, accommodation: 0, other: 0, total: 0 };
      var expenses = expenseRowsForObject(object.id);
      var index;
      for (index = 0; index < expenses.length; index += 1) {
        var type = expenses[index].type;
        var category = type.indexOf('Материал') === 0 ? 'materials' :
          type.indexOf('Транспорт') === 0 || type === 'Топливо' ? 'transport' :
          type.indexOf('Инструмент') === 0 ? 'tools' :
          type.indexOf('Проживание') === 0 ? 'accommodation' : 'other';
        summary[category] += Number(expenses[index].amount) || 0;
        summary.total += Number(expenses[index].amount) || 0;
      }
      return summary;
    })) +
    '<h3>Фактические записи расходов</h3>';

  for (var objectIndex = 0; objectIndex < DB.objects.length; objectIndex += 1) {
    var object = DB.objects[objectIndex];
    var rows = expenseRowsForObject(object.id);
    html += '<section class="panel"><div class="panel-head"><b>' + esc(object.name) + '</b><span>Итого: <b>' + fmt(costsFor(object.id)) + '</b></span></div>' +
      miniTable([
        { t: 'Дата', f: function(row) { return esc(row.date); } },
        { t: 'Категория', f: function(row) { return esc(row.type); } },
        { t: 'Сумма', f: function(row) { return '<b>' + fmt(row.amount) + '</b>'; } },
        { t: 'Источник', f: function(row) { return esc(row.source); } },
        { t: 'Комментарий', f: function(row) { return esc(row.note || ''); } },
        { t: '', f: function(row) { return row.source === 'Расход' ? '<button class="btn xs danger" data-action="cost-del" data-id="' + esc(row.id) + '">✕</button>' : ''; } }
      ], rows, 'Расходов по объекту пока нет') + '</section>';
  }
  html += '<div class="head"><h3>Поступления заказчиков (не входят в сводку расходов)</h3><button class="btn" data-action="pay-add">+ Поступление</button></div>' +
    table([
      { t: 'Дата', f: function(row) { return esc(row.date); } },
      { t: 'Объект', f: function(row) { return esc(objName(row.objectId)); } },
      { t: 'Сумма', f: function(row) { return fmt(row.amount); } },
      { t: 'Комментарий', f: function(row) { return esc(row.note || ''); } },
      { t: '', f: function(row) { return '<button class="btn xs danger" data-action="pay-del" data-id="' + esc(row.id) + '">✕</button>'; } }
    ], DB.payments);
  return html;
}

/** Render calculated payroll independently from object expenses. */
export function renderSalary() {
  var rows = calcSalary(DB.settings.from, DB.settings.to);
  var total = 0;
  for (var index = 0; index < rows.length; index += 1) total += rows[index].total;
  return '<div class="head"><h2>Расчёт зарплаты</h2></div>' +
    '<div class="period"><label>С<input type="date" data-period="from" value="' + esc(DB.settings.from) + '"></label>' +
    '<label>По<input type="date" data-period="to" value="' + esc(DB.settings.to) + '"></label></div>' +
    table([
      { t: 'Сотрудник', f: function(row) { return '<b>' + esc(row.emp.name) + '</b>'; } },
      { t: 'Дни', f: function(row) { return fmtDays(row.days); } },
      { t: 'База', f: function(row) { return fmt(row.base); } },
      { t: 'Сдельно', f: function(row) { return fmt(row.piece); } },
      { t: 'Премия', f: function(row) { return fmt(row.premium); } },
      { t: 'Итого', f: function(row) { return '<b>' + fmt(row.total) + '</b>'; } }
    ], rows) + '<div class="panel"><b>Итого начислено: ' + fmt(total) + '</b><div class="sub">Расчёт зарплаты показан отдельно и не включается в расходы объектов.</div></div>';
}

/** Render user-role settings and reset controls. */
export function renderSettings() {
  var roles = ['admin', 'manager', 'foreman', 'accountant', 'designer', 'installer', 'worker'];
  return '<div class="head"><h2>Настройки</h2><button class="btn danger" data-action="reset">Сбросить демо-данные</button></div>' +
    table([
      { t: 'Пользователь', f: function(row) { return '<b>' + esc(row.name) + '</b><div class="sub">' + esc(row.phone) + '</div>'; } },
      { t: 'Роль', f: function(row) {
        return '<select class="role-select" data-role-for="' + esc(row.id) + '">' + roles.map(function(role) {
          var definition = { admin: 'Администратор', manager: 'Менеджер', foreman: 'Начальник цеха', accountant: 'Бухгалтер', designer: 'Проектировщик', installer: 'Монтажник', worker: 'Сотрудник цеха' };
          return '<option value="' + role + '"' + (row.role === role ? ' selected' : '') + '>' + definition[role] + '</option>';
        }).join('') + '</select>'; } },
      { t: '', f: function(row) { return '<button class="btn xs danger" data-action="user-del" data-id="' + esc(row.id) + '">Удалить</button>'; } }
    ], DB.users) +
    '<h3>Доступ по ролям</h3>' +
    table([
      { t: 'Роль', f: function(row) { return '<b>' + esc(row.label) + '</b>'; } },
      { t: 'Разделы', f: function(row) { return esc(row.tabs); } }
    ], [
      { label: 'Администратор', tabs: 'Все разделы и настройки' },
      { label: 'Менеджер', tabs: 'Дашборд, объекты, финансы' },
      { label: 'Начальник цеха', tabs: 'Дашборд, сотрудники, табель, выезды, сдельные работы, автопарк, зарплата' },
      { label: 'Бухгалтер', tabs: 'Дашборд, объекты, финансы, зарплата' },
      { label: 'Проектировщик', tabs: 'Дашборд, объекты' },
      { label: 'Монтажник', tabs: 'Дашборд, выезды' },
      { label: 'Сотрудник цеха', tabs: 'Дашборд, табель, сдельные работы' }
    ]);
}
