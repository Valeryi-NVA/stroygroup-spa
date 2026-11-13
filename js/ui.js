import { $, esc, num } from './utils.js';

/** Render a status badge using escaped user-provided text. */
export function badge(status) {
  var classes = { 'Новый': 'b-new', 'В работе': 'b-work', 'Завершён': 'b-done', 'Отменён': 'b-cancel' };
  return '<span class="badge ' + (classes[status] || 'b-new') + '">' + esc(status) + '</span>';
}

/** Render a generic HTML table; column renderers own their escaping. */
export function table(columns, rows, emptyText) {
  var html = '<div class="table-wrap"><table><thead><tr>';
  var index;
  if (!rows.length) return '<div class="empty">' + esc(emptyText || 'Записей пока нет') + '</div>';
  for (index = 0; index < columns.length; index += 1) html += '<th>' + esc(columns[index].t) + '</th>';
  html += '</tr></thead><tbody>';
  for (var rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    html += '<tr>';
    for (index = 0; index < columns.length; index += 1) {
      html += '<td data-label="' + esc(columns[index].t) + '">' + columns[index].f(rows[rowIndex]) + '</td>';
    }
    html += '</tr>';
  }
  return html + '</tbody></table></div>';
}

/** Render a compact table for a short record list. */
export function miniTable(columns, rows, emptyText) {
  return table(columns, rows, emptyText).replace('<table>', '<table class="mini">');
}

/** Display a validation message inside the currently open form. */
export function setFormError(message) {
  var error = $('#dlgBody [data-form-error]');
  if (error) error.textContent = message;
}

/** Show a non-modal message above the current screen content. */
export function showMessage(message) {
  var app = $('#app');
  var previous = app.querySelector('.app-message');
  var notice = document.createElement('div');
  if (previous) previous.parentNode.removeChild(previous);
  notice.className = 'auth-error app-message';
  notice.setAttribute('role', 'alert');
  notice.textContent = message;
  app.insertBefore(notice, app.firstChild);
}

/** Build a form dialog and call the supplied callback with validated field values. */
export function openForm(title, fields, data, onSave) {
  var dialog = $('#modal');
  var body = $('#dlgBody');
  var html = '';
  var index;
  for (index = 0; index < fields.length; index += 1) {
    var field = fields[index];
    var value = data && data[field.key] !== undefined && data[field.key] !== null ? data[field.key] : (field.def === undefined ? '' : field.def);
    if (field.type === 'select') {
      html += '<label class="fld">' + esc(field.label) + '<select data-key="' + esc(field.key) + '">';
      for (var optionIndex = 0; optionIndex < field.options.length; optionIndex += 1) {
        var option = field.options[optionIndex];
        html += '<option value="' + esc(option.v) + '"' + (String(value) === String(option.v) ? ' selected' : '') + '>' + esc(option.t) + '</option>';
      }
      html += '</select></label>';
    } else if (field.type === 'textarea') {
      html += '<label class="fld">' + esc(field.label) + '<textarea data-key="' + esc(field.key) + '" rows="3">' + esc(value) + '</textarea></label>';
    } else if (field.type === 'checks') {
      html += '<div class="fld">' + esc(field.label) + '<div class="checks">';
      for (optionIndex = 0; optionIndex < field.options.length; optionIndex += 1) {
        option = field.options[optionIndex];
        html += '<label class="chk"><input type="checkbox" data-check="' + esc(field.key) + '" value="' + esc(option.v) + '"' +
          ((value || []).indexOf(option.v) !== -1 ? ' checked' : '') + '> ' + esc(option.t) + '</label>';
      }
      html += '</div></div>';
    } else {
      html += '<label class="fld">' + esc(field.label) + '<input data-key="' + esc(field.key) + '" type="' +
        esc(field.type || 'text') + '" value="' + esc(value) + '"' + (field.step ? ' step="' + esc(field.step) + '"' : '') + '></label>';
    }
  }
  $('#dlgTitle').textContent = title;
  body.innerHTML = html + '<div class="auth-error form-error" data-form-error role="alert"></div>';
  $('#dlgCancel').onclick = function() { dialog.close(); };
  $('#dlgSave').onclick = function() {
    var result = {};
    var inputs = body.querySelectorAll('[data-key]');
    var checks = body.querySelectorAll('[data-check]');
    var fieldIndex;
    var saveResult;
    var saveButton = $('#dlgSave');
    for (fieldIndex = 0; fieldIndex < inputs.length; fieldIndex += 1) {
      result[inputs[fieldIndex].getAttribute('data-key')] = inputs[fieldIndex].type === 'number' ? num(inputs[fieldIndex].value) : inputs[fieldIndex].value;
    }
    for (fieldIndex = 0; fieldIndex < checks.length; fieldIndex += 1) {
      var key = checks[fieldIndex].getAttribute('data-check');
      if (!result[key]) result[key] = [];
      if (checks[fieldIndex].checked) result[key].push(checks[fieldIndex].value);
    }
    try {
      saveResult = onSave(result);
    } catch (error) {
      setFormError(error.message || 'Не удалось сохранить данные.');
      return;
    }
    if (saveResult && typeof saveResult.then === 'function') {
      saveButton.disabled = true;
      saveResult.then(function(saved) {
        saveButton.disabled = false;
        if (saved !== false) dialog.close();
      }).catch(function(error) {
        saveButton.disabled = false;
        setFormError(error.message || 'Не удалось сохранить данные.');
      });
    } else if (saveResult !== false) dialog.close();
  };
  if (!dialog.open) dialog.showModal();
}
