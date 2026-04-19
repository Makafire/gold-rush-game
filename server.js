const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.static(__dirname));

const port = process.env.PORT || 3000;

let players = new Map();
let gold = { x: 400, y: 300 };

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

wss.on('connection', (ws) => {
    const playerId = generateId();
    
    players.set(playerId, {
        id: playerId,
        x: 200 + Math.random() * 200,
        y: 200 + Math.random() * 200,
        score: 0
    });
    
    console.log('Игрок ' + playerId + ' подключился. Всего: ' + players.size);
    
    ws.send(JSON.stringify({
        type: 'init',
        playerId: playerId,
        players: Object.fromEntries(players),
        gold: gold
    }));
    
    broadcast({ type: 'playerJoined', player: players.get(playerId) }, ws);
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'move') {
                const player = players.get(playerId);
                if (player) {
                    player.x = data.x;
                    player.y = data.y;
                    
                    const dist = Math.hypot(player.x - gold.x, player.y - gold.y);
                    if (dist < 35) {
                        player.score += 1;
                        gold.x = 100 + Math.random() * 800;
                        gold.y = 100 + Math.random() * 600;
                        
                        broadcast({
                            type: 'goldUpdate',
                            gold: gold,
                            players: Object.fromEntries(players)
                        });
                    } else {
                        broadcast({
                            type: 'playerMove',
                            playerId: playerId,
                            x: player.x,
                            y: player.y
                        });
                    }
                }
            }
        } catch (e) {
            console.error('Ошибка:', e);
        }
    });
    
    ws.on('close', () => {
        players.delete(playerId);
        console.log('Игрок ' + playerId + ' вышел. Осталось: ' + players.size);
        broadcast({ type: 'playerLeft', playerId: playerId });
    });
});

function broadcast(data, excludeWs) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Отдаём HTML из отдельного файла
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(port, '0.0.0.0', () => {
    console.log('========================================');
    console.log(' ИГРА ЗАПУЩЕНА!');
    console.log(' http://localhost:' + port);
    console.log('========================================');
});
