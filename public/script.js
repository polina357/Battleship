let socket = io();
let params = {};

document.querySelector('.play_with_player').addEventListener('click', playWithPlayerHandler = () => {
  document.querySelector('.container_mode').setAttribute('data-show', 'false');
  document.querySelector('.container_rooms').setAttribute('data-show', 'true');

  document.querySelector('.new_room').addEventListener('click', newRoomHandler = () => {
    let name = prompt('Enter your name', 'Player');
    if (!name) return alert('Enter your name, please');
    params.playerName = name;
    params.playerID = ID();
    socket.emit('new_room', params);
  });

  document.querySelector('.connect').addEventListener('click', connectHandler = (e) => {
    params.playerID = ID();
    params.selectedGame = document.querySelector('#existing_games').value;
    if (!params.selectedGame) {
      e.preventDefault();
      return;
    }
    params.playerName = prompt('Enter your name', 'Player');

    socket.emit('select_room', params);
  });
});

function ID() {
  return '_' + Math.random().toString(36).substr(2, 9);
}

class Player extends PlayerL {
  constructor(options) {
    super(options);
  }

  set changeTurn(value) {
    this.turn = value;
    if (this.turn) {
      document.querySelector('.player2').addEventListener('click', game.player1.handler = (e) => {
        game.player1.shoot(e, game.player1);
      });
    }
  }

  shoot(e) {
    let x = e.target.parentNode.rowIndex - 1,
      y = e.target.cellIndex - 1;
    socket.emit('shoot', { x, y }, params.selectedGame);
  }

  shootCallback(res) {
    let x = res.coord.x, y = res.coord.y;
    if (res.result === 1) {
      this.enemyMatrix[x][y] = 3;
      explosionHandler(res.coord, '.player2');
      if (res.deadShip) {
        this.count++;
        this.enemyMatrix = this.markCells(res.deadShip, this.enemyMatrix);
        if (this.count === 10) {
          socket.emit('win', params.selectedGame);
        }
      }
      game.onRefresh(true);
    } else if (res.result !== 'wrong') {
      game.player1.enemyMatrix[x][y] = 2;
      game.onRefresh(false);
    }
  }
}

class Bot extends Player {
  constructor(options) {
    super(options);

    this.needShot = [];
    this.orderedHits = [];
    this.enemyShips = [];
    this.displ = 0;
    this.kSearch = 4;
    this.orX = -1;
    this.orY = -1;
  }

  set changeTurn(value) {
    this.turn = value;
    if (this.turn) {
      setTimeout(() => {
        this.shoot();
      }, 20);
    }
  }

  shoot() {
    let coord = this.getCoordinatesForShot();
    if (coord) socket.emit('shoot', coord, params.selectedGame);
  }

  shootCallback(res) {
    let coord = res.coord;
    if (res.result === 1) {
      explosionHandler(coord, '.player2');
      this.enemyMatrix[coord.x][coord.y] = 3;
      if (res.deadShip) {
        this.count++;
        this.orderedHits = [];
        this.enemyShips.push(res.deadShip);
        this.getDispl();
        this.enemyMatrix = this.markCells(res.deadShip, this.enemyMatrix);
        if (this.count === 10) {
          socket.emit('win', params.selectedGame);
        }
      } else {
        this.orderedHits.push(coord);
        if (this.orderedHits.length === 2) {
          this.orX = this.orderedHits[0].x === this.orderedHits[1].x ? this.orderedHits[0].x : -1;
          this.orY = this.orderedHits[0].y === this.orderedHits[1].y ? this.orderedHits[1].y : -1;
        }
        this.getNeedShot({ x: coord.x, y: coord.y });
      }
      game.onRefresh(true);
    } else {
      this.enemyMatrix[coord.x][coord.y] = 2;
      game.onRefresh(false);
    }
  }

  getCoordinatesForShot() {
    let x, y, coord = 0;
    if (this.needShot.length) {
      coord = this.needShot.splice(0, 1);
      x = coord[0].x;
      y = coord[0].y;
      if (!this.enemyMatrix[x][y]) {
        if (this.orX !== -1 && x === this.orX) {
          return { x, y };
        } else if (this.orY !== -1 && y === this.orY) {
          return { x, y };
        } else if (this.orX === -1 && this.orY === -1) return { x, y };
        else return this.getCoordinatesForShot();
      } else {
        return this.getCoordinatesForShot();
      }
    } else {
      coord = this.getNesCoords();
      this.orX = -1;
      this.orY = -1;
      if (coord) return { x: coord.x, y: coord.y };
    }
  }

  getNeedShot({ x, y }) {
    if (x > 0) this.needShot.push({ x: x - 1, y });
    if (x < this.size - 1) this.needShot.push({ x: x + 1, y });
    if (y > 0) this.needShot.push({ x, y: y - 1 });
    if (y < this.size - 1) this.needShot.push({ x, y: y + 1 });
  }

  getDispl() {
    let num = 0;
    for (let i = 0; i < this.enemyShips.length; i++) {
      const ship = this.enemyShips[i];
      if (ship.decks === 3 || ship.decks === 2) {
        num++;
        continue;
      } else if (ship.decks === 4) {
        this.displ = 2;
        this.kSearch = 2;
        this.enemyShips.splice(i, 1);
        break;
      }
    }
    if (num === 5) this.displ = 1;
  }

  getNesCoords() {
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        if (this.enemyMatrix.length && !this.enemyMatrix[x][y]) {
          if (this.displ !== 1) {
            if (((x + y) - (3 - this.displ)) % this.kSearch === 0) {
              return { x, y };
            } else continue;
          } else {
            return { x, y };
          }
        }
      }
    }
  }
}

let handlerRanB, handlerRB, timer;
class Game {
  constructor(size) {
    gameP = new Phaser.Game(900, 500, Phaser.AUTO, 'field-canvas', { preload: preload, create: create })
    this.size = size;
    params.enemyName = 'Enemy';
    let fields = this.drawTable([this.size][this.size]);

    this.addEvents();
  }

  addEvents() {
    document.querySelector('.random').addEventListener('click', handlerRanB = () => {
      this.player1.randomLocation();
      this.drawTable(this.player1.matrix, this.player1.enemyMatrix);
    });

    ready.addEventListener('click', handlerRB = () => {
      window.removeEventListener('keypress', this.keypressHandler);
      document.querySelector('.buttons').setAttribute('data-show', 'false');
      message.innerHTML = "Enemy's turn";

      localStorage.playerInformation = JSON.stringify(game.player1);
      socket.emit('ready', this.player1.matrix, params);
    });
  }

  onRefresh(aim) {
    this.drawTable(this.player1.matrix, this.player1.enemyMatrix);
    if (!aim) {
      message.innerHTML = "Enemy's turn";
      this.player1.changeTurn = false;
      localStorage.playerInformation = JSON.stringify(game.player1);
      socket.emit('go go', params.selectedGame);
    } else {
      this.player1.changeTurn = true;
    }
  }

  drawTable(matrix1, matrix2) {
    let battlefield = document.querySelector('.battlefield');
    let table1 = tmpl("table_tmpl",
      {
        cl: 'field player1',
        size: this.size,
        matrix: matrix1,
        name: params.playerName + "'s field"
      });

    let table2 = tmpl("table_tmpl",
      {
        cl: 'field player2',
        size: this.size,
        matrix: matrix2,
        name: params.enemyName + "'s field"
      });

    battlefield.innerHTML = table1;
    battlefield.innerHTML += table2;
  }

  destroy() {
    this.player1.destroy();
    params.gameID = '';
    removeEvents();
    document.querySelector('.buttons').setAttribute('data-show', 'true');
    ready.setAttribute('disabled', 'true');
    document.querySelector('.star').setAttribute('data-show', 'false');
    message.innerHTML = 'Place your ships';
    gameP.destroy();
  }
}

function removeEvents() {
  document.querySelector('.new_room').removeEventListener('click', newRoomHandler);
  document.querySelector('.connect').removeEventListener('click', connectHandler);
  document.querySelector('.exit').removeEventListener('click', exitHandler);
  document.querySelector('.random').removeEventListener('click', handlerRanB);
  ready.removeEventListener('click', handlerRB);
  window.removeEventListener('keypress', game.keypressHandler);
  clearInterval(timer);
  document.querySelector('.overlay').setAttribute('data-show', 'false');
}

socket.on('show_all_games', function (games) {
  let allGames = tmpl("allgameselect", {
    allgames: games
  });
  document.querySelector('#existing_games').innerHTML = allGames;
});

socket.on('start', function (gameID) {
  if (gameID) {
    params.selectedGame = gameID;
  }
  localStorage.gameID = params.selectedGame;
  localStorage.playerID = params.playerID;

  game = new Game(10);

  document.querySelector('.container_rooms').setAttribute('data-show', 'false');
  document.querySelector('.container').setAttribute('data-show', 'true');
  document.querySelector('.exit').addEventListener('click', exitHandler = (e) => {
    if (confirm('Are you sure?')) {
      localStorage.removeItem('gameID');
      localStorage.removeItem('playerInformation');
      document.querySelector('.container').setAttribute('data-show', 'false');
      document.querySelector('.container_mode').setAttribute('data-show', 'true');
      game.destroy();
      socket.emit('player_exit', params);
      params.selectedGame = '';
    } else {
      return;
    }
  });

  game.player1 = new Player({
    field: '.player1',
    size: game.size,
    type: 'Player'
  });

  window.addEventListener('keypress', game.keypressHandler = (e) => { // ctrl + shift + x
    if (e.ctrlKey && e.shiftKey && e.keyCode == 24) {
      message.innerHTML = 'You play as a bot';
      document.querySelector('.star').setAttribute('data-show', 'true');
      let plMatrix = null;
      let ships = null;
      if (game.player1.matrix && game.player1.matrix.length) {
        plMatrix = game.player1.matrix;
        ships = game.player1.myShips;
      }
      game.player1 = new Bot({
        field: 'player1',
        size: game.size,
        type: 'Bot'
      });
      if (plMatrix) {
        game.player1.matrix = plMatrix;
        game.player1.myShips = ships;
      }
    }
  });
});

socket.on('ready', function (name) {
  params.enemyName = name;
  localStorage.enemyName = name;
});

socket.on('go go', function (name) {
  if (name) {
    params.enemyName = name;
    localStorage.enemyName = name;
  }
  message.innerHTML = 'Your turn';
  game.player1.changeTurn = true;
  localStorage.playerInformation = JSON.stringify(game.player1);
});

socket.on('shoot', function (coords) {
  if (coords) var res = game.player1.check(coords);
  localStorage.playerInformation = JSON.stringify(game.player1);
  game.drawTable(game.player1.matrix, game.player1.enemyMatrix);
  socket.emit('shootCallback', res, params.selectedGame);
});

socket.on('shootCallback', function (res) {
  localStorage.playerInformation = JSON.stringify(game.player1);
  game.player1.shootCallback(res);
});

socket.on('win', function () {
  alert('You won!');
  game.destroy();
  document.querySelector('.container').setAttribute('data-show', 'false');
  document.querySelector('.container_mode').setAttribute('data-show', 'true');
});

socket.on('lose', function () {
  alert('You lost!');
  game.destroy();
  document.querySelector('.container').setAttribute('data-show', 'false');
  document.querySelector('.container_mode').setAttribute('data-show', 'true');
});

socket.on('wait', function () {
  message.innerHTML = 'Waiting for the second player...'
});

socket.on('enemy_disconnected', function () {
  let time = document.querySelector('.timer');
  time.innerHTML = 60;
  let overlay = document.querySelector('.overlay');
  overlay.setAttribute('data-show', 'true');
  message.innerHTML = 'Second player disconnected';
  timer = setInterval(() => {
    time.innerHTML--;
    if (time.innerHTML == 0) {
      clearInterval(timer);
      overlay.setAttribute('data-show', 'false');
      socket.emit('time_is_up', params.selectedGame);
    }
  }, 1000);
});

socket.on('player_exit', function () {
  alert('The second player gave up');
  console.log('player exit');
  params.selectedGame = '';
  game.destroy();
  localStorage.removeItem('gameID');
  localStorage.removeItem('playerInformation');
  document.querySelector('.container').setAttribute('data-show', 'false');
  document.querySelector('.container_mode').setAttribute('data-show', 'true');
  // socket.emit('player_exit', params);
});

socket.on('check_for_reconnection', function (games) {
  if (localStorage.gameID && games.findIndex(x => x.gameID === localStorage.gameID) !== -1) {
    if (confirm('Do you want to reconnect?') && games.findIndex(x => x.gameID === localStorage.gameID) !== -1) {
      socket.emit('reconnect_player', localStorage.playerID, localStorage.gameID);
    } else {
      socket.emit('not_reconnect', localStorage.gameID);
      localStorage.removeItem('gameID');
    }
  } else {
    socket.emit('not_reconnect');
  }
});

socket.on('reconnect_player', function (player) {
  document.querySelector('.container_mode').setAttribute('data-show', 'false');
  document.querySelector('.container').setAttribute('data-show', 'true');

  document.querySelector('.buttons').setAttribute('data-show', 'false');
  game = new Game(10);
  params.playerName = player.name;
  params.selectedGame = localStorage.gameID;
  params.enemyName = localStorage.enemyName;
  let obj = JSON.parse(localStorage.playerInformation);
  game.player1 = new Player(obj.options);
  game.player1.matrix = obj.matrix;
  game.player1.enemyMatrix = obj.enemyMatrix;
  game.player1.count = obj.count;
  game.player1.myShips = obj.myShips;
  game.player1.turn = obj.turn;
  game.drawTable(game.player1.matrix, game.player1.enemyMatrix);

  if (!game.player1.turn) {
    message.innerHTML = "Enemy's turn";
    socket.emit('go go', params.selectedGame);
  } else {
    message.innerHTML = "Your turn";
  }
  socket.emit('enemy_is_back', localStorage.gameID, localStorage.playerID);
});

socket.on('enemy_is_back', function (player) {
  clearInterval(timer);
  document.querySelector('.overlay').setAttribute('data-show', 'false');
  game.drawTable(game.player1.matrix, game.player1.enemyMatrix);
  if (!game.player1.turn) {
    message.innerHTML = "Enemy's turn";
    socket.emit('go go', params.selectedGame);
  }
});

socket.on('time_is_up', function () {
  alert('Time is up');
  params.selectedGame = '';
  localStorage.removeItem('gameID');
  localStorage.removeItem('playerInformation');
  document.querySelector('.container').setAttribute('data-show', 'false');
  document.querySelector('.container_mode').setAttribute('data-show', 'true');
});