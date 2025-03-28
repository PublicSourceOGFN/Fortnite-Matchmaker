const Fastify = require('fastify');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const axios = require('axios');

const fastify = Fastify({ logger: true });
const ticketMap = new Map(); 
fastify.register(require('@fastify/cors'), { origin: '*' });

const wsPort = 81;
const websiteandapiport = 3000;
const wss = new WebSocketServer({ port: wsPort });

let queue = new Map(); // THIS ARE NOT QUEUES THEN U EXPECT LIKE QUEUE SYSTEMS ON GAMESERVER ETC, THIS IS JUST A MAP FOR THE PLAYERS CONNECTED TO THE WEBSOCKET SERVER
let webhookSent = false;
const discordwebhook = "ur_discord_webhook";

async function sendWebhookMessage() {
    if (!webhookSent) {
        try {
            await axios.post(discordwebhook, {
                content: "Matchmaker is open!",
                embeds: [
                    {
                        title: "Matchmaker Status", 
                        description: "Works", 
                        color: 3066993, 
                        timestamp: new Date().toISOString(), 
                        footer: {
                            text: "Fortnite Matchmaker System" 
                        }
                    }
                ]
            });
            webhookSent = true;
            console.log("Discord webhook sent!"); 
        } catch (error) {
            console.error("Failed to send Discord webhook:", error); 
        }
    }
}

wss.on('listening', () => {
    console.log(`Matchmaker WebSocket running on port ${wsPort}`);
    sendWebhookMessage();
});

wss.on('connection', (ws) => {
    if (ws.protocol?.toLowerCase().includes("xmpp")) {
        return ws.close();
    }
    
    const playerId = crypto.randomUUID();
    queue.set(playerId, ws);
    console.log(`Player ${playerId} connected. Queue size: ${queue.size}`);
    
    handlePlayer(ws, playerId);

    ws.on('close', () => {
        queue.delete(playerId);
        console.log(`Player ${playerId} disconnected. Queue size: ${queue.size}`);
    });
});

function handlePlayer(ws, playerId) {
    const timestamp = Date.now();
    const ticketId = crypto.createHash('md5').update(`1${timestamp}`).digest('hex');
    const matchId = crypto.createHash('md5').update(`2${timestamp}`).digest('hex');
    const sessionId = crypto.createHash('md5').update(`3${timestamp}`).digest('hex');
    
    const messages = [
        { delay: 200, name: 'StatusUpdate', payload: { state: 'Connecting' } }, // 2 milliseconds lol 
        { delay: 1000, name: 'StatusUpdate', payload: { state: 'Waiting', totalPlayers: queue.size, connectedPlayers: queue.size } }, // 1 second
        { delay: 2000, name: 'StatusUpdate', payload: { state: 'Queued', ticketId, queuedPlayers: queue.size, estimatedWaitSec: queue.size * 2 } }, // 2 seconds
        { delay: 20000, name: 'StatusUpdate', payload: { state: 'SessionAssignment', matchId, sessionId } }, // 20 seconds
        { delay: 23000, name: 'Play', payload: { matchId, sessionId, joinDelaySec: 1 } } // 23 seconds
    ];

    messages.forEach(({ delay, name, payload }) => {
        setTimeout(() => {
            if (ws.readyState === ws.OPEN) {
                console.log(`Player ${playerId}: ${payload.state}`);
                ws.send(JSON.stringify({ name, payload }));
            }
        }, delay);
    });
}

fastify.get('/', async (request, reply) => {
    return { message: "Matchmaker is running!" };
});

fastify.get('/status', async (reply) => {
    return { activePlayers: queue.size };
});

fastify.get('/ticketid', async (request, reply) => {
    const clientIp = request.ip; 

    if (!ticketMap.has(clientIp)) {
        const ticketId = crypto.createHash('md5').update(`1${Date.now()}`).digest('hex');
        ticketMap.set(clientIp, ticketId);
    }

    return { ticketId: ticketMap.get(clientIp) };
});

fastify.listen({ port: websiteandapiport }, (err, address) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Matchmaker running at ${address}`);
});