var express = require('express');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var games = [];

app.use(express.static(__dirname + '/public'));
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

http.listen(3000, function () {
  console.log('listening on *:3000');
});

io.on('connection', function (socket) {
  console.log('new user connected');
  if (games.length) socket.emit('check_for_reconnection', games);

  socket.on('not_reconnect', function (gameID) {
    socket.emit('show_all_games', games);
    socket.to(gameID).emit('player_exit');
    let i = games.findIndex(x => x.gameID === gameID);
    games.splice(i, 1);
  });

  socket.on('new_room', function (params) {
    let gameID = '_' + Math.random().toString(36).substr(2, 9);
    socket.join(gameID);
    games.push({
      gameID,
      players: [
        {
          playerID: params.playerID,
          name: params.playerName,
          socketID: socket.id
        }
      ],
      readyPlayers: 0,
      busy: false
    });
    socket.emit('start', gameID);
    io.emit('show_all_games', games);
  });

  socket.on('select_room', function (params) {
    let i = games.findIndex(x => x.gameID === params.selectedGame);
    games[i].players.push({
      playerID: params.playerID,
      name: params.playerName,
      socketID: socket.id
    });
    games[i].busy = true;
    socket.join(params.selectedGame);
    socket.emit('start');
  });

  socket.on('shoot', function (params, gameID) {
    socket.to(gameID).emit('shoot', params);
  });

  socket.on('ready', function (matrix, params) {
    let i = games.findIndex(x => x.gameID === params.selectedGame);
    games[i].readyPlayers++;

    if (games[i].readyPlayers === 2) {
      socket.emit('ready', games[i].players[0].name);
      socket.to(params.selectedGame).emit('go go', games[i].players[1].name);
    } else if (games[i].readyPlayers === 1) {
      socket.emit('wait');
    }
  });

  socket.on('go go', function (gameID) {
    socket.to(gameID).emit('go go');
  });

  socket.on('shootCallback', function (res, gameID) {
    socket.to(gameID).emit('shootCallback', res);
  });

  socket.on('wait', function () {
    socket.emit('wait');
  });

  socket.on('win', function (gameID) {
    let i = games.findIndex(x => x.gameID === gameID);
    games.splice(i, 1);
    socket.emit('win');
    socket.to(gameID).emit('lose');
  });

  socket.on('player_exit', function (params) {
    let i = games.findIndex(x => x.gameID === params.selectedGame);
    for (let j = 0; j < games[i].players.length; j++) {
      if (games[i].players[j].playerID === params.playerID) {
        games[i].players.splice[j, 1];
      }
    }
    if (games[i].players) {
      socket.to(params.selectedGame).emit('player_exit');
    } else {
      games.splice(i, 1);
    }
  });

  socket.on('disconnect', function () {
    let index;
    for (let i = 0; i < games.length; i++) {
      for (let j = 0; j < games[i].players.length; j++) {
        if (games[i].players[j].socketID === socket.id) {
          games[i].players.splice(j, 1);
          index = i;
          break;
        }
      }
    }

    if (games[index] && games[index].players && !games[index].players.length) {
      games.splice(index, 1);
    } else if (games[index] && index !== -1) {
      socket.to(games[index].gameID).emit('enemy_disconnected');
    }
  });

  socket.on('reconnect_player', function (playerID, gameID) {
    socket.join(gameID);
    let i = games.findIndex(x => x.gameID === gameID);
    games[i].players.push({ playerID, socketID: socket.id });
    socket.emit('reconnect_player');
  });

  socket.on('enemy_is_back', function (gameID) {
    socket.to(gameID).emit('enemy_is_back');
  });

  socket.on('time_is_up', function (gameID) {
    let i = games.findIndex(x => x.gameID === gameID);
    games.splice(i, 1);
    socket.emit('time_is_up');
  });
});
