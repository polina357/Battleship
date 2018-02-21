let ready = document.querySelector('.ready');
let randomB = document.querySelector('.random');
let message = document.querySelector('.message');
let game;

let audio = new Audio('media/audio.wav');

class PlayerL {
  constructor(options) {
    this.options = options;
    this.size = options.size;
    this.type = options.type;
    this.field = typeof options.field === 'string' ? document.querySelector(options.field) : options.field;

    this.enemyMatrix = this.createMatrix();
    this.count = 0;
  }

  get changeTurn() {
    return this.turn;
  }

  set changeTurn(value) {
    this.turn = value;
  }

  randomLocation() {
    this.myShips = [];
    this.matrix = this.createMatrix();
    let ships = [
      { decks: 4, number: 1 }, { decks: 3, number: 2 }, { decks: 2, number: 3 }, { decks: 1, number: 4 }
    ];

    while (ships.length) {
      while (ships[0].number !== 0) {
        let location = this.getCoordinates(ships[0]);
        this.createShip(location, ships[0]);
        ships[0].number--;
      }
      ships.splice(0, 1);
    }
  }

  createMatrix() {
    let arr = [];
    for (let i = 0; i < this.size; i++) {
      arr[i] = [];
      for (let j = 0; j < this.size; j++) {
        arr[i][j] = 0;
      }
    }
    return arr;
  }

  getCoordinates(ship) {
    let x, y,
      dir = this.randomInteger(0, 1),
      kx = dir === 0 ? 0 : 1,
      ky = dir === 0 ? 1 : 0;

    if (dir == 0) {
      x = this.randomInteger(0, this.size - 1);
      y = this.randomInteger(0, this.size - ship.decks - 1);
    } else {
      x = this.randomInteger(0, this.size - ship.decks - 1);
      y = this.randomInteger(0, this.size - 1);
    }
    let result = this.checkLocation(x, y, kx, ky, ship.decks);
    if (!result) return this.getCoordinates(ship);

    return {
      x: x,
      y: y,
      kx: kx,
      ky: ky
    };
  }

  checkLocation(x, y, kx, ky, decks) {
    let bounders = this.getBounders({ x, y, kx, ky, decks });
    for (let i = bounders.fromX; i < bounders.toX; i++) {
      for (let j = bounders.fromY; j < bounders.toY; j++) {
        if (this.matrix[i][j] === 1) return false;
      }
    }
    return true;
  }

  getBounders({ x, y, kx, ky, decks }) {
    let fromX, toX, fromY, toY;

    fromX = (x === 0) ? x : x - 1;
    if (x + kx * decks === this.size && kx === 1) toX = x + kx * decks;
    else if (x + kx * decks < this.size && kx === 1) toX = x + kx * decks + 1;
    else if (x === this.size - 1 && kx === 0) toX = x + 1;
    else if (x < this.size - 1 && kx === 0) toX = x + 2;

    fromY = (y === 0) ? y : y - 1;
    if (y + ky * decks === this.size && ky === 1) toY = y + ky * decks;
    else if (y + ky * decks < this.size && ky === 1) toY = y + ky * decks + 1;
    else if (y === this.size - 1 && ky === 0) toY = y + 1;
    else if (y < this.size - 1 && ky === 0) toY = y + 2;

    return {
      fromX: fromX,
      toX: toX,
      fromY: fromY,
      toY: toY
    }
  }

  createShip(location, ship) {
    let k = 0;
    while (k < ship.decks) {
      this.matrix[location.x + k * location.kx][location.y + k * location.ky] = 1;
      k++;
    }
    ship.location = location;
    ship.hits = 0;
    this.myShips.push(Object.assign({}, ship));
    if (this.myShips.length === 10) {
      ready.removeAttribute('disabled');
    }
  }

  shoot(e, player) {
    let x = e.target.parentNode.rowIndex - 1,
      y = e.target.cellIndex - 1,
      res = game.shootCallback({ x, y });
    if (res.result === 1) {
      this.enemyMatrix[x][y] = 3;
      if (res.deadShip) {
        this.count++;
        this.enemyMatrix = this.markCells(res.deadShip, this.enemyMatrix);
      }
      game.onRefresh(true);
    } else if (res.result === 'wrong') {
      game.onRefresh('wrong');
    } else {
      player.enemyMatrix[x][y] = 2;
      game.onRefresh(false);
    }
  }

  check({ x, y }) {
    let result = this.matrix[x][y];
    if (result === 1) {
      this.matrix[x][y] = 3;
      audio.play();
    } else if (result === 0) {
      this.matrix[x][y] = 2;
    } else {
      result = 'wrong';
    }
    return { result, deadShip: this.findShip({ x, y }), coord: { x, y } };
  }

  findShip({ x, y }) {
    let deadShip = null;
    this.myShips.forEach((ship) => {
      let k = 0;
      while (k < ship.decks) {
        if ((ship.location.x + k * ship.location.kx) === x && (ship.location.y + k * ship.location.ky) === y) {
          ship.hits++;
          if (ship.hits === ship.decks) {
            deadShip = ship;
            this.matrix = this.markCells(ship, this.matrix);
          }
          return;
        }
        k++;
      }
    });
    return deadShip;
  }

  markCells(ship, matrix) {
    const params = ship.location;
    let bounders = this.getBounders({ decks: ship.decks, ...params });
    for (let i = bounders.fromX; i < bounders.toX; i++) {
      for (let j = bounders.fromY; j < bounders.toY; j++) {
        if (!matrix[i][j]) {
          matrix[i][j] = 2;
        }
      }
    }
    return matrix;
  }

  randomInteger(min, max) {
    return Math.floor(min + Math.random() * (max + 1 - min));
  }

  destroy() {
    this.matrix = [];
    this.enemyMatrix = [];
    this.turn = false;
    this.count = 0;
  }
}

class BotL extends PlayerL {
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

  shoot() {
    let coord = this.getCoordinatesForShot();
    let res = game.shootCallback(coord);
    if (res.result === 1) {
      this.enemyMatrix[coord.x][coord.y] = 3;
      if (res.deadShip) {
        this.count++;
        this.orderedHits = [];
        this.enemyShips.push(res.deadShip);
        this.getDispl();
        this.enemyMatrix = this.markCells(res.deadShip, this.enemyMatrix);
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
      return { x: coord.x, y: coord.y };
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
        if (!this.enemyMatrix[x][y]) {
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

class GameL {
  constructor(size) {
    this.size = size;
    let fields = this.drawTable([this.size][this.size]);

    this.player1 = new PlayerL({
      field: '.player1',
      size: this.size,
      type: 'Player'
    });

    this.player2 = new BotL({
      field: '.player2',
      size: this.size,
      type: 'Bot'
    });

    this.addEvents();
  }

  addEvents() {
    randomB.addEventListener('click', this.handlerRanB = () => {
      this.player1.randomLocation();
      this.player2.randomLocation();
      this.drawTable(this.player1.matrix, this.player1.enemyMatrix);
    });

    ready.addEventListener('click', this.handlerRB = () => {
      randomB.style.display = 'none';
      ready.style.display = 'none';
      this.getPlayer();
    });

    document.querySelector('.exit').addEventListener('click', this.handlerExit = (e) => {
      if (confirm('Are you sure?')) {
        game.destroy();
        document.querySelector('.container').setAttribute('data-show', 'false');
        document.querySelector('.container_mode').setAttribute('data-show', 'true');
      } else {
        return;
      }
    });
  }

  shootCallback({ x, y }) {
    return this.inactivePlayer.check({ x, y });
  }

  onRefresh(aim) {
    this.drawTable(this.player1.matrix, this.player1.enemyMatrix);
    if (this.checkWinner()) return;
    if (!aim) {
      this.activePlayer = this.activePlayer === this.player1 ? this.player2 : this.player1;
      this.inactivePlayer = this.inactivePlayer === this.player1 ? this.player2 : this.player1;
    } else {
      audio.play();
    }
    this.changeTurn();
  }

  changeTurn() {
    if (this.activePlayer.type === 'Player') {
      document.querySelector('.player2').addEventListener('click', this.player1.handler = (e) => {
        this.activePlayer.shoot(e, this.activePlayer);
      });
    } else {
      setTimeout(() => {
        this.activePlayer.shoot();
      }, 10);
    }
  }

  getPlayer() {
    let turn = this.player1.randomInteger(0, 1);
    this.activePlayer = turn ? this.player1 : this.player2;
    this.inactivePlayer = turn ? this.player2 : this.player1;
    message.innerHTML = this.activePlayer.type === 'Bot' ? "Bot's turn" : "Your turn";
    this.changeTurn();
  }

  drawTable(matrix1, matrix2) {
    let battlefield = document.querySelector('.battlefield');
    let table1 = tmpl("table_tmpl",
      {
        cl: 'field player1',
        size: this.size,
        matrix: matrix1,
        name: 'Your field'
      });

    let table2 = tmpl("table_tmpl",
      {
        cl: 'field player2',
        size: this.size,
        matrix: matrix2,
        name: "Bot's field"
      });

    battlefield.innerHTML = table1;
    battlefield.innerHTML += table2;

    let elements = document.querySelectorAll('.boom');
    elements.forEach(element => {
      let sprite = new Motio(element, { fps: 10, frames: 12 });
      sprite.toEnd();
    });
  }

  checkWinner() {
    let finish = false;
    let s = this.size;
    if (this.player1.count === 10) {
      finish = true;
      this.drawTable(this.player1.matrix, this.player2.matrix);
      alert('You won!');
      this.destroy();
    } else if (this.player2.count === 10) {
      finish = true;
      this.drawTable(this.player1.matrix, this.player2.matrix);
      alert('Bot won!');
      this.destroy();
    }
    return finish;
  }

  destroy() {
    this.player1.destroy();
    this.player2.destroy();
    this.removeEvents();
    document.querySelector('.container').setAttribute('data-show', 'false');
    document.querySelector('.play_with_bot').setAttribute('data-show', 'true');
    document.querySelector('.play_with_player').setAttribute('data-show', 'true');
  }

  removeEvents() {
    randomB.removeEventListener('click', this.handlerRanB);
    ready.removeEventListener('click', this.handlerRB);
    document.querySelector('.exit').removeEventListener('click', this.handlerExit);
  }
}

document.querySelector('.play_with_bot').addEventListener('click', () => {
  document.querySelector('.play_with_bot').setAttribute('data-show', 'false');
  document.querySelector('.play_with_player').setAttribute('data-show', 'false');
  document.querySelector('.container').setAttribute('data-show', 'true');
  game = new GameL(10);
});
