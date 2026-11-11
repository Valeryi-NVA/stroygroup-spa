import { initAuth } from './auth.js';
import { bindRouter, renderApp } from './router.js';
import { ACTIONS } from './actions.js';
import { onPersistenceError } from './storage.js';
import { showMessage } from './ui.js';

/** Start the client application and surface critical startup errors. */
try {
  bindRouter(ACTIONS);
  onPersistenceError(function(message, error) {
    if (error && error.status === 401) {
      window.location.reload();
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
