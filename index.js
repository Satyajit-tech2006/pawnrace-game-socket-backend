const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  // 1. Join Room (Matches Frontend 'join_room')
  socket.on("join_room", (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room: ${roomId}`);
  });

  // 2. Make Move (Matches Frontend 'make_move')
  socket.on("make_move", (data) => {
    // Broadcast to everyone else in the room
    socket.to(data.roomId).emit("receive_move", data);
    console.log(`Move in ${data.roomId}`);
  });

  // 3. Chat (Matches Frontend 'send_message')
  socket.on("send_message", (data) => {
    socket.to(data.roomId).emit("receive_message", data);
  });

  // 4. Sync Annotations (Arrows & Colors)
  socket.on("sync_annotations", (data) => {
    // data = { roomId, arrows, circles }
    socket.to(data.roomId).emit("receive_annotations", data);
  });

  socket.on("disconnect", () => {
    console.log('Disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Socket Server running on port ${PORT}`));