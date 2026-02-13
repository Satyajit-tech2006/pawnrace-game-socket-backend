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

const userMap = {};

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on("join_room", (data) => {
    let roomId, user;
    if (typeof data === 'string') {
        roomId = data;
        user = {}; 
    } else {
        roomId = data.roomId;
        user = data.user || {}; 
    }

    if (!roomId) return; 

    socket.join(roomId);
    
    userMap[socket.id] = { 
        roomId, 
        name: user.name || "Unknown User", 
        role: user.role || "Viewer",
        id: user._id || socket.id
    };

    console.log(`${userMap[socket.id].name} joined ${roomId}`);
    broadcastUserList(roomId);
  });

  // --- SYNC EVENTS ---
  socket.on("request_sync", (roomId) => {
      socket.to(roomId).emit("perform_sync", socket.id);
  });

  socket.on("send_sync_data", (data) => {
      io.to(data.targetId).emit("receive_sync_data", data);
  });

  // --- LESSON LOAD EVENT ---
  socket.on("load_pgn", (data) => {
      // Broadcast PGN to room so everyone loads the full lesson
      socket.to(data.roomId).emit("receive_pgn", data);
  });

  socket.on("make_move", (data) => {
    socket.to(data.roomId).emit("receive_move", data);
  });

  socket.on("sync_annotations", (data) => {
    socket.to(data.roomId).emit("receive_annotations", data);
  });

  socket.on("send_message", (data) => {
    socket.to(data.roomId).emit("receive_message", data);
  });

  socket.on('update_controls', ({ roomId, controls }) => {
    io.in(roomId).emit('controls_updated', controls);
  });

  socket.on("disconnect", () => {
    const user = userMap[socket.id];
    if (user) {
        const { roomId } = user;
        delete userMap[socket.id];
        broadcastUserList(roomId);
        console.log(`${user.name} disconnected`);
    }
  });

  const broadcastUserList = (roomId) => {
      const usersInRoom = [];
      for (const socketId in userMap) {
          if (userMap[socketId].roomId === roomId) {
              usersInRoom.push(userMap[socketId]);
          }
      }
      io.to(roomId).emit("update_user_list", usersInRoom);
  };
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Socket Server running on port ${PORT}`));