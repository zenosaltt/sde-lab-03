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
docker-compose.yml            backend, MySQL e Redis
nest-backend/Dockerfile        ambiente Node.js per il laboratorio
nest-backend/src/travel/       entità, controller e servizi del dominio
nest-backend/src/app.module.ts configurazione DB e moduli NestJS
nest-backend/test/             test API
```

Il database contiene solo `City`, `Flight` e `Hotel`. Voli e hotel fanno riferimento a città esistenti. Tutti i prezzi locali sono in **EUR**; il valore in un'altra valuta è calcolato solo nella risposta aggregata, senza modificare il database. L'API non ha autenticazione e i dati sono di esercizio.

## Preparazione

Servono solo Docker e Docker Compose. Node.js e npm sono inclusi nel container del backend. Il progetto può essere eseguito anche in una VM Linux con VirtualBox.

Dalla radice del repository, se `.env` non è presente, copiarlo da `.env.example`:

```bash
cp .env.example .env
```

Avviare l'ambiente e popolare il database:

```bash
./start-lab.sh
```

Lo script esegue questi comandi, utilizzabili anche separatamente:

```bash
docker compose up -d --build --renew-anon-volumes
docker compose exec backend npm run seed
docker compose logs -f backend
```

L'API risponde su `http://localhost:3000`. Il backend attende che MySQL sia pronto; in rete Docker usa `mysql` e `redis` come host, indipendentemente dagli host locali in `.env`. Le tabelle sono create automaticamente da TypeORM (`synchronize: true`), utile per il laboratorio.

### Modificare il codice durante gli esercizi

La cartella `nest-backend` è montata in `/app` tramite un **bind mount**: modificare i file con il proprio editor li aggiorna immediatamente anche nel container, e viceversa. `npm run start:dev` ricompila e riavvia il backend quando cambiano i sorgenti. Il polling permette di rilevare le modifiche anche sui filesystem condivisi di Docker Desktop.

`node_modules` usa un volume separato, così le dipendenze Linux del container non vengono sovrascritte da quelle eventualmente installate sul computer. Quando si modificano `package.json` o `package-lock.json`, rieseguire `./start-lab.sh`: la build usa `npm ci` e `--renew-anon-volumes` rinnova il volume delle dipendenze senza cancellare i dati MySQL.

Per aprire una shell nel backend:

```bash
docker compose exec backend sh
```

`Ctrl+C` interrompe solo la visualizzazione dei log. Per fermare l'ambiente, usare `docker compose down`: i dati MySQL restano nel volume `mysql_data`. Per ripartire da zero, eseguire `docker compose down -v` e poi `./start-lab.sh`; **il primo comando cancella i dati locali**. Lo script di avvio conserva i dati e aggiunge solo quelli mancanti tramite il seed.

## API locale

| Risorsa | Campi richiesti per `POST` | Chiamate |
| --- | --- | --- |
| Città | `name`, `latitude` (−90…90), `longitude` (−180…180) | `GET /cities`, `GET /cities/:id`, `POST /cities` |
| Volo | `departureCityId`, `arrivalCityId`, `departureTime`, `arrivalTime`, `airline`, `priceEur` | `GET /flights`, `GET /flights/:id`, `POST /flights` |
| Hotel | `name`, `pricePerNightEur`, `cityId` | `GET /hotels`, `GET /hotels/:id`, `POST /hotels` |

Gli ID sono interi positivi. Gli orari dei voli sono timestamp ISO 8601 in UTC, per esempio `2026-11-20T09:00:00Z`; l'arrivo deve seguire la partenza. I prezzi sono numeri non negativi. Un ID inesistente produce `404`, un input non valido `400`.

### Database pronto per il laboratorio

`docker compose exec backend npm run seed`, eseguito dalla radice, compila il progetto e prepara **6 città reali, 11 voli fittizi e 13 hotel fittizi**. Richiede MySQL avviato, ma non il server HTTP né l'accesso alle API esterne. Il dataset è in `nest-backend/seed/seed-data.ts`.

Le città sono Roma, Milano, Parigi, Londra, Madrid e Berlino, con coordinate reali. Compagnie, hotel, prezzi in EUR e orari UTC sono dimostrativi. Parigi ha più voli in arrivo e hotel con prezzi diversi; Madrid non ha hotel nel dataset e Berlino non ha voli in arrivo, per esplorare risposte con liste vuote. Gli orari fissi di novembre 2026 non rappresentano disponibilità reali e restano utilizzabili anche dopo quelle date: l'API non filtra i voli per data.

Il comando stampa gli ID effettivi delle città e tre URL pronti da provare dopo l'avvio del backend. Non assumere che gli ID siano da 1 a 6, soprattutto su un database già utilizzato.

È possibile rieseguirlo: aggiunge solo i record mancanti senza cancellare o aggiornare quelli esistenti. Riconosce le città tramite nome e coordinate, i voli tramite città, compagnia e orari, gli hotel tramite città e nome; i prezzi esistenti vengono conservati. Eseguire un solo seed alla volta. Se un'esecuzione si interrompe, rilanciarla completa i dati mancanti. Su un database non vuoto, il numero totale di record può superare 6/11/13.

### Inserimento manuale facoltativo

Eseguire in ordine, sostituendo gli ID se il database contiene già dati:

```bash
curl -sS -X POST http://localhost:3000/cities -H 'Content-Type: application/json' -d '{"name":"Roma","latitude":41.9028,"longitude":12.4964}'
curl -sS -X POST http://localhost:3000/cities -H 'Content-Type: application/json' -d '{"name":"Parigi","latitude":48.8566,"longitude":2.3522}'
curl -sS -X POST http://localhost:3000/flights -H 'Content-Type: application/json' -d '{"departureCityId":1,"arrivalCityId":2,"departureTime":"2026-11-20T09:00:00Z","arrivalTime":"2026-11-20T11:00:00Z","airline":"Demo Air","priceEur":120}'
curl -sS -X POST http://localhost:3000/hotels -H 'Content-Type: application/json' -d '{"name":"Hotel Demo","pricePerNightEur":90,"cityId":2}'
curl -sS 'http://localhost:3000/cities/2/travel-options?currency=USD'
```

Si possono eseguire le stesse richieste con Postman. L'ultima risposta contiene la città, i voli in arrivo, gli hotel della città, il meteo corrente e il tasso EUR→USD. `ExternalService.rate` restituisce un semplice `number`: per esempio, la sezione del cambio è `"exchange": { "status": "ok", "data": 1.08 }`. `priceEur` e `pricePerNightEur` restano gli importi originali; `price` e `pricePerNight` sono gli importi convertiti. Il cambio Frankfurter è aggiornato giornalmente, quindi non rappresenta un prezzo garantito per una prenotazione futura.

### Chiamare Frankfurter

In `nest-backend/src/service/external.service.ts`, `rate(from, to)` restituisce il tasso di cambio dalla valuta di origine a quella di destinazione. L'helper `json` gestisce timeout e stato HTTP; il servizio valida e restituisce il solo tasso numerico, e il controller usa `available` per gestire gli errori.

`GET /rate/:from/:to` espone il cambio tra due valute, per esempio `/rate/EUR/USD`. `travel-options` usa `rate("EUR", currency)` per convertire i prezzi originali in EUR nella valuta richiesta. La funzione chiama Frankfurter anche quando le due valute coincidono; un errore esterno può quindi rendere indisponibile anche il cambio EUR→EUR.

Se Open-Meteo o Frankfurter non rispondono entro 3 secondi o restituiscono un errore, la risposta rimane `200` con `status: "unavailable"` nella rispettiva sezione. Se manca il cambio, gli importi convertiti sono `null`; i prezzi EUR rimangono disponibili. I dati locali, invece, devono essere validi: una città inesistente produce `404`. Il timeout riguarda ciascuna chiamata esterna, avviata in parallelo.

## Scaletta suggerita (120 minuti)

| Minuti | Attività |
| --- | --- |
| 0–10 | Richiamo di risorse, URI, metodi e codici HTTP dal laboratorio REST Basics |
| 10–30 | Schema del dominio; servizio interno ed esterno; composizione, timeout e risposta parziale |
| 30–55 | Avvio dell'ambiente già popolato ed esplorazione di città, voli e hotel |
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
