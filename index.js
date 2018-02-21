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

  socket.on('not_reconnect', function () {
    io.emit('show_all_games', games);
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
    let game = games.find(x => x.gameID === params.selectedGame);
    if (!game) return;
    game.players.push({
      playerID: params.playerID,
      name: params.playerName,
      socketID: socket.id
    });
    game.busy = true;
    socket.join(params.selectedGame);
    socket.emit('start');
  });

  socket.on('shoot', function (params, gameID) {
    socket.to(gameID).emit('shoot', params);
  });

  socket.on('ready', function (matrix, params) {
    console.log('ready');
    let game = games.find(x => x.gameID === params.selectedGame);
    if (!game) return;
    game.readyPlayers++;
    console.log('ready', game.players);
    if (game.players.length === 2) {
      socket.emit('ready', game.players[0].name);
      socket.to(params.selectedGame).emit('go go', game.players[1].name);
      return;
    }
    console.log('wait');
    socket.emit('wait');
  });

  socket.on('go go', function (gameID) {
    socket.to(gameID).emit('go go');
  });

  socket.on('shootCallback', function (res, gameID) {
    socket.to(gameID).emit('shootCallback', res);
  });

  socket.on('wait', function () {
    console.log('wait')
    socket.emit('wait');
  });

  socket.on('win', function (gameID) {
    console.log('win')
    let i = games.findIndex(x => x.gameID === gameID);
    games.splice(i, 1);
    socket.emit('win');
    socket.to(gameID).emit('lose');
  });

  socket.on('player_exit', function (params) {
    console.log('player_exit', params);
    let game = games.find(x => x.gameID === params.selectedGame);
    if (!game) return;
    for (let j = 0; j < game.players.length; j++) {
      if (game.players[j].playerID === params.playerID) {
        console.log('player_remove')
        game.players.splice(j, 1);
        break;
      }
    }
    console.log('players', game.players);
    if (game.players.length) {
      socket.to(params.selectedGame).emit('player_exit');
    } else {
      console.log('remove empty game');
      socket.emit('game_removed', game);
      games.splice(games.indexOf(game), 1);
    }
    io.emit('show_all_games', games);
  });

  socket.on('disconnect', function () {
    console.log('disconnect');
    let index = false;
    for (let i = 0, game; i < games.length; i++) {
      game = games[i];
      for (let j = 0, player; j < game.players.length; j++) {
        player = game.players[j];
        if (player.socketID === socket.id) {
          player.inactive = true;
          socket.to(game.gameID).emit('enemy_disconnected');
          index = true;
          if (game.players.filter(pl => pl.inactive).length == 2) {
            console.log('remove empty game after disconnect')
            games.splice(i, 1);
          }
          break;
        }
      }
      if (index) {
        break;
      }
    }
    io.emit('show_all_games', games);
  });

  socket.on('reconnect_player', function (playerID, gameID) {
    console.log('reconnect_player')
    socket.join(gameID);
    let game = games.find(x => x.gameID === gameID);
    if (!game) return;
    let player = game.players.find(pl => pl.playerID === playerID);
    player.socketID = socket.id;
    if (player.inactive) delete player.inactive;
    socket.emit('reconnect_player', player);
  });

  socket.on('enemy_is_back', function (gameID, playerID) {
    let game = games.find(x => x.gameID === gameID);
    console.log(game);
    if (!game) return;
    let player = game.players.find(pl => pl.playerID === playerID);
    socket.to(gameID).emit('enemy_is_back', player);
  });

  socket.on('time_is_up', function (gameID) {
    console.log('time_is_up')
    let game = games.find(x => x.gameID === gameID);
    if (!game) return;
    games.splice(games.indexOf(game), 1);
    socket.emit('time_is_up');
    io.emit('show_all_games', games);
  });
});
