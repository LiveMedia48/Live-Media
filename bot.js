const { default: makeWASocket, useSingleFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const { Boom } = require('@hapi/boom');
const fs = require("fs");
const path = require("path");
const P = require("pino");

// Load config
const config = require("./config");

// Load all commands
const commands = {};
const commandPath = path.join(__dirname, "commands");
fs.readdirSync(commandPath).forEach(file => {
  if (file.endsWith(".js")) {
    const command = require(path.join(commandPath, file));
    commands[command.name] = command;
  }
});

// Auth State
const { state, saveState } = useSingleFileAuthState('./auth_info.json');

// Main Function
async function startBot() {
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    logger: P({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state
  });

  sock.ev.on("creds.update", saveState);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const shouldReconnect = (lastDisconnect.error = Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log("Connection closed. Reconnecting...", shouldReconnect);
      if (shouldReconnect) startBot();
    } else if (connection === "open") {
      console.log("✅ Bot connected!");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!text || !text.startsWith(config.prefix)) return;

    const [cmdName, ...args] = text.slice(config.prefix.length).trim().split(/\s+/);
    const command = commands[cmdName.toLowerCase()];
    if (command) {
      try {
        await command.run(sock, msg, args);
      } catch (e) {
        console.error("Command error:", e);
        await sock.sendMessage(msg.key.remoteJid, { text: "❌ Command error." });
      }
    }
  });
}

// Start
startBot();
