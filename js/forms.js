import { DB, replaceDB, save } from './storage.js';
import { findById } from './business.js';
import { today, uid } from './utils.js';
import { openForm, setFormError } from './ui.js';
import { renderApp } from './router.js';

var EMPLOYEE_ROLES = ['Цех', 'Монтажник', 'Менеджер', 'Бухгалтер', 'Начальник цеха', 'Проектировщик'];
var PAY_TYPES = [
  { v: 'day', t: 'Дневная ставка' },
  { v: 'piece', t: 'Сдельная' },
  { v: 'salary', t: 'Оклад' },
  { v: 'premium', t: 'Только премия' }
];

function employeeOptions(withEmpty) {
  var result = withEmpty ? [{ v: '', t: '— не назначен —' }] : [];
  var index;
  for (index = 0; index < DB.employees.length; index += 1) {
    result.push({ v: DB.employees[index].id, t: DB.employees[index].name + ' · ' + DB.employees[index].role });
  }
  return result;
}

function objectOptions(withEmpty) {
  var result = withEmpty ? [{ v: '', t: '— без объекта —' }] : [];
  var index;
  for (index = 0; index < DB.objects.length; index += 1) result.push({ v: DB.objects[index].id, t: DB.objects[index].name });
  return result;
}

function vehicleOptions(withEmpty) {
  var result = withEmpty ? [{ v: '', t: '— без машины —' }] : [];
  var index;
  for (index = 0; index < DB.vehicles.length; index += 1) {
    result.push({ v: DB.vehicles[index].id, t: DB.vehicles[index].plate + ' · ' + DB.vehicles[index].model });
  }
  return result;
}

function persist(callback) {
  var snapshot = JSON.stringify(DB);
  callback();
  if (!save()) {
    replaceDB(JSON.parse(snapshot));
    return false;
  }
  renderApp();
  return true;
}

/** Create or update an employee and their pay settings. */
export function formEmployee(employee) {
  var isNew = !employee;
  var record = employee || { id: uid(), name: '', role: 'Цех', payType: 'day', rate: 0, salary: 0, premiumPct: 0, phone: '' };
  openForm(isNew ? 'Новый сотрудник' : 'Сотрудник', [
    { key: 'name', label: 'ФИО' },
    { key: 'phone', label: 'Телефон', type: 'tel' },
    { key: 'role', label: 'Роль', type: 'select', options: EMPLOYEE_ROLES.map(function(value) { return { v: value, t: value }; }) },
    { key: 'payType', label: 'Тип оплаты', type: 'select', options: PAY_TYPES },
    { key: 'rate', label: 'Ставка в день, ₽', type: 'number', step: '0.01' },
    { key: 'salary', label: 'Оклад в месяц, ₽', type: 'number', step: '0.01' },
    { key: 'premiumPct', label: 'Премия, %', type: 'number', step: '0.1' }
  ], record, function(data) {
    if (data.name.replace(/^\s+|\s+$/g, '').length < 2) { setFormError('Введите ФИО сотрудника.'); return false; }
    return persist(function() {
      for (var key in data) if (Object.prototype.hasOwnProperty.call(data, key)) record[key] = data[key];
      if (isNew) DB.employees.push(record);
    });
  });
}

/** Create or update a construction object. */
export function formObject(object) {
  var isNew = !object;
  var record = object || { id: uid(), name: '', address: '', phone: '', comment: '', status: 'Новый', amount: 0, managerId: '', designerId: '', closedAt: '' };
  var statuses = ['Новый', 'В работе', 'Завершён', 'Отменён'];
  openForm(isNew ? 'Новый объект' : 'Объект', [
    { key: 'name', label: 'Наименование' },
    { key: 'address', label: 'Адрес' },
    { key: 'phone', label: 'Телефон заказчика', type: 'tel' },
    { key: 'comment', label: 'Комментарий', type: 'textarea' },
    { key: 'status', label: 'Статус', type: 'select', options: statuses.map(function(value) { return { v: value, t: value }; }) },
    { key: 'amount', label: 'Сумма договора, ₽', type: 'number', step: '0.01' },
    { key: 'managerId', label: 'Менеджер', type: 'select', options: employeeOptions(true) },
    { key: 'designerId', label: 'Проектировщик', type: 'select', options: employeeOptions(true) },
    { key: 'closedAt', label: 'Дата закрытия', type: 'date' }
  ], record, function(data) {
    if (data.name.replace(/^\s+|\s+$/g, '').length < 2) { setFormError('Введите название объекта.'); return false; }
    return persist(function() {
      for (var key in data) if (Object.prototype.hasOwnProperty.call(data, key)) record[key] = data[key];
      if (isNew) DB.objects.push(record);
    });
  });
}

/** Create or update a timesheet attendance mark measured in days. */
export function formTimesheet(entry) {
  var isNew = !entry;
  var record = entry || { id: uid(), empId: '', date: today(), days: 1, objectId: '', note: '' };
  openForm(isNew ? 'Отметка в табеле' : 'Отметка в табеле', [
    { key: 'empId', label: 'Сотрудник', type: 'select', options: employeeOptions(false) },
    { key: 'date', label: 'Дата', type: 'date', def: today() },
    { key: 'days', label: 'Количество дней', type: 'number', step: '0.01', def: 1 },
    { key: 'objectId', label: 'Объект', type: 'select', options: objectOptions(true) },
    { key: 'note', label: 'Комментарий' }
  ], record, function(data) {
    if (!data.empId) { setFormError('Выберите сотрудника.'); return false; }
    if (!data.date || data.date > today()) { setFormError('Дата табеля не может быть пустой или будущей.'); return false; }
    if (!isFinite(data.days) || data.days <= 0) { setFormError('Количество дней должно быть больше нуля.'); return false; }
    return persist(function() {
      for (var key in data) if (Object.prototype.hasOwnProperty.call(data, key)) record[key] = data[key];
      if (isNew) DB.timesheet.push(record);
    });
  });
}

/** Create or update a field installation trip with recorded direct costs. */
export function formTrip(trip) {
  var isNew = !trip;
  var record = trip || { id: uid(), date: today(), objectId: '', seniorId: '', crew: [], vehicleId: '', driverId: '', fuel: 0, materials: 0, other: 0 };
  var installers = [];
  var index;
  for (index = 0; index < DB.employees.length; index += 1) {
    if (DB.employees[index].role === 'Монтажник') installers.push({ v: DB.employees[index].id, t: DB.employees[index].name });
  }
  openForm(isNew ? 'Новый выезд' : 'Выезд', [
    { key: 'date', label: 'Дата', type: 'date', def: today() },
    { key: 'objectId', label: 'Объект', type: 'select', options: objectOptions(true) },
    { key: 'seniorId', label: 'Старший', type: 'select', options: [{ v: '', t: '—' }].concat(installers) },
    { key: 'crew', label: 'Состав бригады', type: 'checks', options: installers },
    { key: 'vehicleId', label: 'Машина', type: 'select', options: vehicleOptions(true) },
    { key: 'driverId', label: 'Водитель', type: 'select', options: employeeOptions(true) },
    { key: 'fuel', label: 'Топливо, ₽', type: 'number', step: '0.01' },
    { key: 'materials', label: 'Материалы, ₽', type: 'number', step: '0.01' },
    { key: 'other', label: 'Прочие расходы, ₽', type: 'number', step: '0.01' }
  ], record, function(data) {
    if (!data.date || data.date > today()) { setFormError('Проверьте дату выезда.'); return false; }
    return persist(function() {
      for (var key in data) if (Object.prototype.hasOwnProperty.call(data, key)) record[key] = data[key];
      if (isNew) DB.trips.push(record);
    });
  });
}

/** Create or update a piece-work catalogue entry. */
export function formWork(work) {
  var isNew = !work;
  var record = work || { id: uid(), name: '', rate: 0 };
  openForm(isNew ? 'Новая расценка' : 'Расценка', [
    { key: 'name', label: 'Работа / изделие' },
    { key: 'rate', label: 'Расценка за единицу, ₽', type: 'number', step: '0.01' }
  ], record, function(data) {
    if (data.name.replace(/^\s+|\s+$/g, '').length < 2 || data.rate < 0) { setFormError('Проверьте название и расценку.'); return false; }
    return persist(function() {
      for (var key in data) if (Object.prototype.hasOwnProperty.call(data, key)) record[key] = data[key];
      if (isNew) DB.works.push(record);
    });
  });
}

/** Create or update a worker's completed piece-work output. */
export function formOutput(output) {
  var isNew = !output;
  var record = output || { id: uid(), empId: '', workId: '', qty: 1, date: today(), objectId: '' };
  openForm(isNew ? 'Новая выработка' : 'Выработка', [
    { key: 'empId', label: 'Сотрудник', type: 'select', options: employeeOptions(false) },
    { key: 'workId', label: 'Работа', type: 'select', options: DB.works.map(function(work) { return { v: work.id, t: work.name }; }) },
    { key: 'qty', label: 'Количество', type: 'number', step: '0.01' },
    { key: 'date', label: 'Дата', type: 'date', def: today() },
    { key: 'objectId', label: 'Объект', type: 'select', options: objectOptions(true) }
  ], record, function(data) {
    if (!data.empId || !data.workId || data.qty <= 0 || !data.date || data.date > today()) { setFormError('Проверьте сотрудника, работу, количество и дату.'); return false; }
    return persist(function() {
      for (var key in data) if (Object.prototype.hasOwnProperty.call(data, key)) record[key] = data[key];
      if (isNew) DB.output.push(record);
    });
  });
}

/** Create or update a company vehicle record. */
export function formVehicle(vehicle) {
  var isNew = !vehicle;
  var record = vehicle || { id: uid(), plate: '', model: '', driverId: '' };
  openForm(isNew ? 'Новая машина' : 'Машина', [
    { key: 'plate', label: 'Госномер' },
    { key: 'model', label: 'Модель' },
    { key: 'driverId', label: 'Водитель', type: 'select', options: employeeOptions(true) }
  ], record, function(data) {
    if (!data.plate || !data.model) { setFormError('Укажите госномер и модель машины.'); return false; }
    return persist(function() {
      for (var key in data) if (Object.prototype.hasOwnProperty.call(data, key)) record[key] = data[key];
      if (isNew) DB.vehicles.push(record);
    });
  });
}

/** Create or update an actual object expense without payroll categories. */
export function formCost(cost, objectId) {
  var isNew = !cost;
  var record = cost || { id: uid(), objectId: objectId || '', date: today(), type: 'Материалы', amount: 0, note: '' };
  var categories = ['Материалы', 'Транспорт', 'Инструменты', 'Проживание', 'Прочее'];
  openForm(isNew ? 'Новый расход' : 'Расход', [
    { key: 'objectId', label: 'Объект', type: 'select', options: objectOptions(false) },
    { key: 'date', label: 'Дата', type: 'date', def: today() },
    { key: 'type', label: 'Категория расхода', type: 'select', options: categories.map(function(value) { return { v: value, t: value }; }) },
    { key: 'amount', label: 'Сумма, ₽', type: 'number', step: '0.01' },
    { key: 'note', label: 'Комментарий' }
  ], record, function(data) {
    if (!data.objectId || !data.date || data.date > today() || data.amount < 0) { setFormError('Проверьте объект, дату и сумму расхода.'); return false; }
    return persist(function() {
      for (var key in data) if (Object.prototype.hasOwnProperty.call(data, key)) record[key] = data[key];
      if (isNew) DB.costs.push(record);
    });
  });
}

/** Record a customer receipt separately from actual object expenses. */
export function formPayment(payment, objectId) {
  var isNew = !payment;
  var record = payment || { id: uid(), objectId: objectId || '', date: today(), amount: 0, note: '' };
  openForm(isNew ? 'Поступление оплаты' : 'Оплата', [
    { key: 'objectId', label: 'Объект', type: 'select', options: objectOptions(false) },
    { key: 'date', label: 'Дата', type: 'date', def: today() },
    { key: 'amount', label: 'Сумма, ₽', type: 'number', step: '0.01' },
    { key: 'note', label: 'Комментарий' }
  ], record, function(data) {
    if (!data.objectId || !data.date || data.amount < 0) { setFormError('Проверьте объект, дату и сумму оплаты.'); return false; }
    return persist(function() {
      for (var key in data) if (Object.prototype.hasOwnProperty.call(data, key)) record[key] = data[key];
      if (isNew) DB.payments.push(record);
    });
  });
}

export { findById };
