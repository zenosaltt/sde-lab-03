const form = document.getElementById('form');
const endpoint = document.getElementById('endpoint');
const idInput = document.getElementById('id');
const currencyInput = document.getElementById('currency');
const requestEl = document.getElementById('request');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');

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
    try {
      resultEl.textContent = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      resultEl.textContent = text;
    }
  } catch (error) {
    statusEl.textContent = 'No answer from the backend';
    statusEl.className = 'error';
    resultEl.textContent = String(error);
  }
});

// Fill the table of cities, so the user knows which IDs exist.
async function loadCities() {
  const body = document.querySelector('#cities tbody');
  try {
    const cities = await (await fetch('/cities')).json();
    for (const city of cities) {
      const row = body.insertRow();
      row.insertCell().textContent = city.id;
      row.insertCell().textContent = city.name;
      row.insertCell().textContent = city.currency;
    }
  } catch {
    body.insertRow().insertCell().textContent = 'Could not load the cities.';
  }
}

loadCities();
