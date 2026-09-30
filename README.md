# Oursweeper

A turn-based **competitive multiplayer minesweeper**. Two players share a 10×10 board with
15 mines: every safe cell you reveal scores +1 for you (cascade reveals count too), but hit
a mine and you lose 5 points — and the whole board is revealed. Highest score wins.

Also includes a local hotseat **Co-op** mode for two players on one device.

## Play online

The game is live at **https://oursweeper-25cv.onrender.com**

> Hosted on Render's free tier — the app sleeps after ~15 min idle,
> so the first visit may take ~30s to wake up.

## How it works

- Create a room and share the 6-character room ID; your friend joins from any browser
- Turns alternate automatically — every click (reveal or flag) passes the turn
- Server-authoritative: the board lives on the server, clients only render state
- Rooms are in-memory, so restarting the server clears them

## Run locally

```bash
npm install
npm start
# open http://localhost:3000
```

## Deploy

Any Node host works — the server reads `PORT` from the environment.

**Docker:**

```bash
docker build -t oursweeper .
docker run -p 3000:3000 oursweeper
```

**Render / Railway / Fly.io:** point them at this repo — they detect the Node app and
`npm start` automatically.

Health check endpoint: `GET /healthz` → `{"status":"ok","rooms":0}`

## Stack

Node.js, Express, Socket.IO, vanilla JS canvas client. No build step.
