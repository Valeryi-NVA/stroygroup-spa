import { DB, save } from './storage.js';
import { ROLES_DEF, canAccess } from './roles.js';
import { $, formatPhone, hashPassword, normalizePhone } from './utils.js';
import { renderApp } from './router.js';

/** Return the logged-in user or null. */
export function getCurrentUser() {
  var index;
  if (!DB.session) return null;
  for (index = 0; index < DB.users.length; index += 1) {
    if (DB.users[index] && DB.users[index].id === DB.session) return DB.users[index];
  }
  DB.session = null;
  save();
  return null;
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

/** Authenticate the user against the local demo account list. */
function login(event) {
  var phone = normalizePhone($('#loginPhone').value);
  var password = $('#loginPass').value;
  var error = $('#loginError');
  var index;
  event.preventDefault();
  error.textContent = '';
  if (!phone) { error.textContent = 'Введите корректный номер телефона'; return; }
  if (!password) { error.textContent = 'Введите пароль'; return; }
  for (index = 0; index < DB.users.length; index += 1) {
    if (DB.users[index].phone === phone && DB.users[index].passHash === hashPassword(password)) {
      DB.session = DB.users[index].id;
      if (!save()) return;
      showMainApp();
      return;
    }
  }
  error.textContent = 'Неверный телефон или пароль';
}

/** Register a new local user with the default worker role. */
function register(event) {
  var phone = normalizePhone($('#regPhone').value);
  var name = $('#regName').value.replace(/^\s+|\s+$/g, '');
  var password = $('#regPass').value;
  var repeat = $('#regPass2').value;
  var error = $('#regError');
  var index;
  event.preventDefault();
  error.textContent = '';
  if (!phone) { error.textContent = 'Введите корректный номер телефона'; return; }
  if (name.length < 2) { error.textContent = 'Укажите ФИО'; return; }
  if (password.length < 4) { error.textContent = 'Пароль должен содержать минимум 4 символа'; return; }
  if (password !== repeat) { error.textContent = 'Пароли не совпадают'; return; }
  for (index = 0; index < DB.users.length; index += 1) {
    if (DB.users[index].phone === phone) { error.textContent = 'Этот телефон уже зарегистрирован'; return; }
  }
  DB.users.push({ id: 'u-' + Math.random().toString(36).slice(2, 10), phone: phone, name: name, passHash: hashPassword(password), role: 'worker', createdAt: new Date().toISOString().slice(0, 10) });
  DB.session = DB.users[DB.users.length - 1].id;
  if (!save()) return;
  showMainApp();
}

/** Bind authentication forms and restore the local session. */
export function initAuth() {
  try {
    $('#tabLogin').addEventListener('click', function() { switchAuthTab(true); });
    $('#tabRegister').addEventListener('click', function() { switchAuthTab(false); });
    $('#loginForm').addEventListener('submit', login);
    $('#registerForm').addEventListener('submit', register);
    $('#quickAdminBtn').addEventListener('click', function() {
      var index;
      for (index = 0; index < DB.users.length; index += 1) {
        if (DB.users[index].role === 'admin') {
          DB.session = DB.users[index].id;
          if (save()) showMainApp();
          return;
        }
      }
      $('#loginError').textContent = 'Демо-администратор не найден. Сбросьте данные.';
    });
    $('#logoutBtn').addEventListener('click', function() {
      if (!window.confirm('Выйти из системы?')) return;
      DB.session = null;
      if (save()) showAuthScreen();
    });
    if (getCurrentUser()) showMainApp();
    else showAuthScreen();
  } catch (error) {
    console.error('Ошибка инициализации авторизации:', error);
    window.alert('Не удалось запустить приложение: ' + error.message);
  }
}

export { canAccess };
