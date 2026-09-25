const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname + '/public'));

app.get('/healthz', (req, res) => {
    res.json({ status: 'ok', rooms: Object.keys(rooms).length });
});

const GRID_SIZE = 10;
const MINE_COUNT = 15;

function createBoard() {
    const board = [];
    for (let y = 0; y < GRID_SIZE; y++) {
        board[y] = [];
        for (let x = 0; x < GRID_SIZE; x++) {
            board[y][x] = {
                isMine: false,
                isRevealed: false,
                isFlagged: false,
                adjacentMines: 0
            };
        }
    }
    
    let minesPlaced = 0;
    while (minesPlaced < MINE_COUNT) {
        const x = Math.floor(Math.random() * GRID_SIZE);
        const y = Math.floor(Math.random() * GRID_SIZE);
        if (!board[y][x].isMine) {
            board[y][x].isMine = true;
            minesPlaced++;
        }
    }
    
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (!board[y][x].isMine) {
                let count = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = x + dx, ny = y + dy;
                        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && board[ny][nx].isMine) {
                            count++;
                        }
                    }
                }
                board[y][x].adjacentMines = count;
            }
        }
    }
    return board;
}

const rooms = {}; // roomId -> { board, scores, currentPlayer, gameOver, players: [socketIds] }

function revealCell(room, x, y, player) {
    if (room.gameOver) return;
    const cell = room.board[y][x];
    if (cell.isRevealed || cell.isFlagged) return;
    cell.isRevealed = true;
    if (cell.isMine) {
        room.gameOver = true;
        room.scores[player] -= 5;
        revealAll(room);
        return;
    }

    room.scores[player]++;
    if (cell.adjacentMines === 0) {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx, ny = y + dy;
                if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
                    if (!room.board[ny][nx].isRevealed) {
                        revealCell(room, nx, ny, player);
                    }
                }
            }
        }
    }
}

function revealAll(room) {
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            room.board[y][x].isRevealed = true;
        }
    }
}

function toggleFlag(room, x, y) {
    if (room.gameOver) return;
    const cell = room.board[y][x];
    if (!cell.isRevealed) {
        cell.isFlagged = !cell.isFlagged;
    }
}

io.on('connection', (socket) => {
    socket.on('createRoom', (callback) => {
        let roomId;
        do {
            roomId = Math.random().toString(36).substr(2, 6);
        } while (rooms[roomId]);
        
        rooms[roomId] = {
            board: createBoard(),
            scores: { 1: 0, 2: 0 },
            currentPlayer: 1,
            gameOver: false,
            players: [socket.id]
        };
        socket.join(roomId);
        socket.roomId = roomId;
        socket.playerNum = 1;
        callback({ roomId, playerNum: 1 });
        io.to(roomId).emit('gameState', rooms[roomId]);
    });

    socket.on('joinRoom', (roomId, callback) => {
        const room = rooms[roomId];
        if (!room) {
            callback({ error: 'Room not found' });
            return;
        }
        if (room.players.length >= 2) {
            callback({ error: 'Room is full' });
            return;
        }
        room.players.push(socket.id);
        socket.join(roomId);
        socket.roomId = roomId;
        socket.playerNum = 2;
        callback({ roomId, playerNum: 2 });
        io.to(roomId).emit('gameState', room);
    });

    socket.on('reveal', ({ x, y }) => {
        const roomId = socket.roomId;
        if (!roomId) return;
        const room = rooms[roomId];
        if (!room || room.gameOver) return;
        if (room.currentPlayer !== socket.playerNum) return;
        revealCell(room, x, y, socket.playerNum);
        room.currentPlayer = room.currentPlayer === 1 ? 2 : 1;
        io.to(roomId).emit('gameState', room);
    });

    socket.on('flag', ({ x, y }) => {
        const roomId = socket.roomId;
        if (!roomId) return;
        const room = rooms[roomId];
        if (!room || room.gameOver) return;
        if (room.currentPlayer !== socket.playerNum) return;
        toggleFlag(room, x, y);
        room.currentPlayer = room.currentPlayer === 1 ? 2 : 1;
        io.to(roomId).emit('gameState', room);
    });

    socket.on('newGame', () => {
        const roomId = socket.roomId;
        if (!roomId) return;
        const room = rooms[roomId];
        if (!room || room.players.length < 2) return;
        room.board = createBoard();
        room.scores = { 1: 0, 2: 0 };
        room.currentPlayer = 1;
        room.gameOver = false;
        io.to(roomId).emit('gameState', room);
    });

    socket.on('disconnect', () => {
        const roomId = socket.roomId;
        if (!roomId) return;
        const room = rooms[roomId];
        if (!room) return;
        
        room.players = room.players.filter(id => id !== socket.id);
        if (room.players.length === 0) {
            delete rooms[roomId];
        } else {
            io.to(roomId).emit('gameState', room);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));