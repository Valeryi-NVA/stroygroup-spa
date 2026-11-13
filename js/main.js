import { initAuth } from './auth.js';
import { bindRouter, renderApp } from './router.js?v=mobile-drawer-20261111';
import { ACTIONS } from './actions.js';
import { onPersistenceError } from './storage.js';
import { showMessage } from './ui.js';
import { bindQrAttendance } from './qr.js';

/** Start the client application and surface critical startup errors. */
try {
  bindRouter(ACTIONS);
  bindQrAttendance();
  document.addEventListener('crm-state-updated', renderApp);
  onPersistenceError(function(message, error) {
    if (error && error.status === 401) {
      window.location.reload();
      return;
    }
    if (error && error.status === 409) {
      showMessage('Данные обновлены в другом окне. Локальные изменения отменены.');
      renderApp();
      return;
    }
    showMessage('Не удалось синхронизировать данные: ' + message);
    renderApp();
  });
  initAuth();
} catch (error) {
  console.error('Критическая ошибка запуска:', error);
  window.alert('Не удалось запустить приложение: ' + error.message);
}
