const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname + '/public'));

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
    // Place mines
    let minesPlaced = 0;
    while (minesPlaced < MINE_COUNT) {
        const x = Math.floor(Math.random() * GRID_SIZE);
        const y = Math.floor(Math.random() * GRID_SIZE);
        if (!board[y][x].isMine) {
            board[y][x].isMine = true;
            minesPlaced++;
        }
    }
    // Count adjacent mines
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

let game = {
    board: createBoard(),
    scores: { 1: 0, 2: 0 },
    currentPlayer: 1,
    gameOver: false,
    players: []
};

function revealCell(x, y, player) {
    if (game.gameOver) return;
    const cell = game.board[y][x];
    if (cell.isRevealed || cell.isFlagged) return;
    cell.isRevealed = true;
    if (cell.isMine) {
        game.gameOver = true;
        game.scores[player] -= 5;
        revealAll();
        return;
    }
    game.scores[player]++;
    if (cell.adjacentMines === 0) {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx, ny = y + dy;
                if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
                    if (!game.board[ny][nx].isRevealed) {
                        revealCell(nx, ny, player);
                    }
                }
            }
        }
    }
}

function revealAll() {
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            game.board[y][x].isRevealed = true;
        }
    }
}

function toggleFlag(x, y) {
    if (game.gameOver) return;
    const cell = game.board[y][x];
    if (!cell.isRevealed) {
        cell.isFlagged = !cell.isFlagged;
    }
}

io.on('connection', (socket) => {
    // Assign player number
    if (game.players.length < 2) {
        const playerNum = game.players.length + 1;
        socket.playerNum = playerNum;
        game.players.push(playerNum);
        socket.emit('playerNum', playerNum);
    } else {
        socket.emit('full');
        return;
    }
    socket.emit('gameState', game);

    socket.on('reveal', ({ x, y }) => {
        if (game.currentPlayer !== socket.playerNum || game.gameOver) return;
        revealCell(x, y, socket.playerNum);
        game.currentPlayer = game.currentPlayer === 1 ? 2 : 1;
        io.emit('gameState', game);
    });

    socket.on('flag', ({ x, y }) => {
        if (game.currentPlayer !== socket.playerNum || game.gameOver) return;
        toggleFlag(x, y);
        game.currentPlayer = game.currentPlayer === 1 ? 2 : 1;
        io.emit('gameState', game);
    });

    socket.on('newGame', () => {
        if (game.players.length === 2) {
            game = {
                board: createBoard(),
                scores: { 1: 0, 2: 0 },
                currentPlayer: 1,
                gameOver: false,
                players: [1, 2]
            };
            io.emit('gameState', game);
        }
    });

    socket.on('disconnect', () => {
        game = {
            board: createBoard(),
            scores: { 1: 0, 2: 0 },
            currentPlayer: 1,
            gameOver: false,
            players: []
        };
        io.emit('gameState', game);
    });
});

server.listen(3000, () => console.log('Server running on http://localhost:3000'));