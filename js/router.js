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
    return '<button type="button" class="' + (tab.id === activeTab ? 'active' : '') + '" data-tab="' + tab.id + '">' + tab.title + '</button>';
  }).join('');
  document.querySelector('#app').innerHTML = selected ? selected.render(user) : '<div class="empty">Нет доступных разделов</div>';
}

/** Bind navigation, per-screen actions, form periods, and user role selectors. */
export function bindRouter(actions) {
  document.querySelector('#nav').addEventListener('click', function(event) {
    var target = event.target;
    if (target && target.getAttribute('data-tab')) {
      activeTab = target.getAttribute('data-tab');
      renderApp();
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
