const form = document.getElementById('form');
const endpoint = document.getElementById('endpoint');
const idInput = document.getElementById('id');
const currencyInput = document.getElementById('currency');
const requestEl = document.getElementById('request');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');

// Show an input only if the selected endpoint uses it ({id} or {currency} in its path).
function updateFields() {
  document.getElementById('id-field').hidden = !endpoint.value.includes('{id}');
  document.getElementById('currency-field').hidden = !endpoint.value.includes('{currency}');
}

endpoint.addEventListener('change', updateFields);
updateFields();

// Replace {id} and {currency} in the chosen path with the values typed by the user.
function buildPath() {
  return endpoint.value
    .replace('{id}', encodeURIComponent(idInput.value))
    .replace('{currency}', encodeURIComponent(currencyInput.value));
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const path = buildPath();
  requestEl.textContent = 'GET ' + path;
  statusEl.textContent = '...';
  statusEl.className = '';

  try {
    const response = await fetch(path);
    statusEl.textContent = response.status + ' ' + response.statusText;
    statusEl.className = response.ok ? 'ok' : 'error';

    // The body is JSON for working routes and for errors (400, 404).
    const text = await response.text();
    let data = text;
    try {
      data = JSON.parse(text);
      resultEl.textContent = JSON.stringify(data, null, 2);
    } catch {
      resultEl.textContent = text;
    }

    // Exercise and assignment endpoints do not exist until the student writes them.
    // Nest then answers 404 "Cannot GET ...": a different case from a real
    // "City not found" 404, which comes from an implemented route.
    const isExercise = endpoint.selectedOptions[0].hasAttribute('data-todo');
    const routeMissing = response.status === 404 && String(data.message ?? data).startsWith('Cannot GET');
    if (isExercise && routeMissing) {
      statusEl.textContent = 'Not implemented yet';
      resultEl.textContent = 'This endpoint does not exist in the backend yet.\n' +
        'Add the method to travel.controller.ts (see the comments of the exercise) and try again.';
    }
  } catch (error) {
    statusEl.textContent = 'No answer from the backend';
    statusEl.className = 'error';
    resultEl.textContent = String(error);
  }
});

// Fill a table with the rows returned by a GET endpoint, so the user knows
// which IDs exist. "toCells" turns one item of the JSON array into the cell values.
async function fillTable(tableId, path, toCells) {
  const body = document.querySelector('#' + tableId + ' tbody');
  try {
    const items = await (await fetch(path)).json();
    for (const item of items) {
      const row = body.insertRow();
      for (const value of toCells(item)) {
        row.insertCell().textContent = value;
      }
    }
  } catch {
    body.insertRow().insertCell().textContent = 'Could not load the data.';
  }
}

fillTable('cities', '/cities', (c) => [c.id, c.name, c.currency]);

fillTable('flights', '/flights', (f) => [
  f.id,
  f.departureCity.name,
  f.arrivalCity.name,
  f.departureTime.replace('T', ' ').slice(0, 16),
  f.airline,
  f.priceEur,
]);

fillTable('hotels', '/hotels', (h) => [h.id, h.name, h.city.name, h.pricePerNight]);
