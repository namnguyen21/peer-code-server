const express = require("express");
const app = express();
app.use(express.json());
const server = require("http").createServer(app);
// const mysql = require("mysql2/promise");
const cors = require("cors");
require("dotenv").config();

// const redis = require("redis");

// const redisClient = redis.createClient();
// redisClient.on("error", (err) => {
//   console.log(err);
// });

const io = require("socket.io")(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId, userId, name, color }) => {
    console.log(color);
    socket.join(roomId);
    socket.to(roomId).emit("user-connected", { userId, name, color });
    socket.on("disconnect", () => {
      socket.to(roomId).emit("user-disconnected", userId);
    });
  });

  socket.on("chat-send", (data) => {
    socket.to(data.roomId).emit("chat-receive", data);
  });

  socket.on("theme-change", ({ roomId, theme }) => {
    socket.to(roomId).emit("theme-change", theme);
  });

  socket.on("mode-change", ({ roomId, mode }) => {
    socket.to(roomId).emit("mode-change", mode);
  });
});

app.use(cors());

app.use("/room", require("./routes/room"));

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log("SERVER NOW LISTENING ON PORT " + PORT);
});
