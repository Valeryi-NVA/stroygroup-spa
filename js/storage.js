import { hashPassword, today, uid, ymd } from './utils.js';

export var LS_KEY = 'stroy_model_v2';
export var DB = loadDB();

/** Read a value from localStorage without allowing browser storage errors to escape. */
export function safeGetItem(key) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  } catch (error) {
    console.error('Ошибка чтения localStorage:', error);
    return null;
  }
}

/** Write a value to localStorage and report success or failure. */
export function safeSetItem(key, value) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error('Ошибка сохранения localStorage:', error);
    window.alert('Не удалось сохранить данные: ' + error.message);
    return false;
  }
}

/** Build the first-run demonstration dataset. */
export function seed() {
  var date = today();
  var monthStart = ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  return {
    employees: [
      { id: 'e1', name: 'Иванов Иван Иванович', role: 'Начальник цеха', payType: 'salary', rate: 0, salary: 80000, premiumPct: 0, phone: '+79000000001' },
      { id: 'e2', name: 'Петров Пётр Петрович', role: 'Цех', payType: 'day', rate: 2500, salary: 0, premiumPct: 0, phone: '+79000000002' },
      { id: 'e3', name: 'Сидоров Сергей Сергеевич', role: 'Цех', payType: 'piece', rate: 0, salary: 0, premiumPct: 0, phone: '+79000000003' },
      { id: 'e4', name: 'Кузнецов Алексей Алексеевич', role: 'Монтажник', payType: 'day', rate: 3000, salary: 0, premiumPct: 0, phone: '+79000000004' },
      { id: 'e5', name: 'Морозов Дмитрий Дмитриевич', role: 'Менеджер', payType: 'salary', rate: 0, salary: 60000, premiumPct: 0, phone: '+79000000005' }
    ],
    vehicles: [{ id: 'v1', plate: 'А123ВС', model: 'Газель NEXT', driverId: 'e4' }],
    works: [{ id: 'w1', name: 'Сборка каркаса', rate: 15000 }],
    objects: [
      { id: 'o1', name: 'Навес на даче', address: 'Московская область', phone: '', comment: 'Демонстрационный объект', status: 'В работе', amount: 0, managerId: 'e5', designerId: '', closedAt: '' },
      { id: 'o2', name: 'Беседка', address: 'Тверь', phone: '', comment: '', status: 'Новый', amount: 0, managerId: '', designerId: '', closedAt: '' }
    ],
    timesheet: [{ id: uid(), empId: 'e2', date: date, days: 1, objectId: 'o1', note: 'Демонстрационная отметка' }],
    trips: [{ id: uid(), date: date, objectId: 'o1', seniorId: 'e4', crew: ['e4'], vehicleId: 'v1', driverId: 'e4', fuel: 1200, materials: 0, other: 0 }],
    output: [{ id: uid(), empId: 'e3', workId: 'w1', qty: 1, date: date, objectId: 'o1' }],
    costs: [{ id: uid(), objectId: 'o1', date: date, type: 'Материалы', amount: 25000, note: 'Демо: крепёж и пиломатериалы' }],
    payments: [],
    users: [
      { id: 'u-admin', phone: '+79000000000', name: 'Администратор', passHash: hashPassword('admin'), role: 'admin', createdAt: date },
      { id: 'u-manager', phone: '+79001111111', name: 'Смирнов Владимир Владимирович', passHash: hashPassword('1234'), role: 'manager', createdAt: date },
      { id: 'u-foreman', phone: '+79002222222', name: 'Иванов Иван Иванович', passHash: hashPassword('1234'), role: 'foreman', createdAt: date },
      { id: 'u-accountant', phone: '+79003333333', name: 'Орлова Елена Евгеньевна', passHash: hashPassword('1234'), role: 'accountant', createdAt: date },
      { id: 'u-designer', phone: '+79004444444', name: 'Волков Николай Николаевич', passHash: hashPassword('1234'), role: 'designer', createdAt: date },
      { id: 'u-installer', phone: '+79005555555', name: 'Кузнецов Алексей Алексеевич', passHash: hashPassword('1234'), role: 'installer', createdAt: date },
      { id: 'u-worker', phone: '+79006666666', name: 'Петров Пётр Петрович', passHash: hashPassword('1234'), role: 'worker', createdAt: date }
    ],
    settings: { from: monthStart, to: date },
    session: null
  };
}

/** Restore required arrays and settings and ensure a demo administrator exists. */
export function migrate(db) {
  var arrays = ['users', 'employees', 'objects', 'timesheet', 'trips', 'vehicles', 'works', 'output', 'costs', 'payments'];
  var index;
  if (!db || typeof db !== 'object' || Object.prototype.toString.call(db) === '[object Array]') db = {};
  for (index = 0; index < arrays.length; index += 1) {
    if (Object.prototype.toString.call(db[arrays[index]]) !== '[object Array]') db[arrays[index]] = [];
  }
  if (!db.settings || typeof db.settings !== 'object') {
    db.settings = { from: ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), to: today() };
  }
  if (typeof db.settings.from !== 'string') db.settings.from = ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  if (typeof db.settings.to !== 'string') db.settings.to = today();
  if (db.session !== null && typeof db.session !== 'string') db.session = null;
  for (index = 0; index < db.users.length; index += 1) {
    if (db.users[index] && db.users[index].role === 'admin') return db;
  }
  db.users.push({ id: 'u-admin', phone: '+79000000000', name: 'Администратор', passHash: hashPassword('admin'), role: 'admin', createdAt: today() });
  return db;
}

/** Load the saved model, recover from malformed JSON, and seed as needed. */
export function loadDB() {
  var raw = safeGetItem(LS_KEY);
  var parsed;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
      return migrate(parsed);
    } catch (error) {
      console.error('Повреждённые данные localStorage, создаю демо-набор:', error);
    }
  }
  return migrate(seed());
}

/** Persist the current application model through the guarded storage wrapper. */
export function save() {
  try {
    return safeSetItem(LS_KEY, JSON.stringify(DB));
  } catch (error) {
    console.error('Ошибка подготовки данных к сохранению:', error);
    window.alert('Не удалось сохранить данные: ' + error.message);
    return false;
  }
}

/** Replace the in-memory model with migrated data. */
export function replaceDB(next) {
  var restored = migrate(next);
  var key;
  var index;
  var field;
  var existing;
  var incoming;
  var matching;
  var rebuilt;
  for (key in restored) {
    if (!Object.prototype.hasOwnProperty.call(restored, key)) continue;
    incoming = restored[key];
    existing = DB[key];
    if (Object.prototype.toString.call(incoming) === '[object Array]' &&
        Object.prototype.toString.call(existing) === '[object Array]') {
      rebuilt = [];
      for (index = 0; index < incoming.length; index += 1) {
        matching = null;
        for (var existingIndex = 0; existingIndex < existing.length; existingIndex += 1) {
          if (incoming[index] && existing[existingIndex] &&
              existing[existingIndex].id === incoming[index].id) {
            matching = existing[existingIndex];
            break;
          }
        }
        if (matching && incoming[index] && typeof incoming[index] === 'object') {
          for (field in matching) {
            if (Object.prototype.hasOwnProperty.call(matching, field) &&
                !Object.prototype.hasOwnProperty.call(incoming[index], field)) delete matching[field];
          }
          for (field in incoming[index]) {
            if (Object.prototype.hasOwnProperty.call(incoming[index], field)) {
              matching[field] = JSON.parse(JSON.stringify(incoming[index][field]));
            }
          }
          rebuilt.push(matching);
        } else rebuilt.push(incoming[index]);
      }
      existing.splice(0, existing.length);
      Array.prototype.push.apply(existing, rebuilt);
    } else if (incoming && typeof incoming === 'object' &&
        Object.prototype.toString.call(incoming) !== '[object Array]' &&
        existing && typeof existing === 'object' &&
        Object.prototype.toString.call(existing) !== '[object Array]') {
      for (field in existing) if (Object.prototype.hasOwnProperty.call(existing, field)) delete existing[field];
      for (field in incoming) {
        if (Object.prototype.hasOwnProperty.call(incoming, field)) {
          existing[field] = JSON.parse(JSON.stringify(incoming[field]));
        }
      }
    } else DB[key] = incoming;
  }
}
