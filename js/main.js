import { initAuth } from './auth.js';
import { bindRouter } from './router.js';
import { ACTIONS } from './actions.js';

/** Start the client application and surface critical startup errors. */
try {
  bindRouter(ACTIONS);
  initAuth();
} catch (error) {
  console.error('Критическая ошибка запуска:', error);
  window.alert('Не удалось запустить приложение: ' + error.message);
}
