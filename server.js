const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Development ke liye theek hai
    methods: ["GET", "POST"]
  }
});

// rooms[roomId] = { players: { socketId: role }, fen: '...' }
const rooms = {};

io.on('connection', (socket) => {
  console.log('🚀 Naya khiladi connect hua', socket.id);

  // 1. Jab koi room join kare (Frontend ke 'joinRoom' se match karta hua)
  socket.on("joinRoom", ({ roomId, role }) => {
    if (!roomId) {
      console.error("Error: Room ID nahi hai");
      return;
    }

    // Room banao agar nahi hai
    if (!rooms[roomId]) {
      rooms[roomId] = { players: {}, fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" }; // Starting FEN
    }

    // Socket ko room join karao
    socket.join(roomId);
    // Player ko room state mein daalo
    rooms[roomId].players[socket.id] = role; // Hum frontend se bheje gaye role par bharosa kar rahe hain

    console.log(`👑 Khiladi ${socket.id} (Role: ${role}) room '${roomId}' mein daakhil!`);

    // Naye player ko current game state (FEN) bhejo
    socket.emit("syncState", { fen: rooms[roomId].fen });
  });

  // 2. Jab koi chaal chale (Frontend ke 'makeMove' se match karta hua)
  socket.on("makeMove", ({ roomId, move, fen, pgn }) => {
    if (!rooms[roomId]) return; // Agar room hi nahi hai toh kya karein

    // Server par FEN update karo
    rooms[roomId].fen = fen;

    console.log(`🤯 Oho! Room '${roomId}' mein chaal chali gayi: ${move.from} se ${move.to}.`);
    
    // Doosre player ko batao (Frontend ke 'opponentMove' se match karta hua)
    socket.to(roomId).emit("opponentMove", { fen: fen });
  });

  // 3. Jab koi board reset kare (Frontend ke 'syncState' se match karta hua)
  socket.on("syncState", ({ roomId, fen, pgn }) => {
    if (!rooms[roomId]) return;

    // Server par FEN update karo
    rooms[roomId].fen = fen;

    console.log(`🔄 Ruko! Room '${roomId}' mein sab ulta pulta. Board reset ho raha hai...`);

    // Sabko batao ki "Naya game, shuru se!" (Frontend ke 'syncState' se match karta hua)
    // Yahan hum 'io.in' istemaal kar rahe hain taaki sender ko bhi update mile
    io.in(roomId).emit("syncState", { fen: fen });
  });

  // 4. Jab koi room chhod de (Frontend ke 'leaveRoom' se match karta hua)
  // YAHAN THI Galti: 'nbsp;' hata diya gaya hai
  socket.on("leaveRoom", ({ roomId }) => {
    if (rooms[roomId] && rooms[roomId].players[socket.id]) {
      socket.leave(roomId);
      delete rooms[roomId].players[socket.id]; // Player ko state se hatao
      console.log(`😉 User ${socket.id} room '${roomId}' se nikal liya.`);
    }
  });

  // 5. Jab koi disconnect ho jaaye
  socket.on('disconnect', () => {
    // Pata lagao yeh socket kis room mein tha
    for (const roomId of Object.keys(rooms)) {
      if (rooms[roomId].players[socket.id]) {
        delete rooms[roomId].players[socket.id];
        console.log(`👋 User ${socket.id} (room ${roomId}) ka connection gaya...`);
        // Room mein bache hue logon ko batao (optional)
        socket.to(roomId).emit('peer_left', { socketId: socket.id });

        // Agar room khaali ho gaya, toh delete kardo
        if (Object.keys(rooms[roomId].players).length === 0) {
          delete rooms[roomId];
          console.log(`🧹 Room ${roomId} khaali hai, delete kar raha hoon.`);
        }
        break; // Jaise hi mil jaaye, loop rok do
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server ${PORT} par chal raha hai!`));