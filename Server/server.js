const { createServer } = require("http");
const { Server } = require("socket.io");

const localhostURL = "http://localhost:5173/";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: localhostURL,
});

const allUsers = {};
let waiting = null;
const allRooms = [];

io.on("connection", (socket) => {
  allUsers[socket.id] = {
    socket: socket,
    online: true,
  };

  socket.on("request_to_play", (data) => {
    const currentUser = allUsers[socket.id];
    currentUser.playerName = data.playerName;

    if (!waiting) {
      waiting = currentUser;
      currentUser.socket.emit("WaitingForOpponent");
      return;
    }

    const opponentPlayer = waiting;
    waiting = null;

    const room = {
      player1: opponentPlayer,
      player2: currentUser,
    };

    allRooms.push(room);

    currentUser.socket.emit("OpponentFound", {
      opponentName: opponentPlayer.playerName,
      playingAs: "circle",
    });

    opponentPlayer.socket.emit("OpponentFound", {
      opponentName: currentUser.playerName,
      playingAs: "cross",
    });

    currentUser.socket.on("playerMoveFromClient", (data) => {
      opponentPlayer.socket.emit("playerMoveFromServer", { ...data });
    });

    opponentPlayer.socket.on("playerMoveFromClient", (data) => {
      currentUser.socket.emit("playerMoveFromServer", { ...data });
    });
  });

  socket.on("disconnect", function () {
    const currentUser = allUsers[socket.id];
    currentUser.online = false;

    for (let index = 0; index < allRooms.length; index++) {
      const { player1, player2 } = allRooms[index];

      if (player1.socket.id === socket.id) {
        player2.socket.emit("opponentLeftMatch");
        allRooms.splice(index, 1);
        break;
      }

      if (player2.socket.id === socket.id) {
        player1.socket.emit("opponentLeftMatch");
        allRooms.splice(index, 1);
        break;
      }
    }

    if (waiting && waiting.socket.id === socket.id) {
      waiting = null;
    }
  });
});

httpServer.listen(3000);
