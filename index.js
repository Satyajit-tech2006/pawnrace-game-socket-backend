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

// Map to track users
const userMap = {};

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  // 1. Join Room (Crash-Proof Version)
  socket.on("join_room", (data) => {
    // Handle both old format (string) and new format (object)
    let roomId, user;
    
    if (typeof data === 'string') {
        roomId = data;
        user = {}; // Empty object if no user data sent
    } else {
        roomId = data.roomId;
        user = data.user || {}; // Safety check
    }

    if (!roomId) return; // Ignore invalid requests

    socket.join(roomId);
    
    // Store User Info safely
    userMap[socket.id] = { 
        roomId, 
        name: user.name || "Unknown User", 
        role: user.role || "Viewer",
        id: user._id || socket.id
    };

    console.log(`${userMap[socket.id].name} joined ${roomId}`);

    // Broadcast updated user list
    broadcastUserList(roomId);
  });

  // 2. Make Move
  socket.on("make_move", (data) => {
    socket.to(data.roomId).emit("receive_move", data);
  });

  // 3. Annotations
  socket.on("sync_annotations", (data) => {
    socket.to(data.roomId).emit("receive_annotations", data);
  });

  // 4. Chat
  socket.on("send_message", (data) => {
    socket.to(data.roomId).emit("receive_message", data);
  });

  socket.on('update_controls', ({ roomId, controls }) => {
    // Broadcast the new control state to everyone in the room
    io.in(roomId).emit('controls_updated', controls);
});

  // 5. Disconnect
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