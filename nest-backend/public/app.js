const form = document.getElementById('form');
const endpoint = document.getElementById('endpoint');
const idInput = document.getElementById('id');
const currencyInput = document.getElementById('currency');
const requestEl = document.getElementById('request');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const rawEl = document.getElementById('raw');

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

// ---- Rendering --------------------------------------------------------------
// The answer of the backend is shown as cards instead of raw JSON.
// Only textContent is used, never innerHTML, so no data can inject HTML.

// Small helper: creates <tag class="className">text</tag>.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function euro(value) {
  return Number(value).toFixed(2) + ' €';
}

function formatTime(iso) {
  return new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

function formatDuration(from, to) {
  const minutes = Math.round((new Date(to) - new Date(from)) / 60000);
  return Math.floor(minutes / 60) + 'h ' + String(minutes % 60).padStart(2, '0') + 'm';
}

// Weather codes of Open-Meteo, reduced to a few groups.
function weatherText(code) {
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Fog';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  return 'Thunderstorm';
}

// pricePerNightEur -> "Price per night eur"
function prettyLabel(key) {
  const words = key.replace(/([A-Z])/g, ' $1').toLowerCase();
  return words[0].toUpperCase() + words.slice(1);
}

function cityCard(city) {
  const card = el('div', 'item');
  card.append(el('h3', '', city.name));
  card.append(el('p', 'muted', 'Currency: ' + city.currency));
  card.append(el('p', 'muted', city.latitude + ', ' + city.longitude));
  return card;
}

function flightCard(flight) {
  const card = el('div', 'item');
  const route = el('h3', '', flight.departureCity.name + ' → ' + flight.arrivalCity.name);
  card.append(route);
  card.append(el('p', '', formatTime(flight.departureTime) + '  –  ' + formatTime(flight.arrivalTime)));
  card.append(el('p', 'muted', flight.airline + ' · ' + formatDuration(flight.departureTime, flight.arrivalTime)));
  card.append(el('p', 'price', euro(flight.priceEur)));
  return card;
}

// The price of a hotel is in the currency of its city (hotel.city.currency).
// "converted" is { currency, price } when the answer also carries the price in the
// requested currency (e.g. /hotels/1/price?currency=USD): the card then shows that
// price, with the original one below.
function hotelCard(hotel, converted) {
  const original = hotel.pricePerNight.toFixed(2) + ' ' + hotel.city.currency + ' / night';
  const card = el('div', 'item');
  card.append(el('h3', '', hotel.name));
  card.append(el('p', 'muted', hotel.city.name));
  if (converted && typeof converted.price === 'number') {
    card.append(el('p', 'price', converted.price.toFixed(2) + ' ' + converted.currency + ' / night'));
    if (converted.currency !== hotel.city.currency) {
      card.append(el('p', 'muted', 'Original: ' + original));
    }
  } else {
    card.append(el('p', 'price', original));
    if (converted) card.append(el('p', 'error', 'Converted price unavailable'));
  }
  return card;
}

// Chooses the right card by looking at the fields of the object.
function itemCard(item) {
  if (item.departureCity) return flightCard(item);
  if (item.name && item.pricePerNight !== undefined && item.city) return hotelCard(item);
  if (item.latitude !== undefined) return cityCard(item);
  return null;
}

// { status: 'ok', data } or { status: 'unavailable' } (see "available" in the service).
function externalBlock(label, value, describe) {
  // Same structure as the other sections (small title + card), so they align in the grid.
  const section = el('div', 'section');
  const box = el('div', 'item');
  if (value.status === 'ok') {
    box.append(el('p', 'big', describe(value.data)));
  } else {
    box.append(el('p', 'error', 'Currently unavailable'));
  }
  section.append(el('h4', '', label), box);
  return section;
}

function describeWeather(weather) {
  const unit = weather.temperatureUnit ?? '°C';
  return weather.temperature_2m + ' ' + unit + ' · ' + weatherText(weather.weather_code);
}

// A response object (e.g. { flight, weather }) becomes a list of labelled sections.
function renderObject(data) {
  const wrap = el('div', 'sections');
  const facts = el('dl', 'facts');

  // The hotel card shows the converted price, so these are not repeated below.
  const hotelPriceInCard = data.hotel && data.currency && 'pricePerNight' in data;

  for (const [key, value] of Object.entries(data)) {
    if (hotelPriceInCard && (key === 'pricePerNight' || key === 'originalPricePerNight' || key === 'originalCurrency')) {
      continue;
    }
    // The currency is already written next to every price: no box for it.
    if (key === 'currency') continue;
    if (value === null || typeof value !== 'object') {
      // price, currency, nights, totals ... shown as "label: value"
      let text = String(value);
      if (typeof value === 'number' && /price|total/i.test(key)) {
        text = value.toFixed(2) + ' ' + (data.currency ?? '');
      }
      if (value === null && /price|total/i.test(key)) text = 'unavailable';
      const fact = el('div', 'fact');
      fact.append(el('dt', '', prettyLabel(key)), el('dd', '', text));
      facts.append(fact);
    } else if (key === 'weather') {
      wrap.append(externalBlock('Weather', value, describeWeather));
    } else if (key.toLowerCase().endsWith('exchange')) {
      // Where the rate starts from: the hotel currency, EUR for flights.
      const from = key === 'flightExchange' ? 'EUR'
        : key === 'hotelExchange' ? data.city?.currency
        : data.originalCurrency ?? 'EUR';
      wrap.append(externalBlock(prettyLabel(key), value, (rate) => '1 ' + from + ' = ' + rate + ' ' + (data.currency ?? '')));
    } else if (itemCard(value)) {
      const section = el('div', 'section');
      const card = key === 'hotel' && hotelPriceInCard
        ? hotelCard(value, { currency: data.currency, price: data.pricePerNight })
        : itemCard(value);
      section.append(el('h4', '', prettyLabel(key)), card);
      wrap.append(section);
    }
  }

  if (facts.children.length) wrap.append(facts);
  return wrap;
}

function render(data) {
  resultEl.replaceChildren();

  // A list: cities, flights or hotels.
  if (Array.isArray(data)) {
    if (data.length === 0) {
      resultEl.append(el('p', 'muted', 'Nothing found.'));
      return;
    }
    const list = el('div', 'list');
    for (const item of data) {
      const card = itemCard(item);
      if (card) list.append(card);
    }
    resultEl.append(list);
    return;
  }

  // A single city, flight or hotel.
  const single = itemCard(data);
  if (single) {
    resultEl.append(single);
    return;
  }

  // The rate endpoint answers { status, data }: data is the number.
  if (data.status && 'data' in data || data.status === 'unavailable') {
    resultEl.append(externalBlock('Exchange rate', data, (rate) => '1 EUR = ' + rate + ' ' + currencyInput.value.toUpperCase()));
    return;
  }

  resultEl.append(renderObject(data));
}

function showMessage(text, isError) {
  resultEl.replaceChildren(el('p', isError ? 'error' : 'muted', text));
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const path = buildPath();
  requestEl.textContent = 'GET ' + path;
  statusEl.textContent = '...';
  statusEl.className = 'badge';
  rawEl.textContent = '';

  try {
    const response = await fetch(path);
    statusEl.textContent = response.status + ' ' + response.statusText;
    statusEl.className = 'badge ' + (response.ok ? 'ok' : 'error');

    // The body is JSON for working routes and for errors (400, 404).
    const text = await response.text();
    let data = text;
    try {
      data = JSON.parse(text);
      rawEl.textContent = JSON.stringify(data, null, 2);
    } catch {
      rawEl.textContent = text;
    }

    // Exercise and assignment endpoints do not exist until the student writes them.
    // Nest then answers 404 "Cannot GET ...": a different case from a real
    // "City not found" 404, which comes from an implemented route.
    const isExercise = endpoint.selectedOptions[0].hasAttribute('data-todo');
    const routeMissing = response.status === 404 && String(data.message ?? data).startsWith('Cannot GET');
    if (isExercise && routeMissing) {
      statusEl.textContent = 'Not implemented yet';
      showMessage('This endpoint does not exist in the backend yet. ' +
        'Add the route to travel.controller.ts and the logic to travel.service.ts (see the comments of the exercise) and try again.', true);
    } else if (!response.ok) {
      showMessage(Array.isArray(data.message) ? data.message.join(', ') : (data.message ?? text), true);
    } else {
      render(data);
    }
  } catch (error) {
    statusEl.textContent = 'No answer from the backend';
    statusEl.className = 'badge error';
    showMessage(String(error), true);
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
