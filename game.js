
class Level {
  constructor(plan) {
    let rows = plan
      .trim()
      .split("\n")
      .map((row) => [...row]);
    this.height = rows.length;
    this.width = rows[0].length;
    this.startActors = [];

    const levelChars = {
      "#": "wall",
      ".": "empty",
      "+": "lava",
      "|": Lava,
      "=": Lava,
      v: Lava,
      "@": Player,
      o: Coin,
      m: Monster,
    };

    this.rows = rows.map((row, y) => {
      return row.map((char, x) => {
        let type = levelChars[char];

        if (typeof type == "string") return type;
        this.startActors.push(type.create(new Vec(x, y), char));
        return "empty";
      });
    });
  }
}

Level.prototype.touches = function (pos, size, type) {
  let xStart = Math.floor(pos.x);
  let xEnd = Math.ceil(pos.x + size.x);
  let yStart = Math.floor(pos.y);
  let yEnd = Math.ceil(pos.y + size.y);

  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      let isOutside = x < 0 || x > this.width || y < 0 || y > this.height;
      let currentType;
      try {
        currentType = isOutside ? "wall" : this.rows[y][x];
      } catch (e) {
        console.log("x: ", x, "y: ", y);
        throw e;
      }
      if (currentType === type) return true;
    }
  }
  return false;
};

class State {
  constructor(level, actors, status) {
    this.level = level;
    this.actors = actors;
    this.status = status;
  }

  static start(level) {
    return new State(level, level.startActors, "playing");
  }

  get player() {
    return this.actors.find((a) => a.type == "player");
  }
}

function overlap(actor1, actor2) {
  return (
    actor1.pos.x + actor1.size.x > actor2.pos.x &&
    actor1.pos.x < actor2.pos.x + actor2.size.x &&
    actor1.pos.y + actor1.size.y > actor2.pos.y &&
    actor1.pos.y < actor2.pos.y + actor2.size.y
  );
}

State.prototype.update = function (time, keys) {
  let actors = this.actors.map((actor) => actor.update(time, this, keys));
  let newState = new State(this.level, actors, this.status);
  if (newState.status != "playing") return newState;
  let player = newState.player;
  if (this.level.touches(player.pos, player.size, "lava")) {
    return new State(this.level, actors, "lost");
  }
  actors.forEach((actor) => {
    if (actor.type != "player" && overlap(actor, player)) {
      newState = actor.collide(newState);
    }
  });
  return newState;
};

class Vec {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
  plus(other) {
    return new Vec(this.x + other.x, this.y + other.y);
  }
  times(factor) {
    return new Vec(this.x * factor, this.y * factor);
  }
}

class Player {
  constructor(pos, speed) {
    this.pos = pos;
    this.speed = speed;
  }
  get type() {
    return "player";
  }
  static create(pos) {
    return new Player(pos.plus(new Vec(0, -0.5)), new Vec(0, 0));
  }
}

Player.prototype.size = new Vec(0.8, 1.5);

const playerXSpeed = 7;
const gravity = 30;
const jumpSpeed = 17;

Player.prototype.update = function (time, state, keys) {
  let xSpeed = 0;
  if (keys.ArrowLeft) xSpeed -= playerXSpeed;
  if (keys.ArrowRight) xSpeed += playerXSpeed;
  let pos = this.pos;
  let movedX = pos.plus(new Vec(xSpeed * time, 0));
  if (!state.level.touches(movedX, this.size, "wall")) {
    pos = movedX;
  }
  let ySpeed = this.speed.y + gravity * time;
  let movedY = pos.plus(new Vec(0, ySpeed * time));
  if (!state.level.touches(movedY, this.size, "wall")) {
    pos = movedY;
  } else if (keys.ArrowUp && ySpeed > 0) {
    ySpeed = -jumpSpeed;
  } else {
    ySpeed = 0;
  }
  return new Player(pos, new Vec(xSpeed, ySpeed));
};

class Monster {
  constructor(pos, speed) {
    this.pos = pos;
    this.speed = speed;
  }

  get type() {
    return "monster";
  }

  static create(pos) {
    return new Monster(pos.plus(new Vec(0, -0.5)), new Vec(3, 0));
  }
}

Monster.prototype.size = new Vec(0.8, 1.5);

Monster.prototype.collide = function (state) {
  return new State(state.level, state.actors, "lost");
};

Monster.prototype.update = function (time, state) {
  let playerPosX = state.player.pos.x;
  let newPos = this.pos;
  if (
    newPos.x < playerPosX &&
    !state.level.touches(
      this.pos.plus(this.speed.times(time)),
      this.size,
      "wall"
    )
  ) {
    newPos = this.pos.plus(this.speed.times(time));
  } else if (
    newPos.x > playerPosX &&
    !state.level.touches(
      this.pos.plus(this.speed.times(time).times(-1)),
      this.size,
      "wall"
    )
  ) {
    newPos = this.pos.plus(this.speed.times(time).times(-1));
  }
  return new Monster(newPos, this.speed);
};

class Lava {
  constructor(pos, speed, reset) {
    this.pos = pos;
    this.speed = speed;
    this.reset = reset;
  }

  get type() {
    return "lava";
  }

  static create(pos, char) {
    switch (char) {
      case "=":
        return new Lava(pos, new Vec(3, 0));
        break;
      case "v":
        return new Lava(pos, new Vec(0, 3), pos);
        break;
      case "|":
        return new Lava(pos, new Vec(0, 3));
        break;
    }
  }
}

Lava.prototype.size = new Vec(1, 1);

Lava.prototype.collide = function (state) {
  return new State(state.level, state.actors, "lost");
};

Lava.prototype.update = function (time, state) {
  let newPos = this.pos.plus(this.speed.times(time));
  if (state.level.touches(newPos, this.size, "wall")) {
    if (this.reset) {
      return new Lava(this.reset, this.speed, this.reset);
    }
    return new Lava(this.pos, this.speed.times(-1));
  }
  return new Lava(newPos, this.speed, this.reset);
};

class Coin {
  constructor(pos, basePos, wobble) {
    this.pos = pos;
    this.basePos = basePos;
    this.wobble = wobble;
  }

  get type() {
    return "coin";
  }

  static create(pos) {
    return new Coin(pos, pos, Math.random() * 2 * Math.PI);
  }
}

Coin.prototype.size = new Vec(0.6, 0.6);

Coin.prototype.collide = function (state) {
  let filtredActors = state.actors.filter((actor) => actor != this);
  let status = filtredActors.some((actor) => actor.type === "coin")
    ? state.status
    : "won";
  return new State(state.level, filtredActors, status);
};

const wobbleSpeed = 8,
  wobbleDist = 0.2;

Coin.prototype.update = function (time) {
  let wobble = this.wobble + time * wobbleSpeed;
  let wobblePos = Math.sin(wobble) * wobbleDist;
  return new Coin(
    this.basePos.plus(new Vec(0, wobblePos)),
    this.basePos,
    wobble
  );
};

class DOMDisplay {
  constructor(parent, level) {
    this.dom = elt("div", { class: "game" }, drawGrid(level));
    this.actorLayer = null;
    parent.appendChild(this.dom);
  }

  clear() {
    this.dom.remove();
  }
}

DOMDisplay.prototype.syncState = function (state) {
  if (this.actorLayer) this.actorLayer.remove();
  this.actorLayer = drawActors(state.actors);
  this.dom.appendChild(this.actorLayer);
  this.dom.className = `game ${state.status}`;
  this.scrollPlayerIntoView(state);
};

DOMDisplay.prototype.scrollPlayerIntoView = function (state) {
  "use strict";
  let width = this.dom.clientWidth;
  let height = this.dom.clientHeight;
  let margin = width / 3;
  let left = this.dom.scrollLeft,
    right = left + width;
  let top = this.dom.scrollTop,
    bottom = top + height;
  let player = state.player;
  let center = player.pos.plus(player.size.times(0.5)).times(scale);
  if (center.x < left + margin) {
    this.dom.scrollLeft = center.x - margin;
  } else if (center.x > right - margin) {
    this.dom.scrollLeft = center.x + margin - width;
  }
  if (center.y < top + margin) {
    this.dom.scrollTop = center.y - margin;
  } else if (center.y > bottom - margin) {
    this.dom.scrollTop = center.y + margin - height;
  }
};

function elt(name, attrs, ...children) {
  let element = document.createElement(name);
  for (prop of Object.keys(attrs)) {
    let val = attrs[prop];
    element.setAttribute(prop, val);
  }
  children.forEach((child) => {
    element.appendChild(child);
  });
  return element;
}

const scale = 20;

function drawGrid(level) {
  return elt(
    "table",
    {
      class: "background",
      style: `width: ${level.width * scale}px`,
    },
    ...level.rows.map((row) =>
      elt(
        "tr",
        { style: `height: ${scale}px` },
        ...row.map((type) => elt("td", { class: type }))
      )
    )
  );
}

function drawActors(actors) {
  return elt(
    "div",
    {},
    ...actors.map((actor) =>
      elt("div", {
        class: `actor ${actor.type}`,
        style: `
          width: ${actor.size.x * scale}px; 
          height: ${actor.size.y * scale}px; 
          left: ${actor.pos.x * scale}px; 
          top: ${actor.pos.y * scale}px
        `,
      })
    )
  );
}

function trackKeys(keys) {
  let down = Object.create(null);
  function track(event) {
    if (keys.includes(event.key)) {
      down[event.key] = event.type == "keydown";
      event.preventDefault();
    }
  }
  down.track = function () {
    window.addEventListener("keydown", track);
    window.addEventListener("keyup", track);
  };
  down.untrack = function () {
    window.removeEventListener("keydown", track);
    window.removeEventListener("keyup", track);
  };
  return down;
}

const arrowKeys = trackKeys(["ArrowLeft", "ArrowRight", "ArrowUp"]);

function runAnimation(frameFunc, paused) {
  let lastTime = null;
  function frame(time) {
    if (lastTime != null) {
      let timeStep = Math.min(time - lastTime, 100) / 1000;
      if (paused.value) timeStep = 0;
      if (!frameFunc(timeStep)) return;
    }
    lastTime = time;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function runLevel(level, Display) {
  let display = new Display(document.querySelector("#game_container"), level);
  let state = State.start(level);
  let ending = 1;
  let paused = { value: false };
  window.addEventListener("keydown", (event) => {
    if (event.key == "Escape") {
      paused.value = !paused.value;
      if (paused.value) {
        arrowKeys.untrack();
        document.querySelector("#paused").style.visibility = "visible";
      } else {
        arrowKeys.track();
        document.querySelector("#paused").style.visibility = "hidden";
      }
    }
  });
  arrowKeys.track();
  return new Promise((resolve) => {
    runAnimation((time) => {
      state = state.update(time, arrowKeys);
      display.syncState(state);
      if (state.status === "playing") return true;
      else if (ending > 0) {
        ending -= time;
        return true;
      } else {
        display.clear();
        resolve(state.status);
        return false;
      }
    }, paused);
  });
}

async function runGame(levels, Display) {
  function updateLives() {
    document.querySelector("#lives").innerHTML = lives;
  }
  let lives = 3;
  updateLives();
  for (let levelIndex = 0; levelIndex < levels.length; ) {
    let status = await runLevel(new Level(levels[levelIndex]), Display);
    if (status === "won") {
      levelIndex++;
    } else {
      lives--;
      if (lives == 0) {
        levelIndex = 0;
        lives = 3;
      }
      updateLives();
    }
  }
}
