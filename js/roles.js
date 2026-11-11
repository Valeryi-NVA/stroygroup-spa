export var ROLES_DEF = {
  admin: { label: 'Администратор', tabs: 'all' },
  manager: { label: 'Менеджер', tabs: ['dash', 'objects', 'finance'] },
  foreman: { label: 'Начальник цеха', tabs: ['dash', 'staff', 'timesheet', 'trips', 'works', 'fleet', 'salary'] },
  accountant: { label: 'Бухгалтер', tabs: ['dash', 'objects', 'finance', 'salary'] },
  designer: { label: 'Проектировщик', tabs: ['dash', 'objects'] },
  installer: { label: 'Монтажник', tabs: ['dash', 'trips'] },
  worker: { label: 'Сотрудник цеха', tabs: ['dash', 'timesheet', 'works'] }
};

/** Check whether a user can open the selected application tab. */
export function canAccess(user, tabId) {
  var definition;
  if (!user) return false;
  if (tabId === 'settings') return user.role === 'admin';
  definition = ROLES_DEF[user.role];
  if (!definition) return false;
  if (definition.tabs === 'all') return true;
  return definition.tabs.indexOf(tabId) !== -1;
}
