import { apiRequest, replaceDB } from './storage.js';
import { showMessage } from './ui.js';

function tokenFromValue(value) {
  var raw = String(value || '').trim();
  return raw.indexOf('nva-crm:auth:') === 0 ? raw.slice('nva-crm:auth:'.length) : raw;
}

function scanner(video, status, onCode) {
  var detector;
  var stream;
  var stopped = false;
  var frame;

  function stop() {
    stopped = true;
    if (frame) window.cancelAnimationFrame(frame);
    if (stream) stream.getTracks().forEach(function(track) { track.stop(); });
    video.srcObject = null;
  }

  if (!('BarcodeDetector' in window)) {
    status.textContent = 'Камера QR не поддерживается этим браузером. Используйте поле ниже.';
    return { stop: stop };
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    status.textContent = 'Нет доступа к камере. Используйте поле ниже.';
    return { stop: stop };
  }
  try {
    detector = new window.BarcodeDetector({ formats: ['qr_code'] });
  } catch (error) {
    status.textContent = 'Камера QR не поддерживается этим браузером. Используйте поле ниже.';
    return { stop: stop };
  }
  navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
    .then(function(result) {
      if (stopped) {
        result.getTracks().forEach(function(track) { track.stop(); });
        return;
      }
      stream = result;
      video.srcObject = stream;
      return video.play();
    })
    .then(function() {
      function detect() {
        if (stopped) return;
        detector.detect(video).then(function(codes) {
          if (codes.length && codes[0].rawValue) {
            onCode(codes[0].rawValue);
            return;
          }
          frame = window.requestAnimationFrame(detect);
        }).catch(function() {
          frame = window.requestAnimationFrame(detect);
        });
      }
      detect();
    })
    .catch(function(error) {
      status.textContent = 'Не удалось открыть камеру: ' + error.message;
    });
  return { stop: stop };
}

function scannerDialog(title, content) {
  var dialog = document.createElement('dialog');
  dialog.className = 'qr-dialog';
  dialog.innerHTML = '<div class="dlg-head">' + title + '</div><div class="dlg-body">' + content + '</div>' +
    '<div class="dlg-foot"><button class="btn ghost" type="button" data-qr-close>Закрыть</button></div>';
  document.body.appendChild(dialog);
  dialog.querySelector('[data-qr-close]').addEventListener('click', function() { dialog.close(); });
  dialog.addEventListener('close', function() { dialog.remove(); });
  dialog.showModal();
  return dialog;
}

export function bindQrLogin(onLogin) {
  var button = document.querySelector('#qrLoginBtn');
  var panel = document.querySelector('#qrLoginPanel');
  var video = document.querySelector('#qrLoginVideo');
  var status = document.querySelector('#qrLoginStatus');
  var input = document.querySelector('#qrLoginToken');
  var submit = document.querySelector('#qrLoginSubmit');
  var scannerHandle = null;
  if (!button) return;

  function authenticate(value) {
    var token = tokenFromValue(value);
    if (!token) {
      status.textContent = 'Не удалось прочитать QR-код.';
      return;
    }
    status.textContent = 'Проверяем QR-код...';
    apiRequest('/api/auth/qr/login', { method: 'POST', body: JSON.stringify({ token: token }) })
      .then(function(result) {
        if (scannerHandle) scannerHandle.stop();
        panel.hidden = true;
        return onLogin(result);
      })
      .catch(function(error) { status.textContent = error.message; });
  }

  button.addEventListener('click', function() {
    panel.hidden = !panel.hidden;
    if (panel.hidden) {
      if (scannerHandle) scannerHandle.stop();
      return;
    }
    status.textContent = 'Наведите камеру на QR-код.';
    scannerHandle = scanner(video, status, authenticate);
  });
  submit.addEventListener('click', function() { authenticate(input.value); });
}

export function bindQrAttendance() {
  var button = document.querySelector('#qrAttendanceBtn');
  if (!button) return;
  button.addEventListener('click', function() {
    var dialog = scannerDialog('QR-отметка', '<label class="fld">Событие<select id="qrAttendanceEvent">' +
      '<option value="trip_start">Выход на выезд</option>' +
      '<option value="workshop_start">Приход в цех</option>' +
      '<option value="workshop_end">Уход из цеха</option>' +
      '</select></label><video id="qrAttendanceVideo" class="qr-video" playsinline muted></video>' +
      '<div id="qrAttendanceStatus" class="sub">Наведите камеру на QR-код сотрудника.</div>' +
      '<label class="fld">Или вставьте код<input id="qrAttendanceToken" autocomplete="off"></label>' +
      '<button class="btn" type="button" id="qrAttendanceSubmit">Отметить по коду</button>');
    var video = dialog.querySelector('#qrAttendanceVideo');
    var status = dialog.querySelector('#qrAttendanceStatus');
    var scannerHandle = scanner(video, status, submit);
    function submit(value) {
      var token = tokenFromValue(value);
      apiRequest('/api/attendance/scan', {
        method: 'POST',
        body: JSON.stringify({ token: token, event: dialog.querySelector('#qrAttendanceEvent').value })
      }).then(function(result) {
        replaceDB(result.db);
        document.dispatchEvent(new CustomEvent('crm-state-updated'));
        scannerHandle.stop();
        dialog.close();
        showMessage('QR-отметка сохранена.');
      }).catch(function(error) { status.textContent = error.message; });
    }
    dialog.querySelector('#qrAttendanceSubmit').addEventListener('click', function() {
      submit(dialog.querySelector('#qrAttendanceToken').value);
    });
    dialog.addEventListener('close', function() { scannerHandle.stop(); });
  });
}

export function showQrCode(userId) {
  var path = userId ? '/api/users/' + encodeURIComponent(userId) + '/qr-code' : '/api/auth/qr-code';
  apiRequest(path, { method: 'GET' }).then(function(result) {
    var dialog = scannerDialog('QR-код: ' + result.user.name, '<div class="qr-image">' + result.svg + '</div>' +
      '<p class="sub">Этот код можно использовать для входа и QR-отметки сотрудника.</p>');
    dialog.querySelector('[data-qr-close]').focus();
  }).catch(function(error) { showMessage(error.message); });
}
