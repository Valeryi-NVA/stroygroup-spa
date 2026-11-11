var TOKEN_KEY = 'nva_crm_session';
var saveQueue = Promise.resolve();
var version = 0;
var saveGeneration = 0;
var persistenceErrorHandler = null;

export var DB = emptyState();

function emptyState() {
  return {
    employees: [],
    vehicles: [],
    works: [],
    objects: [],
    timesheet: [],
    trips: [],
    output: [],
    costs: [],
    payments: [],
    users: [],
    settings: { from: '', to: '', theme: 'dark' },
    session: null
  };
}

/** Repair missing server state fields without creating demo users or browser storage. */
export function migrate(db) {
  var arrays = ['users', 'employees', 'objects', 'timesheet', 'trips', 'vehicles', 'works', 'output', 'costs', 'payments'];
  var index;
  if (!db || typeof db !== 'object' || Object.prototype.toString.call(db) === '[object Array]') db = {};
  for (index = 0; index < arrays.length; index += 1) {
    if (Object.prototype.toString.call(db[arrays[index]]) !== '[object Array]') db[arrays[index]] = [];
  }
  for (index = 0; index < db.employees.length; index += 1) {
    var employee = db.employees[index];
    if (!employee || typeof employee !== 'object') continue;
    if (employee.workshopRate === undefined && employee.installRate === undefined) {
      var legacyRate = Number(employee.rate);
      if (!isFinite(legacyRate)) legacyRate = 0;
      employee.workshopRate = employee.role === 'Монтажник' ? 0 : legacyRate;
      employee.installRate = employee.role === 'Монтажник' ? legacyRate : 0;
    } else {
      if (employee.workshopRate === undefined) employee.workshopRate = 0;
      if (employee.installRate === undefined) employee.installRate = 0;
    }
    if (Object.prototype.hasOwnProperty.call(employee, 'rate')) delete employee.rate;
  }
  if (!db.settings || typeof db.settings !== 'object') db.settings = {};
  if (typeof db.settings.from !== 'string') db.settings.from = '';
  if (typeof db.settings.to !== 'string') db.settings.to = '';
  if (db.settings.theme !== 'light' && db.settings.theme !== 'dark') db.settings.theme = 'dark';
  db.session = typeof db.session === 'string' ? db.session : null;
  return db;
}

/** Provide an empty shape for callers that previously created a local demo seed. */
export function seed() {
  return emptyState();
}

/** Read the short-lived authentication token from tab-scoped session storage. */
export function getAuthToken() {
  try {
    return typeof window === 'undefined' ? '' : window.sessionStorage.getItem(TOKEN_KEY) || '';
  } catch (error) {
    console.error('Ошибка чтения сессии:', error);
    return '';
  }
}

/** Save an authentication token for this browser tab only. */
export function setAuthToken(token) {
  try {
    if (typeof window === 'undefined') return false;
    window.sessionStorage.setItem(TOKEN_KEY, token);
    return true;
  } catch (error) {
    console.error('Ошибка сохранения сессии:', error);
    return false;
  }
}

/** Remove the current browser-tab authentication token. */
export function clearAuthToken() {
  try {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.error('Ошибка завершения сессии:', error);
  }
}

/** Call a same-origin API endpoint and expose server errors to the caller. */
export function apiRequest(path, options) {
  var requestOptions = options || {};
  var headers = requestOptions.headers || {};
  var token = getAuthToken();
  headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;
  requestOptions.headers = headers;
  return window.fetch(path, requestOptions).then(function(response) {
    return response.text().then(function(text) {
      var payload = {};
      if (text) {
        try { payload = JSON.parse(text); }
        catch (error) { throw new Error('Сервер вернул некорректный ответ.'); }
      }
      if (!response.ok) {
        var serverError = new Error(payload.error || 'Ошибка сервера (' + response.status + ').');
        serverError.status = response.status;
        throw serverError;
      }
      return payload;
    });
  });
}

/** Replace the in-memory model with a server-provided state. */
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
  saveGeneration += 1;
}

/** Load the authenticated workspace and its optimistic concurrency version. */
export function loadServerState() {
  return apiRequest('/api/state', { method: 'GET' }).then(function(result) {
    version = result.version;
    replaceDB(result.db);
    DB.session = result.user.id;
    return result;
  });
}

/** Configure visible error handling for asynchronous server persistence. */
export function onPersistenceError(handler) {
  persistenceErrorHandler = handler;
}

/** Save current records to PostgreSQL; no application data is written to browser storage. */
export function save() {
  var snapshot;
  var generation = saveGeneration;
  if (!getAuthToken()) return false;
  try {
    snapshot = JSON.parse(JSON.stringify(DB));
  } catch (error) {
    console.error('Ошибка подготовки состояния:', error);
    if (persistenceErrorHandler) persistenceErrorHandler('Не удалось подготовить данные к отправке.');
    return false;
  }
  saveQueue = saveQueue.then(function() {
    if (generation !== saveGeneration) return null;
    return apiRequest('/api/state', {
      method: 'PUT',
      body: JSON.stringify({ version: version, db: snapshot })
    }).then(function(result) {
      version = result.version;
      return result;
    }).catch(function(error) {
      if (error.status === 401) {
        clearAuthToken();
        if (persistenceErrorHandler) persistenceErrorHandler(error.message, error);
        return null;
      }
      if (error.status === 409 || error.status >= 400) {
        saveGeneration += 1;
        return loadServerState().then(function() {
          if (persistenceErrorHandler) persistenceErrorHandler(error.message, error);
          return null;
        }).catch(function(refreshError) {
          if (persistenceErrorHandler) persistenceErrorHandler(refreshError.message || error.message, refreshError);
          return null;
        });
      }
      if (persistenceErrorHandler) persistenceErrorHandler(error.message, error);
      return null;
    });
  }).catch(function(error) {
    console.error('Ошибка синхронизации с сервером:', error);
    if (persistenceErrorHandler) persistenceErrorHandler(error.message || 'Ошибка соединения с сервером.', error);
    return null;
  });
  return true;
}
