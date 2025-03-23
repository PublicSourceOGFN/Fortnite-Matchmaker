const Fastify = require('fastify');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const axios = require('axios');

const fastify = Fastify({ logger: true });
const wsPort = 81;
const websiteandapiport = 3000;
const wss = new WebSocketServer({ port: wsPort });

let queue = new Map();
let webhookSent = false;
const discordwebhook = "https://discord.com/api/webhooks/1353109019090485288/ChILcIH1S55G-29J1ph5kLQT1nnQFSDkLdIzNlSeYfM-sqnbRqchSoVqyS3Ql_CeDVqj";

async function sendWebhookMessage() {
    if (!webhookSent) {
        try {
            await axios.post(discordwebhook, {
                content: "Matchmaker is open!",
                embeds: [
                    {
                        title: "Matchmaker Status", // u can change it dw
                        description: "Works", // u can change it dw
                        color: 3066993, // u can change it dw
                        timestamp: new Date().toISOString(), // Do NOT touch 
                        footer: {
                            text: "Fortnite Matchmaker System" // u can change it dw
                        }
                    }
                ]
            });
            webhookSent = true;
            console.log("Discord webhook sent!"); // u can change the text if u want
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
    const ticketId = crypto.randomUUID();
    const matchId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    
    const messages = [
        { delay: 500, state: 'Searching', payload: { playerId } },
        { delay: 1500, state: 'InQueue', payload: { ticketId, position: queue.size } },
        { delay: 4000, state: 'FindingMatch', payload: { estimatedWait: queue.size * 2 } },
        { delay: 7000, state: 'MatchFound', payload: { matchId } },
        { delay: 9000, name: 'GameStart', payload: { matchId, sessionId, joinDelay: 2 } }
    ];

    messages.forEach(({ delay, state, name = 'StatusUpdate', payload = {} }) => {
        setTimeout(() => {
            if (ws.readyState === ws.OPEN) {
                console.log(`Player ${playerId}: ${state}`);
                ws.send(JSON.stringify({ name, payload: { state, ...payload } }));
            }
        }, delay);
    });
}

fastify.get('/status', async (request, reply) => {
    return { activePlayers: queue.size }; // yeah
});

fastify.listen({ port: websiteandapiport }, (err, address) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Fastify API running at ${address}`);
});