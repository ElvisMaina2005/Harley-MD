require('dotenv').config();

const settings = {
  packname: 'Harley-MD',
  author: '‎',
  botName: "Harley-MD",
  botOwner: process.env.BOT_OWNER_NAME || 'Harley-MD User',
 ownerNumber: process.env.BOT_OWNER_NUMBER || '', 
  giphyApiKey: 'qnl7ssQChTdPjsKta2Ax2LMaGXz303tq',
  commandMode: "public",
  maxStoreMessages: 20, 
  storeWriteInterval: 10000,
  description: "This is a bot for managing group commands and automating tasks.",
  version: "1.0.0",
 updateZipUrl: "https://github.com/ElvisMaina2005/Harley-MD/archive/refs/heads/main.zip",
  // Media / Knight API (song, video, cards, etc.)
  knightApiUrl: process.env.KNIGHT_API_URL || 'https://knightbotapi.stream',
  knightApiKey: process.env.KNIGHT_API_KEY || 'knight',
  mediaApiUrl: process.env.MEDIA_API_URL || 'https://knightbotapi.stream',
  mediaApiKey: process.env.MEDIA_API_KEY || 'knight',
  princeApiUrl: process.env.PRINCE_API_URL || 'https://api.princetechn.com',
  princeApiKey: process.env.PRINCE_API_KEY || 'prince',
};

module.exports = settings;
