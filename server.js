const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();

// !! 1. IMPORTANT !!
// Change this to your DEPLOYED frontend URL (e.g., your Vercel/Netlify URL)
// It cannot be localhost anymore if your backend is on Railway.
const FRONTEND_URL = "http://localhost:8080/"; // <-- CHANGE THIS

// CORS setup
app.use(cors({
  origin: FRONTEND_URL,
  methods: ["GET", "POST"]
}));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"]
  }
});

// Use port provided by Railway or default to 4000
const PORT = process.env.PORT || 4000; 

// === Socket.io Logic ===

// 2. Create a Namespace for "/api/v1"
// This matches your VITE_API_URL
const apiV1Namespace = io.of("/api/v1");

// 3. Attach all listeners to the namespace, not to 'io'
apiV1Namespace.on('connection', (socket) => {
  console.log(`A user connected to /api/v1: ${socket.id}`);

  // "joinRoom" event
  socket.on("joinRoom", ({ roomId, role }) => {
    socket.join(roomId); 
    console.log(`User ${socket.id} (Role: ${role}) joined room: ${roomId}`);
    socket.to(roomId).emit("userJoined", { userId: socket.id, role: role });
  });

  // "makeMove" event
  socket.on("makeMove", ({ roomId, move, fen, pgn }) => {
    console.log(`Move in room ${roomId}: ${move.from}-${move.to}`);
    socket.to(roomId).emit("opponentMove", { fen: fen }); 
  });

  // "syncState" (Reset board) event
  socket.on("syncState", ({ roomId, fen, pgn }) => {
    console.log(`Syncing state for room: ${roomId}`);
    io.of("/api/v1").in(roomId).emit("syncState", { fen: fen });
  });

  // "leaveRoom" event
  socket.on("leaveRoom", ({ roomId }) => {
    socket.leave(roomId);
    console.log(`User ${socket.id} left room: ${roomId}`);
  });

  // "disconnect" event
  socket.on("disconnect", () => {
    console.log(`User ${socket.id} disconnected from /api/v1`);
  });
});

// A simple health check route
app.get("/", (req, res) => {
  res.send("PawnRace Backend Server is running!");
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}...`);
});