import { DB, apiRequest, clearAuthToken, getAuthToken, loadServerState, save, setAuthToken } from './storage.js';
import { ROLES_DEF, canAccess } from './roles.js';
import { $, formatPhone, normalizePhone } from './utils.js';
import { renderApp } from './router.js?v=mobile-drawer-20261111';
import { bindQrLogin } from './qr.js';

/** Return the logged-in user or null. */
export function getCurrentUser() {
  var index;
  if (!DB.session) return null;
  for (index = 0; index < DB.users.length; index += 1) {
    if (DB.users[index] && DB.users[index].id === DB.session) return DB.users[index];
  }
  return null;
}

/** Apply the server-backed appearance preference. */
export function updateTheme() {
  var theme = DB.settings.theme === 'light' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', theme);
  $('#themeToggle').textContent = theme === 'dark' ? 'Светлая тема' : 'Тёмная тема';
  $('#themeToggle').setAttribute('aria-label', theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему');
}

/** Show the authentication screen and hide the application. */
export function showAuthScreen() {
  $('#authScreen').hidden = false;
  $('#mainApp').hidden = true;
  $('#loginError').textContent = '';
  $('#regError').textContent = '';
}

/** Update the current user's name and role in the header. */
export function updateHeader() {
  var user = getCurrentUser();
  var role;
  if (!user) return;
  role = ROLES_DEF[user.role];
  $('#userName').textContent = user.name || formatPhone(user.phone);
  $('#userRole').textContent = role ? role.label : user.role;
}

/** Display the authenticated application. */
export function showMainApp() {
  $('#authScreen').hidden = true;
  $('#mainApp').hidden = false;
  updateTheme();
  updateHeader();
  renderApp();
}

/** Switch the visible login or registration form. */
function switchAuthTab(isLogin) {
  $('#tabLogin').classList.toggle('active', isLogin);
  $('#tabRegister').classList.toggle('active', !isLogin);
  $('#loginForm').hidden = !isLogin;
  $('#registerForm').hidden = isLogin;
  $('#loginError').textContent = '';
  $('#regError').textContent = '';
}

function finishAuthentication(result, errorElement) {
  if (!setAuthToken(result.token)) {
    errorElement.textContent = 'Браузер заблокировал сессионное хранилище. Разрешите его и повторите вход.';
    return Promise.resolve(false);
  }
  return loadServerState().then(function() {
    showMainApp();
    return true;
  }).catch(function(error) {
    clearAuthToken();
    errorElement.textContent = error.message;
    return false;
  });
}

/** Authenticate the user with the cloud service. */
function login(event) {
  var phone = normalizePhone($('#loginPhone').value);
  var password = $('#loginPass').value;
  var error = $('#loginError');
  event.preventDefault();
  error.textContent = '';
  if (!phone) { error.textContent = 'Введите корректный номер телефона'; return; }
  if (!password) { error.textContent = 'Введите пароль'; return; }
  apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone: phone, password: password })
  }).then(function(result) {
    return finishAuthentication(result, error);
  }).catch(function(requestError) {
    error.textContent = requestError.message;
  });
}

/** Register a new company workspace and its first administrator. */
function register(event) {
  var phone = normalizePhone($('#regPhone').value);
  var name = $('#regName').value.replace(/^\s+|\s+$/g, '');
  var tenantName = $('#regTenant').value.replace(/^\s+|\s+$/g, '');
  var password = $('#regPass').value;
  var repeat = $('#regPass2').value;
  var error = $('#regError');
  event.preventDefault();
  error.textContent = '';
  if (!phone) { error.textContent = 'Введите корректный номер телефона'; return; }
  if (name.length < 2) { error.textContent = 'Укажите ФИО'; return; }
  if (password.length < 8) { error.textContent = 'Пароль должен содержать не менее 8 символов'; return; }
  if (password !== repeat) { error.textContent = 'Пароли не совпадают'; return; }
  apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ phone: phone, name: name, tenantName: tenantName, password: password })
  }).then(function(result) {
    return finishAuthentication(result, error);
  }).catch(function(requestError) {
    error.textContent = requestError.message;
  });
}

/** Bind sign-in, registration, theme, and server-session handlers. */
export function initAuth() {
  $('#tabLogin').addEventListener('click', function() { switchAuthTab(true); });
  $('#tabRegister').addEventListener('click', function() { switchAuthTab(false); });
  $('#loginForm').addEventListener('submit', login);
  $('#registerForm').addEventListener('submit', register);
  bindQrLogin(function(result) {
    return finishAuthentication(result, $('#loginError'));
  });
  $('#themeToggle').addEventListener('click', function() {
    DB.settings.theme = DB.settings.theme === 'light' ? 'dark' : 'light';
    updateTheme();
    save();
  });
  $('#logoutBtn').addEventListener('click', function() {
    if (!window.confirm('Выйти из системы?')) return;
    apiRequest('/api/auth/logout', { method: 'POST' }).catch(function(error) {
      console.error('Ошибка завершения облачной сессии:', error);
    }).then(function() {
      clearAuthToken();
      DB.session = null;
      showAuthScreen();
    });
  });
  if (!getAuthToken()) {
    showAuthScreen();
    return;
  }
  loadServerState().then(function() {
    showMainApp();
  }).catch(function(error) {
    clearAuthToken();
    showAuthScreen();
    if (error.status !== 401) $('#loginError').textContent = 'Сервер временно недоступен. Проверьте подключение и повторите попытку.';
  });
}

export { canAccess };
