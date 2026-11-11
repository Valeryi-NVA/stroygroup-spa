import { DB } from './storage.js';
import { inR, num } from './utils.js';

/** Find a record by ID in an array. */
export function findById(items, id) {
  var index;
  for (index = 0; index < items.length; index += 1) {
    if (items[index] && items[index].id === id) return items[index];
  }
  return null;
}

/** Resolve an employee name from an ID. */
export function empName(id) {
  var employee = findById(DB.employees, id);
  return employee ? employee.name : '—';
}

/** Resolve an object name from an ID. */
export function objName(id) {
  var object = findById(DB.objects, id);
  return object ? object.name : '—';
}

/** Resolve vehicle plate and model from an ID. */
export function vehName(id) {
  var vehicle = findById(DB.vehicles, id);
  return vehicle ? vehicle.plate + ' · ' + vehicle.model : '—';
}

/** Sum direct travel costs without adding payroll or per diem. */
export function tripExpense(trip) {
  return num(trip.fuel) + num(trip.materials) + num(trip.other);
}

/** Sum only actual direct expenses and recorded travel expenses for an object. */
export function costsFor(objectId) {
  var sum = 0;
  var index;
  for (index = 0; index < DB.costs.length; index += 1) {
    if (DB.costs[index].objectId === objectId) sum += num(DB.costs[index].amount);
  }
  for (index = 0; index < DB.trips.length; index += 1) {
    if (DB.trips[index].objectId === objectId) sum += tripExpense(DB.trips[index]);
  }
  return sum;
}

/** Sum recorded customer payments for screens that explicitly display receipts. */
export function paymentsFor(objectId) {
  var sum = 0;
  var index;
  for (index = 0; index < DB.payments.length; index += 1) {
    if (DB.payments[index].objectId === objectId) sum += num(DB.payments[index].amount);
  }
  return sum;
}

/** Count workdays from trip crew membership or approved-independent timesheet entries. */
export function daysFor(employee, from, to) {
  var index;
  var total = 0;
  if (employee.role === 'Монтажник') {
    for (index = 0; index < DB.trips.length; index += 1) {
      if (inR(DB.trips[index].date, from, to) &&
          (DB.trips[index].seniorId === employee.id || (DB.trips[index].crew || []).indexOf(employee.id) !== -1)) total += 1;
    }
    return total;
  }
  for (index = 0; index < DB.timesheet.length; index += 1) {
    if (DB.timesheet[index].empId === employee.id && inR(DB.timesheet[index].date, from, to)) {
      total += num(DB.timesheet[index].days === undefined ? 1 : DB.timesheet[index].days);
    }
  }
  return total;
}

/** Calculate standalone payroll rows for a date range; object expenses are never included. */
export function calcSalary(from, to) {
  var result = [];
  var index;
  for (index = 0; index < DB.employees.length; index += 1) {
    var employee = DB.employees[index];
    var row = { emp: employee, days: daysFor(employee, from, to), base: 0, piece: 0, premium: 0, total: 0, notes: [] };
    var workIndex;
    var objectIndex;
    if (employee.payType === 'day') {
      var dailyRate = employee.role === 'Монтажник'
        ? num(employee.installRate === undefined ? employee.rate : employee.installRate)
        : num(employee.workshopRate === undefined ? employee.rate : employee.workshopRate);
      row.base = row.days * dailyRate;
      row.notes.push(row.days + ' дн. × ' + dailyRate);
    } else if (employee.payType === 'salary') {
      row.base = num(employee.salary);
      row.notes.push('Оклад');
    } else if (employee.payType === 'piece') {
      for (workIndex = 0; workIndex < DB.output.length; workIndex += 1) {
        var output = DB.output[workIndex];
        var work = findById(DB.works, output.workId);
        if (output.empId === employee.id && inR(output.date, from, to) && work) row.piece += num(work.rate) * num(output.qty);
      }
      row.notes.push('Сдельно');
    }
    if (num(employee.premiumPct) > 0) {
      var assignedTotal = 0;
      var assignedCount = 0;
      for (objectIndex = 0; objectIndex < DB.objects.length; objectIndex += 1) {
        var object = DB.objects[objectIndex];
        if ((object.managerId === employee.id || object.designerId === employee.id) && inR(object.closedAt, from, to)) {
          assignedTotal += num(object.amount);
          assignedCount += 1;
        }
      }
      row.premium = assignedTotal * num(employee.premiumPct) / 100;
      if (row.premium) row.notes.push('Премия за ' + assignedCount + ' объекта');
    }
    row.total = row.base + row.piece + row.premium;
    result.push(row);
  }
  return result;
}
