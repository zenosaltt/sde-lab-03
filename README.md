# Laboratorio REST avanzato: opzioni di viaggio

Bozza didattica per un laboratorio di **2 ore**. Una API NestJS combina tre risorse locali in MySQL (città, voli, hotel) con due servizi esterni: [Open-Meteo](https://open-meteo.com/en/docs) per il meteo corrente e [Frankfurter](https://frankfurter.dev/) per i tassi di cambio. Non implementa prenotazioni o pagamenti.

## Obiettivi

Alla fine del laboratorio, lo studente sa:

1. distinguere dati gestiti dall'applicazione da dati ottenuti da servizi esterni;
2. leggere relazioni tra risorse REST e comporre una risposta utile al client;
3. interpretare `400`, `404`, `201` e una risposta parziale con `200`;
4. spiegare perché una chiamata esterna ha un timeout e come gestire la sua indisponibilità.

## Struttura

```text
docker-compose.yml            MySQL locale
nest-backend/src/travel/       entità, controller e servizi del dominio
nest-backend/src/app.module.ts configurazione DB e moduli NestJS
nest-backend/test/             test API
```

Il database contiene solo `City`, `Flight` e `Hotel`. Voli e hotel fanno riferimento a città esistenti. Tutti i prezzi locali sono in **EUR**; il valore in un'altra valuta è calcolato solo nella risposta aggregata, senza modificare il database. L'API non ha autenticazione e i dati sono di esercizio.

## Preparazione

Servono Node.js, npm e Docker Compose. Il progetto può essere eseguito in una VM Linux con VirtualBox, ma la VM non è necessaria se questi strumenti sono già disponibili. Se si distribuisce una VM per il corso, verificare in anticipo che l'immagine completa con Docker e dipendenze rientri nella dimensione prevista di circa 10–15 GB.

```bash
docker compose up -d
cd nest-backend
npm ci
npm run start:dev
```

Il repository include già `.env`; se manca, creare il file a partire da `.env.example` e impostare le credenziali desiderate. L'API risponde su `http://localhost:3000`. La configurazione del database usa `../.env`, quindi i comandi NestJS vanno eseguiti da `nest-backend`. Le tabelle sono create automaticamente da TypeORM (`synchronize: true`): utile per il laboratorio, non per un database di produzione. Per ripartire da zero: `docker compose down -v` dalla radice del progetto; **cancella i dati locali**.

## API locale

| Risorsa | Campi richiesti per `POST` | Chiamate |
| --- | --- | --- |
| Città | `name`, `latitude` (−90…90), `longitude` (−180…180) | `GET /cities`, `GET /cities/:id`, `POST /cities` |
| Volo | `departureCityId`, `arrivalCityId`, `departureTime`, `arrivalTime`, `airline`, `priceEur` | `GET /flights`, `GET /flights/:id`, `POST /flights` |
| Hotel | `name`, `pricePerNightEur`, `cityId` | `GET /hotels`, `GET /hotels/:id`, `POST /hotels` |

Gli ID sono interi positivi. Gli orari dei voli sono timestamp ISO 8601 in UTC, per esempio `2026-11-20T09:00:00Z`; l'arrivo deve seguire la partenza. I prezzi sono numeri non negativi. Un ID inesistente produce `404`, un input non valido `400`.

### Dati di esempio

Eseguire in ordine, sostituendo gli ID se il database contiene già dati:

```bash
curl -sS -X POST http://localhost:3000/cities -H 'Content-Type: application/json' -d '{"name":"Roma","latitude":41.9028,"longitude":12.4964}'
curl -sS -X POST http://localhost:3000/cities -H 'Content-Type: application/json' -d '{"name":"Parigi","latitude":48.8566,"longitude":2.3522}'
curl -sS -X POST http://localhost:3000/flights -H 'Content-Type: application/json' -d '{"departureCityId":1,"arrivalCityId":2,"departureTime":"2026-11-20T09:00:00Z","arrivalTime":"2026-11-20T11:00:00Z","airline":"Demo Air","priceEur":120}'
curl -sS -X POST http://localhost:3000/hotels -H 'Content-Type: application/json' -d '{"name":"Hotel Demo","pricePerNightEur":90,"cityId":2}'
curl -sS 'http://localhost:3000/cities/2/travel-options?currency=USD'
```

Si possono eseguire le stesse richieste con Postman. L'ultima risposta contiene la città, i voli in arrivo, gli hotel della città, il meteo corrente e il tasso EUR→USD. `priceEur` e `pricePerNightEur` restano gli importi originali; `price` e `pricePerNight` sono gli importi convertiti. Il cambio Frankfurter è aggiornato giornalmente, quindi non rappresenta un prezzo garantito per una prenotazione futura.

Se Open-Meteo o Frankfurter non rispondono entro 3 secondi o restituiscono un errore, la risposta rimane `200` con `status: "unavailable"` nella rispettiva sezione. Se manca il cambio, gli importi convertiti sono `null`; i prezzi EUR rimangono disponibili. I dati locali, invece, devono essere validi: una città inesistente produce `404`. Il timeout riguarda ciascuna chiamata esterna, avviata in parallelo.

## Scaletta suggerita (120 minuti)

| Minuti | Attività |
| --- | --- |
| 0–10 | Richiamo di risorse, URI, metodi e codici HTTP dal laboratorio REST Basics |
| 10–30 | Schema del dominio; servizio interno ed esterno; composizione, timeout e risposta parziale |
| 30–55 | Avvio dell'ambiente e creazione delle due città, del volo e dell'hotel |
| 55–65 | Pausa |
| 65–95 | Esplorazione di `travel-options`; cambiare valuta e confrontare prezzi e tasso |
| 95–115 | Esercizi sugli errori e breve discussione delle scelte di progetto |
| 115–120 | Consegna tramite form e riepilogo |

## Esercizi e consegna

1. Creare una nuova città con coordinate valide e almeno un hotel; richiedere le sue opzioni di viaggio in una valuta diversa da EUR. Spiegare perché il campo `pricePerNightEur` non cambia.
2. Provare un `cityId` inesistente nella creazione di un hotel e un valore di latitudine fuori intervallo. Annotare i codici HTTP e il motivo della differenza rispetto a un servizio esterno indisponibile.
3. **Facoltativo:** modificare temporaneamente l'URL di uno dei servizi in `external.service.ts` e ripetere la richiesta aggregata. Individuare `status: "unavailable"` e i dati ancora presenti. Ripristinare poi l'URL.

Consegnare nel form indicato dai docenti **uno screenshot o il JSON** della risposta di `GET /cities/:id/travel-options?currency=USD` con città e hotel creati, più due righe che spiegano un caso di errore osservato. Non inserire segreti o file `.env` nella consegna.

## Limiti intenzionali

La disponibilità dei servizi esterni richiede rete. Il meteo è corrente, non è una previsione legata alla data del volo; per mantenere il laboratorio breve non sono previsti filtri temporali, prenotazioni, utenti, paginazione o operazioni di modifica e cancellazione. Il codice mostra un'orchestrazione minima in un solo modulo NestJS.
