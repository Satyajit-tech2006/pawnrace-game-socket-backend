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

// YEH HAI NAYA CHANGE: 'rooms' ka structure badal gaya hai
// rooms[roomId] = { players: { socketId: 'w' ya 'b' }, fen: '...' }
const rooms = {};

io.on('connection', (socket) => {
  console.log('噫 Naya khiladi connect hua', socket.id);

  // 1. YEH HAI NAYA CHANGE: 'joinRoom' logic poori tarah badal gaya hai
  socket.on("joinRoom", ({ roomId, playerColor }) => { // 'role' ki jagah 'playerColor' ('w', 'b', ya undefined)
    if (!roomId) {
      console.error("Error: Room ID nahi hai");
      socket.emit("error", { message: "Room ID nahi di gayi." });
      return;
    }

    let assignedColor = null;

    // 1. Agar room nahi hai (Yeh CREATOR hai)
    if (!rooms[roomId]) {
      // Creator ko color bhejna zaroori hai
      if (playerColor !== 'w' && playerColor !== 'b') {
        socket.emit("error", { message: "Naya room banate waqt color (w/b) zaroori hai." });
        return;
      }
      rooms[roomId] = { 
        players: {}, 
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" // Starting FEN
      };
      assignedColor = playerColor;
      
      console.log(`荘 Khiladi ${socket.id} ne room '${roomId}' banaya as ${assignedColor}`);
    }
    // 2. Agar room pehle se hai (Yeh JOINER hai)
    else {
      const playersInRoom = Object.values(rooms[roomId].players); // ['w'] ya ['b']
      
      // Check karo room full toh nahi
      if (playersInRoom.length >= 2) {
        socket.emit("error", { message: "Room pehle se full hai." });
        return;
      }
      
      // Check karo pehla player hai ya nahi
      if (playersInRoom.length === 0) {
         // Aisa nahi hona chahiye, par safety ke liye
         socket.emit("error", { message: "Room khaali hai, creator maujood nahi." });
         return;
      }

      // Dekho konsa color bacha hai
      const creatorColor = playersInRoom[0];
      assignedColor = (creatorColor === 'w') ? 'b' : 'w'; // Creator ka ulta color do
      
      console.log(`荘 Khiladi ${socket.id} ne room '${roomId}' join kiya as ${assignedColor}`);
    }

    // Socket ko room join karao
    socket.join(roomId);
    // Player ko room state mein daalo (Color ke saath)
    rooms[roomId].players[socket.id] = assignedColor;

    // Naye player ko current game state (FEN) bhejo
    socket.emit("syncState", { fen: rooms[roomId].fen });
    
    // Naye player ko uska color batao (Frontend isse use karke board set karega)
    socket.emit("colorAssigned", { color: assignedColor });
    
    // Agar ab 2 log ho gaye, toh dono ko batao game shuru
    if (Object.keys(rooms[roomId].players).length === 2) {
      io.in(roomId).emit("gameStart"); // Sabko (creator aur joiner) batao
    }
  });

  // 2. Jab koi chaal chale (Frontend ke 'makeMove' se match karta hua)
  // Iss section mein koi change nahi chahiye
  socket.on("makeMove", ({ roomId, move, fen, pgn }) => {
    if (!rooms[roomId]) return; 

    rooms[roomId].fen = fen;

    console.log(`､ｯ Oho! Room '${roomId}' mein chaal chali gayi: ${move.from} se ${move.to}.`);
    
    socket.to(roomId).emit("opponentMove", { fen: fen });
  });

  // 3. Jab koi board reset kare (Frontend ke 'syncState' se match karta hua)
  // Iss section mein koi change nahi chahiye
  socket.on("syncState", ({ roomId, fen, pgn }) => {
    if (!rooms[roomId]) return;

    rooms[roomId].fen = fen;

    console.log(`売 Ruko! Room '${roomId}' mein sab ulta pulta. Board reset ho raha hai...`);

    io.in(roomId).emit("syncState", { fen: fen });
  });

  // 4. Jab koi room chhod de (Frontend ke 'leaveRoom' se match karta hua)
  // Iss section mein koi change nahi chahiye
  socket.on("leaveRoom", ({ roomId }) => {
    if (rooms[roomId] && rooms[roomId].players[socket.id]) {
      socket.leave(roomId);
      delete rooms[roomId].players[socket.id];
      console.log(` User ${socket.id} room '${roomId}' se nikal liya.`);
      
      // Room mein bache hue logon ko batao
      socket.to(roomId).emit('peer_left');
    }
  });

  // 5. Jab koi disconnect ho jaaye
  // Iss section mein 'peer_left' event thoda update kar diya hai
  socket.on('disconnect', () => {
    for (const roomId of Object.keys(rooms)) {
      if (rooms[roomId].players[socket.id]) {
        const leftColor = rooms[roomId].players[socket.id];
        delete rooms[roomId].players[socket.id];
        console.log(`窓 User ${socket.id} (Color: ${leftColor}, Room: ${roomId}) ka connection gaya...`);
        
        // Room mein bache hue logon ko batao
        socket.to(roomId).emit('peer_left', { socketId: socket.id, color: leftColor });

        // Agar room khaali ho gaya, toh delete kardo
        if (Object.keys(rooms[roomId].players).length === 0) {
          delete rooms[roomId];
          console.log(`ｧｹ Room ${roomId} khaali hai, delete kar raha hoon.`);
        }
        break; 
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server ${PORT} par chal raha hai!`));