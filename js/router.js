import { DB, save } from './storage.js';
import { getCurrentUser } from './auth.js';
import { canAccess } from './roles.js';
import { renderDash } from './dash.js';
import { renderFinance, renderFleet, renderObjects, renderSalary, renderSettings, renderStaff, renderTimesheet, renderTrips, renderWorks } from './screens.js';

export var TABS = [
  { id: 'dash', title: 'Обзор', render: renderDash },
  { id: 'objects', title: 'Объекты', render: renderObjects },
  { id: 'staff', title: 'Сотрудники', render: renderStaff },
  { id: 'timesheet', title: 'Табель', render: renderTimesheet },
  { id: 'trips', title: 'Выезды', render: renderTrips },
  { id: 'works', title: 'Сдельные работы', render: renderWorks },
  { id: 'fleet', title: 'Автопарк', render: renderFleet },
  { id: 'finance', title: 'Финансы', render: renderFinance },
  { id: 'salary', title: 'Зарплата', render: renderSalary },
  { id: 'settings', title: 'Настройки', render: renderSettings }
];

export var activeTab = 'dash';

/** Render role-available navigation and its selected screen. */
export function renderApp() {
  var user = getCurrentUser();
  var visible = [];
  var index;
  var selected = null;
  if (!user) return;
  for (index = 0; index < TABS.length; index += 1) if (canAccess(user, TABS[index].id)) visible.push(TABS[index]);
  if (!canAccess(user, activeTab)) activeTab = visible.length ? visible[0].id : '';
  for (index = 0; index < visible.length; index += 1) if (visible[index].id === activeTab) selected = visible[index];
  document.querySelector('#nav').innerHTML = visible.map(function(tab) {
    return '<button type="button" class="' + (tab.id === activeTab ? 'active' : '') + '" aria-current="' + (tab.id === activeTab ? 'page' : 'false') + '" data-tab="' + tab.id + '">' + tab.title + '</button>';
  }).join('');
  document.querySelector('#app').innerHTML = selected ? selected.render(user) : '<div class="empty">Нет доступных разделов</div>';
}

/** Bind navigation, per-screen actions, form periods, and user role selectors. */
export function bindRouter(actions) {
  var menuToggle = document.querySelector('#menuToggle');
  var navBackdrop = document.querySelector('#navBackdrop');
  var nav = document.querySelector('#nav');
  function closeMobileNav(returnFocus) {
    document.body.classList.remove('mobile-nav-open');
    document.querySelector('#mainApp').classList.remove('nav-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Открыть меню');
    navBackdrop.hidden = true;
    if (returnFocus && window.matchMedia('(max-width: 760px)').matches) menuToggle.focus();
  }
  menuToggle.addEventListener('click', function() {
    var isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
    if (isOpen) {
      closeMobileNav(false);
      return;
    }
    menuToggle.setAttribute('aria-expanded', 'true');
    menuToggle.setAttribute('aria-label', 'Закрыть меню');
    document.body.classList.add('mobile-nav-open');
    document.querySelector('#mainApp').classList.add('nav-open');
    navBackdrop.hidden = false;
    var activeItem = nav.querySelector('[aria-current="page"]');
    if (activeItem) activeItem.focus();
  });
  navBackdrop.addEventListener('click', function() { closeMobileNav(true); });
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') closeMobileNav(true);
  });
  window.addEventListener('resize', function() {
    if (window.matchMedia('(min-width: 761px)').matches) closeMobileNav(false);
  });
  document.querySelector('#nav').addEventListener('click', function(event) {
    var target = event.target;
    if (target && target.getAttribute('data-tab')) {
      activeTab = target.getAttribute('data-tab');
      renderApp();
      closeMobileNav(false);
    }
  });
  document.querySelector('#app').addEventListener('click', function(event) {
    var target = event.target;
    while (target && target !== event.currentTarget && !target.getAttribute('data-action')) target = target.parentNode;
    if (!target || target === event.currentTarget) return;
    var action = target.getAttribute('data-action');
    if (actions[action]) {
      event.preventDefault();
      actions[action]({ id: target.getAttribute('data-id'), obj: target.getAttribute('data-obj') });
    }
  });
  document.querySelector('#app').addEventListener('change', function(event) {
    var target = event.target;
    if (target.getAttribute('data-period')) {
      DB.settings[target.getAttribute('data-period')] = target.value;
      if (!save()) return;
      renderApp();
    } else if (target.getAttribute('data-role-for') && actions['user-role']) {
      actions['user-role']({ id: target.getAttribute('data-role-for'), role: target.value });
    }
  });
}
