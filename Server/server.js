import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import http from "http";

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// Store room data
const rooms = new Map();

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join room
  socket.on("join_room", (data) => {
    const { room, username } = data;
    
    // Leave previous rooms
    const previousRooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    previousRooms.forEach(prevRoom => {
      socket.leave(prevRoom);
      if (rooms.has(prevRoom)) {
        const roomData = rooms.get(prevRoom);
        roomData.users = roomData.users.filter(user => user.id !== socket.id);
        roomData.users = roomData.users.filter(user => user.username !== username);
        rooms.set(prevRoom, roomData);
        
        // Notify others in the room
        socket.to(prevRoom).emit("user left", { username });
        io.to(prevRoom).emit("online users", roomData.users.length);
      }
    });

    // Join new room
    socket.join(room);
    
    // Store user data
    if (!rooms.has(room)) {
      rooms.set(room, { users: [] });
    }
    
    const roomData = rooms.get(room);
    roomData.users.push({ id: socket.id, username });
    rooms.set(room, roomData);

    console.log(`User ${username} joined room: ${room}`);
    
    // Notify everyone in the room
    socket.to(room).emit("user joined", { username });
    io.to(room).emit("online users", roomData.users.length);
  });

  // Send message - FIXED to prevent duplicates
  socket.on("send-message", (data) => {
    console.log("send message data", data);
    // Broadcast to all clients in the room including sender
    io.to(data.room).emit("receive message", data);
  });

  // Typing
  socket.on("typing", (data) => {
    socket.to(data.room).emit("user typing", { username: data.username });
  });

  // Stop typing
  socket.on("stop typing", (data) => {
    socket.to(data.room).emit("user stopped typing", { username: data.username });
  });

  // Leave room
  socket.on("leave_room", (data) => {
    const { room, username } = data;
    socket.leave(room);
    
    if (rooms.has(room)) {
      const roomData = rooms.get(room);
      roomData.users = roomData.users.filter(user => user.id !== socket.id);
      roomData.users = roomData.users.filter(user => user.username !== username);
      rooms.set(room, roomData);
      
      socket.to(room).emit("user left", { username });
      io.to(room).emit("online users", roomData.users.length);
    }
    
    console.log(`User ${username} left room: ${room}`);
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("User Disconnected", socket.id);
    
    // Remove user from all rooms
    rooms.forEach((roomData, room) => {
      const userIndex = roomData.users.findIndex(user => user.id === socket.id);
      if (userIndex !== -1) {
        const username = roomData.users[userIndex].username;
        roomData.users.splice(userIndex, 1);
        rooms.set(room, roomData);
        
        socket.to(room).emit("user left", { username });
        io.to(room).emit("online users", roomData.users.length);
      }
    });
  });
});

server.listen(3001, () => {
  console.log("Server is running on port 3001");
});