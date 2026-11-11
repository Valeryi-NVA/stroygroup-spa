import { createServer } from 'node:http';
import { createHash, randomBytes, scryptSync, timingSafeEqual, randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.env.PORT || 10000);
const secret = process.env.AUTH_SECRET;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required; local/file storage is disabled.');
if (!secret || secret.length < 32) throw new Error('AUTH_SECRET must contain at least 32 characters.');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

const arrayKeys = ['employees', 'vehicles', 'works', 'objects', 'timesheet', 'trips', 'output', 'costs', 'payments'];
const roleWriteKeys = {
  admin: arrayKeys.concat(['settings']),
  manager: ['objects', 'trips', 'costs', 'payments', 'settings'],
  accountant: ['objects', 'costs', 'payments', 'settings'],
  foreman: ['employees', 'vehicles', 'works', 'timesheet', 'trips', 'output', 'settings'],
  designer: ['settings'],
  installer: ['settings'],
  worker: ['settings']
};
const roles = ['admin', 'manager', 'foreman', 'accountant', 'designer', 'installer', 'worker'];
const loginAttempts = new Map();
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const digest = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${digest}`;
}

function verifyPassword(password, stored) {
  const [salt, digest] = String(stored || '').split(':');
  if (!salt || !digest || !/^[a-f0-9]{128}$/i.test(digest)) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(digest, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function hashToken(token) {
  return createHash('sha256').update(secret).update(token).digest('hex');
}

function allowAttempt(key, limit, interval) {
  const now = Date.now();
  let attempt = loginAttempts.get(key);
  if (!attempt || attempt.resetAt <= now) attempt = { count: 0, resetAt: now + interval };
  if (attempt.count >= limit) return false;
  attempt.count += 1;
  loginAttempts.set(key, attempt);
  if (loginAttempts.size > 5000) {
    for (const [candidate, item] of loginAttempts) if (item.resetAt <= now) loginAttempts.delete(candidate);
  }
  return true;
}

function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) digits = digits.slice(1);
  return digits.length === 10 ? `+7${digits}` : '';
}

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
    settings: { from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10), theme: 'dark' }
  };
}

function publicUser(user) {
  return { id: user.id, phone: user.phone, name: user.name, role: user.role, createdAt: user.created_at };
}

function send(response, status, value, headers = {}) {
  const payload = JSON.stringify(value);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    ...headers
  });
  response.end(payload);
}

async function readBody(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (Buffer.byteLength(raw) > 5 * 1024 * 1024) {
      const error = new Error('Размер запроса превышает 5 МБ');
      error.status = 413;
      throw error;
    }
  }
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error('Некорректный JSON');
    error.status = 400;
    throw error;
  }
}

function errorResponse(response, error) {
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error('NVA-CRM request failed:', error);
  send(response, status, { error: status >= 500 ? 'Внутренняя ошибка сервера' : error.message });
}

async function authenticatedUser(request) {
  const authorization = request.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) return null;
  const tokenHash = hashToken(authorization.slice(7));
  const result = await pool.query(
    `SELECT u.id, u.tenant_id, u.phone, u.name, u.role, u.created_at
       FROM crm_sessions s
       JOIN crm_users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
    [tokenHash]
  );
  return result.rows[0] || null;
}

async function issueSession(client, userId) {
  const token = randomBytes(32).toString('base64url');
  await client.query(
    'INSERT INTO crm_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'14 days\')',
    [hashToken(token), userId]
  );
  return token;
}

async function stateFor(user) {
  const [stateResult, usersResult] = await Promise.all([
    pool.query('SELECT version, data FROM crm_state WHERE tenant_id = $1', [user.tenant_id]),
    pool.query('SELECT id, phone, name, role, created_at FROM crm_users WHERE tenant_id = $1 ORDER BY created_at', [user.tenant_id])
  ]);
  if (!stateResult.rowCount) throw new Error('Рабочее пространство не найдено');
  const data = stateResult.rows[0].data;
  const users = usersResult.rows.map(publicUser);
  if (user.role === 'worker' || user.role === 'installer') {
    const employee = data.employees.find((item) => normalizePhone(item.phone) === user.phone);
    const employeeId = employee ? employee.id : null;
    data.employees = employee ? [employee] : [];
    data.timesheet = data.timesheet.filter((item) => item.empId === employeeId);
    data.output = data.output.filter((item) => item.empId === employeeId);
    data.trips = data.trips.filter((item) => item.seniorId === employeeId || (item.crew || []).includes(employeeId));
    data.costs = [];
    data.payments = [];
    data.users = users.filter((item) => item.id === user.id);
  } else {
    data.users = user.role === 'admin' ? users : users.filter((item) => item.id === user.id);
  }
  return { db: data, user: publicUser(user), version: stateResult.rows[0].version, storage: 'postgresql' };
}

async function audit(client, user, action, entity, entityId) {
  await client.query(
    'INSERT INTO crm_audit_logs (tenant_id, user_id, action, entity, entity_id) VALUES ($1, $2, $3, $4, $5)',
    [user.tenant_id, user.id, action, entity, entityId]
  );
}

async function register(input, request, response) {
  if (!allowAttempt(`register:${request.socket.remoteAddress || 'unknown'}`, 5, 60 * 60 * 1000)) {
    send(response, 429, { error: 'Слишком много регистраций. Попробуйте позже.' });
    return;
  }
  const phone = normalizePhone(input.phone);
  const name = String(input.name || '').trim();
  const password = String(input.password || '');
  const tenantName = String(input.tenantName || '').trim().slice(0, 120);
  if (!phone || name.length < 2 || password.length < 8) {
    send(response, 400, { error: 'Укажите телефон, ФИО и пароль не короче 8 символов' });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = randomUUID();
    const tenantId = randomUUID();
    const inserted = await client.query(
      'INSERT INTO crm_tenants (id, name) VALUES ($1, $2) RETURNING created_at',
      [tenantId, tenantName || `Компания ${name}`]
    );
    const userResult = await client.query(
      `INSERT INTO crm_users (id, tenant_id, phone, name, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, 'admin')
       RETURNING id, tenant_id, phone, name, role, created_at`,
      [id, tenantId, phone, name, hashPassword(password)]
    );
    await client.query('INSERT INTO crm_state (tenant_id, data) VALUES ($1, $2)', [tenantId, JSON.stringify(emptyState())]);
    await audit(client, userResult.rows[0], 'REGISTER', 'Tenant', tenantId);
    const token = await issueSession(client, id);
    await client.query('COMMIT');
    send(response, 201, { user: publicUser(userResult.rows[0]), token });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      send(response, 409, { error: 'Номер телефона уже зарегистрирован' });
      return;
    }
    throw error;
  } finally {
    client.release();
  }
}

async function login(input, request, response) {
  const address = request.socket.remoteAddress || 'unknown';
  const key = `login:${address}`;
  const currentAttempt = loginAttempts.get(key);
  if (currentAttempt && currentAttempt.resetAt <= Date.now()) loginAttempts.delete(key);
  if (currentAttempt && currentAttempt.count >= 10 && currentAttempt.resetAt > Date.now()) {
    send(response, 429, { error: 'Слишком много попыток. Подождите минуту и попробуйте снова.' });
    return;
  }
  const phone = normalizePhone(input.phone);
  const result = await pool.query(
    'SELECT id, tenant_id, phone, name, password_hash, role, created_at FROM crm_users WHERE phone = $1',
    [phone || '']
  );
  const user = result.rows[0];
  if (!user || !verifyPassword(String(input.password || ''), user.password_hash)) {
    allowAttempt(key, 10, 60000);
    send(response, 401, { error: 'Неверный телефон или пароль' });
    return;
  }
  loginAttempts.delete(key);
  const token = randomBytes(32).toString('base64url');
  await pool.query(
    'INSERT INTO crm_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'14 days\')',
    [hashToken(token), user.id]
  );
  send(response, 200, { user: publicUser(user), token });
}

function validState(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  for (const key of arrayKeys) if (!Array.isArray(input[key])) return false;
  return input.settings && typeof input.settings === 'object' && !Array.isArray(input.settings);
}

async function saveState(user, input, response) {
  if (!validState(input.db) || !Number.isInteger(input.version)) {
    send(response, 400, { error: 'Некорректное состояние приложения' });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const currentResult = await client.query('SELECT version, data FROM crm_state WHERE tenant_id = $1 FOR UPDATE', [user.tenant_id]);
    const current = currentResult.rows[0];
    if (!current) throw new Error('Рабочее пространство не найдено');
    if (current.version !== input.version) {
      await client.query('ROLLBACK');
      send(response, 409, { error: 'Данные изменились в другом сеансе. Обновите страницу.', version: current.version });
      return;
    }
    const next = structuredClone(current.data);
    for (const key of arrayKeys.concat(['settings'])) {
      if (roleWriteKeys[user.role].includes(key)) next[key] = input.db[key];
    }
    if (user.role === 'admin' && Array.isArray(input.db.users)) {
      const existing = await client.query(
        'SELECT id, role FROM crm_users WHERE tenant_id = $1 FOR UPDATE',
        [user.tenant_id]
      );
      const submitted = new Map(input.db.users.filter((item) => item && typeof item.id === 'string').map((item) => [item.id, item]));
      const ownerCount = existing.rows.filter((item) => {
        const proposed = submitted.get(item.id);
        return item.role === 'admin' && proposed && proposed.role === 'admin';
      }).length;
      if (ownerCount < 1 || !submitted.has(user.id)) {
        await client.query('ROLLBACK');
        send(response, 400, { error: 'В компании должен оставаться хотя бы один администратор' });
        return;
      }
      for (const item of existing.rows) {
        const proposed = submitted.get(item.id);
        if (!proposed) {
          if (item.id === user.id) {
            await client.query('ROLLBACK');
            send(response, 400, { error: 'Нельзя удалить собственную учётную запись' });
            return;
          }
          await client.query('DELETE FROM crm_users WHERE id = $1 AND tenant_id = $2', [item.id, user.tenant_id]);
          await audit(client, user, 'DELETE', 'User', item.id);
        } else if (roles.includes(proposed.role) && proposed.role !== item.role) {
          if (item.id === user.id) {
            await client.query('ROLLBACK');
            send(response, 400, { error: 'Нельзя изменить роль своей учётной записи или снять роль последнего администратора' });
            return;
          }
          await client.query('UPDATE crm_users SET role = $1 WHERE id = $2 AND tenant_id = $3', [proposed.role, item.id, user.tenant_id]);
          await audit(client, user, 'UPDATE_ROLE', 'User', item.id);
        }
      }
    }
    const updated = await client.query(
      'UPDATE crm_state SET data = $1, version = version + 1, updated_at = NOW() WHERE tenant_id = $2 AND version = $3 RETURNING version',
      [JSON.stringify(next), user.tenant_id, input.version]
    );
    if (!updated.rowCount) {
      await client.query('ROLLBACK');
      send(response, 409, { error: 'Данные изменились в другом сеансе. Обновите страницу.' });
      return;
    }
    await audit(client, user, 'UPDATE_STATE', 'State', user.tenant_id);
    await client.query('COMMIT');
    send(response, 200, { ok: true, version: updated.rows[0].version });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function createUser(user, input, response) {
  if (user.role !== 'admin') {
    send(response, 403, { error: 'Только администратор компании может приглашать пользователей' });
    return;
  }
  const phone = normalizePhone(input.phone);
  const name = String(input.name || '').trim();
  const password = String(input.password || '');
  const role = String(input.role || 'worker');
  if (!phone || name.length < 2 || password.length < 8 || !roles.includes(role) || role === 'admin') {
    send(response, 400, { error: 'Проверьте телефон, ФИО, пароль (не менее 8 символов) и роль' });
    return;
  }
  try {
    const result = await pool.query(
      `INSERT INTO crm_users (id, tenant_id, phone, name, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, phone, name, role, created_at`,
      [randomUUID(), user.tenant_id, phone, name, hashPassword(password), role]
    );
    await pool.query(
      'INSERT INTO crm_audit_logs (tenant_id, user_id, action, entity, entity_id) VALUES ($1, $2, $3, $4, $5)',
      [user.tenant_id, user.id, 'CREATE', 'User', result.rows[0].id]
    );
    send(response, 201, { user: publicUser(result.rows[0]) });
  } catch (error) {
    if (error.code === '23505') {
      send(response, 409, { error: 'Этот номер телефона уже используется' });
      return;
    }
    throw error;
  }
}

async function serveStatic(pathname, response) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    send(response, 400, { error: 'Некорректный путь' });
    return;
  }
  const pathParts = decoded.split('/');
  const allowedRootFile = decoded === '/' || decoded === '/index.html' || decoded === '/favicon.ico';
  const allowedAsset = /^\/(css|js)\/[A-Za-z0-9._/-]+$/.test(decoded) &&
    pathParts.indexOf('..') === -1 && pathParts.every((part) => !part.startsWith('.'));
  if (!allowedRootFile && !allowedAsset) {
    send(response, 404, { error: 'Файл не найден' });
    return;
  }
  const candidate = resolve(root, `.${decoded === '/' ? '/index.html' : decoded}`);
  if (candidate !== root && !candidate.startsWith(root + sep)) {
    send(response, 403, { error: 'Доступ запрещён' });
    return;
  }
  try {
    const fileStat = await stat(candidate);
    if (!fileStat.isFile()) {
      send(response, 404, { error: 'Файл не найден' });
      return;
    }
    const content = await readFile(candidate);
    response.writeHead(200, {
      'content-type': mimeTypes[extname(candidate).toLowerCase()] || 'application/octet-stream',
      'content-length': content.length,
      'cache-control': candidate.endsWith('index.html') ? 'no-cache' : 'public, max-age=300'
    });
    response.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      send(response, 404, { error: 'Файл не найден' });
      return;
    }
    throw error;
  }
}

const server = createServer(async (request, response) => {
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('referrer-policy', 'same-origin');
  response.setHeader('x-frame-options', 'DENY');
  response.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (url.pathname === '/health' && request.method === 'GET') {
      await pool.query('SELECT 1');
      send(response, 200, { ok: true, storage: 'postgresql' });
      return;
    }
    if (url.pathname === '/api/auth/register' && request.method === 'POST') {
      await register(await readBody(request), request, response);
      return;
    }
    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      await login(await readBody(request), request, response);
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      const user = await authenticatedUser(request);
      if (!user) {
        send(response, 401, { error: 'Войдите в систему' });
        return;
      }
      if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
        await pool.query('DELETE FROM crm_sessions WHERE token_hash = $1', [hashToken(request.headers.authorization.slice(7))]);
        send(response, 200, { ok: true });
        return;
      }
      if (url.pathname === '/api/state' && request.method === 'GET') {
        send(response, 200, await stateFor(user));
        return;
      }
      if (url.pathname === '/api/state' && request.method === 'PUT') {
        await saveState(user, await readBody(request), response);
        return;
      }
      if (url.pathname === '/api/users' && request.method === 'POST') {
        await createUser(user, await readBody(request), response);
        return;
      }
      send(response, 404, { error: 'API-маршрут не найден' });
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      send(response, 405, { error: 'Метод не поддерживается' });
      return;
    }
    await serveStatic(url.pathname, response);
  } catch (error) {
    errorResponse(response, error);
  }
});

server.listen(port, '0.0.0.0', () => console.log(`NVA-CRM listening on ${port}`));

async function shutdown() {
  server.close();
  await pool.end();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
