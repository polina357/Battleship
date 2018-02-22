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
    console.log('not_reconnect');
    io.emit('show_all_games', games);
  });

  socket.on('new_room', function (params) {
    console.log('new_room');
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
      namesInOrder: [],
      busy: false
    });
    console.log(games);
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

    console.log(games);
    socket.join(params.selectedGame);
    socket.emit('start');
    io.emit('show_all_games', games);
  });

  socket.on('shoot', function (coord, gameID) {
    socket.to(gameID).emit('shoot', coord);
  });

  socket.on('ready', function (matrix, params) {
    let game = games.find(x => x.gameID === params.selectedGame);
    if (!game) return;
    game.namesInOrder.push(params.playerName);
    console.log('ready', game);
    if (game.namesInOrder.length === 2) {
      socket.emit('ready', game.namesInOrder[0]);
      socket.to(params.selectedGame).emit('go go', game.namesInOrder[1]);
      return;
    }
    console.log(matrix, params);
    socket.emit('wait');
  });

  socket.on('go go', function (gameID) {
    socket.to(gameID).emit('go go');
  });

  socket.on('shootCallback', function (res, gameID) {
    console.log(res, gameID);
    socket.to(gameID).emit('shootCallback', res);
  });

  socket.on('wait', function () {
    console.log('wait')
    socket.emit('wait');
  });

  socket.on('win', function (gameID) {
    console.log('win', gameID);
    let i = games.findIndex(x => x.gameID === gameID);
    games.splice(i, 1);
    console.log(games);
    socket.emit('win');
    socket.to(gameID).emit('lose');
  });

  socket.on('player_exit', function (params) {
    console.log('player_exit', params);
    let game = games.find(x => x.gameID === params.selectedGame);
    if (!game) return;
    for (let j = 0; j < game.players.length; j++) {
      if (game.players[j].playerID === params.playerID) {
        console.log('player_remove');
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
    console.log(games);
    io.emit('show_all_games', games);
  });

  socket.on('disconnect', function () {
    console.log('disconnect', socket.id);
    let index = false;
    for (let i = 0, game; i < games.length; i++) {
      game = games[i];
      for (let j = 0, player; j < game.players.length; j++) {
        player = game.players[j];
        if (player.socketID === socket.id) {
          player.inactive = true;
          socket.to(game.gameID).emit('enemy_disconnected');
          index = true;
          console.log('Disconnected player', player);
          if (game.players.filter(pl => pl.inactive).length == game.players.length) {
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
    console.log('Games after disconnect', games);
    io.emit('show_all_games', games);
  });

  socket.on('reconnect_player', function (playerID, gameID) {
    console.log('reconnect_player')
    socket.join(gameID);
    let game = games.find(x => x.gameID === gameID);
    console.log(game);
    if (!game) return;
    let player = game.players.find(pl => pl.playerID === playerID);
    console.log(player);
    if (!player) return;
    player.socketID = socket.id;
    if (player.inactive) delete player.inactive;
    console.log('reconnect player', player);
    socket.emit('reconnect_player', player);
  });

  socket.on('enemy_is_back', function (gameID, playerID) {
    let game = games.find(x => x.gameID === gameID);
    console.log('Enemy_is_back, found game: ', game);
    if (!game) return;
    let player = game.players.find(pl => pl.playerID === playerID);
    console.log(player);
    socket.to(gameID).emit('enemy_is_back', player);
  });

  socket.on('time_is_up', function (gameID) {
    console.log('time_is_up')
    let game = games.find(x => x.gameID === gameID);
    if (!game) return;
    games.splice(games.indexOf(game), 1);
    console.log(games);
    socket.emit('time_is_up');
    io.emit('show_all_games', games);
  });
});
