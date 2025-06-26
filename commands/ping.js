module.exports = {
  name: "ping",
  description: "Check if the bot is active",
  run: async (sock, msg, args) => {
    await sock.sendMessage(msg.key.remoteJid, {
      text: "🟢 Pong! Bot is active."
    });
  }
};
