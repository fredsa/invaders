var ALIEN_ROWS = 10;
var ALIEN_COLS = 12;
var ALIENS = ALIEN_COLS * ALIEN_ROWS;
var EXPLOSIONS = 3;

// http://en.wikipedia.org/wiki/Web_colors
var COLORS = [
  'White',
  'Silver',
  'Gray',
  'Black',
  'Red',
  'Maroon',
  'Yellow',
  'Olive',
  'Lime',
  'Green',
  'Aqua',
  'Teal',
  'Blue',
  'Navy',
  'Fuchsia',
  'Purple',
];

var KEY_CODE_LEFT = 37;
var KEY_CODE_UP = 38;
var KEY_CODE_RIGHT = 39;
var KEY_CODE_DOWN = 40;

var ship;
var laser;
var aliens = new Array(ALIENS);
var explosions = new Array(EXPLOSIONS);
var score;
var lives;
var is_firing;

var context = new AudioContext();
var synthloop_audio_buffer;
var laser_audio_buffer;
var explosion_audio_buffer;
var frame_count;

window.addEventListener("load", start_game);

var game_objects = [];


/* Helper functions */

function create_div(innerText) {
  var elem = document.createElement("div");
  elem.innerText = innerText;
  document.body.appendChild(elem);
  return elem;
}


/* Generic game object */

function GameObject(innerText) {
  if (innerText === undefined) {
    return;
  }

  this.x = -1000;
  this.y = -1000;

  this.elem = create_div(innerText);

  this.reset();

  this.half_width = this.elem.offsetWidth / 2;
  this.half_height = this.elem.offsetHeight / 2;
  this.elem.style.marginLeft = "-" + this.half_width + "px";
  this.elem.style.marginTop = "-" + this.half_height + "px";

  game_objects.push(this);
};

GameObject.prototype.log = function log() {
  var args = Array.prototype.slice.call(arguments);
  if (log.caller.name) {
    args.unshift(this.constructor.name + '.' + log.caller.name + '():');
  } else {
    args.unshift(this.constructor.name + ':');
  }
  console.log.apply(console, args);
}

GameObject.prototype.activate = function activate() {
  this.active = true;
};

GameObject.prototype.reset = function reset() {
  this.speed_x = 0;
  this.speed_y = 0;

  this.active = false;
};

GameObject.prototype.handle_resize = function handle_resize() {
  this.min_x = this.half_width;
  this.min_y = this.half_height;
  this.max_x = window.innerWidth - this.half_width;
  this.max_y = window.innerHeight - this.half_height;
};

GameObject.prototype.do_math = function do_math() {
  this.x += this.speed_x;
  this.y += this.speed_y;
};

GameObject.prototype.edge_check = function edge_check() {
  if (this.x < this.min_x) {
    this.x = this.min_x;
  } else if (this.x > this.max_x) {
    this.x = this.max_x;
  }
  if (this.y < this.min_y) {
    this.y = this.min_y;
  } else if (this.y > this.max_y) {
    this.y = this.max_y;
  }
};

GameObject.prototype.step = function step() {
  this.do_math();

  this.elem.style.left = this.x + "px";
  this.elem.style.top = this.y + "px";

  if (!this.active) {
    return;
  }

  this.edge_check();
};


/* Player ship */

function Ship(innerText) {
  GameObject.apply(this, arguments);

  this.MOVE_SPEED = 4;
  this.RECOVERY_FRAMES = 150;
};

Ship.prototype = new GameObject();
Ship.prototype.constructor = Ship;

Ship.prototype.reset = function reset() {
  GameObject.prototype.reset.apply(this, arguments);
  this.x = window.innerWidth / 2;
  this.elem.style.opacity = 1;
};

Ship.prototype.handle_resize = function handle_resize() {
  GameObject.prototype.handle_resize.apply(this, arguments);
  this.y = window.innerHeight - this.half_height;
};

Ship.prototype.step = function step() {
  GameObject.prototype.step.apply(this, arguments);
  if (this.frames_until_resume && lives.count > 0) {
    this.frames_until_resume--;
    this.elem.style.opacity = frame_count / 4 % 2 * .4;
    if (this.frames_until_resume == 0) {
      this.reset();
      this.active = true;
    }
  }
};

Ship.prototype.left = function left() {
  ship.speed_x = -ship.MOVE_SPEED;
};

Ship.prototype.right = function right() {
  ship.speed_x = ship.MOVE_SPEED;
};

Ship.prototype.hold = function hold() {
  this.speed_x = 0;
}

Ship.prototype.die = function die() {
  this.frames_until_resume = this.RECOVERY_FRAMES;
  this.elem.style.opacity = .15;
  lives.add_count(-1);
  if (lives.count == 0) {
    gameover.style.visibility = "visible";
  }
}


/* Player laser */

function Laser(innerText) {
  GameObject.apply(this, arguments);
};

Laser.prototype = new GameObject();
Laser.prototype.constructor = Laser;

Laser.prototype.handle_resize = function handle_resize() {
  GameObject.prototype.handle_resize.apply(this, arguments);
  this.min_y = -this.half_height;
  this.max_y = window.innerHeight + this.half_height;
  this.leave_y = window.innerHeight - ship.half_height * 2 - this.half_height;
  if (!this.is_firing()) {
    this.reset();
  }
}

Laser.prototype.edge_check = function edge_check() {
  GameObject.prototype.edge_check.apply(this, arguments);
  if (this.y == this.min_y) {
    this.reset();
  }
};

Laser.prototype.do_math = function do_math() {
  GameObject.prototype.do_math.apply(this, arguments);
  if (this.y > this.leave_y) {
    this.x = ship.x;
    this.speed_x = ship.speed_x;
  } else {
    this.speed_x = this.speed_x * .9;
  }
};

Laser.prototype.is_firing = function is_firing() {
  return this.speed_y != 0;
};

Laser.prototype.fire = function(move_speed) {
  if (this.is_firing()) {
    return;
  }
  this.activate();
  play_sound(laser_audio_buffer, 1);
  this.x = ship.x;
  this.y = this.max_y;
  this.speed_y = -move_speed;
};

Laser.prototype.reset = function reset() {
  GameObject.prototype.reset.apply(this, arguments);
  this.y = this.max_y;
  this.speed_y = 0;
};


/* Counter */

function Counter(innerText, left, top) {
  this.prefix = innerText;
  this.left = left;
  this.top = top;
  GameObject.apply(this, arguments);
};

Counter.prototype = new GameObject();
Counter.prototype.constructor = Counter;

Counter.prototype.reset = function reset() {
  GameObject.prototype.reset.apply(this, arguments);
  this.x = this.left;
  this.y = this.top;
  this.count = 0;
  this.add_count(0);
};

Counter.prototype.handle_resize = function handle_resize() {
  GameObject.prototype.handle_resize.apply(this, arguments);
  this.min_x = this.half_width;
  this.min_y = this.half_height;
  this.max_x = window.innerWidth - this.half_width;
  this.max_y = window.innerHeight - this.half_height;
}

Counter.prototype.add_count = function add_count(count) {
  this.count += count;
  this.elem.innerText = this.prefix + this.count;
};



/* Alien ship */

function Alien(innerText, column, row) {
  GameObject.apply(this, arguments);

  this.MOVE_SPEED = 1;
  this.speed_x = this.MOVE_SPEED;
  this.column = column;
  this.row = row;
};

Alien.prototype = new GameObject();
Alien.prototype.constructor = Alien;

Alien.prototype.activate = function activate() {
  GameObject.prototype.activate.apply(this, arguments);
  this.aliens_cover_width = window.innerWidth * .6;
  this.aliens_cover_height = window.innerHeight * .4;
  this.x = window.innerWidth * .2 + this.aliens_cover_width / ALIEN_COLS * this.column;
  this.y = window.innerHeight * .1 + this.aliens_cover_height / ALIEN_ROWS * this.row;
};

Alien.prototype.reset = function reset() {
  GameObject.prototype.reset.apply(this, arguments);
  this.x = -1000;
  this.y = -1000;
};

Alien.prototype.step = function step() {
  GameObject.prototype.step.apply(this, arguments);
  this.elem.style.color = COLORS[this.row % COLORS.length];
};

Alien.prototype.do_math = function do_math() {
  GameObject.prototype.do_math.apply(this, arguments);
}

Alien.prototype.edge_check = function edge_check() {
  GameObject.prototype.edge_check.apply(this, arguments);
  if (this.x == this.min_x) {
    this.speed_x = this.MOVE_SPEED;
    this.y += 10;
  }
  if (this.x == this.max_x) {
    this.speed_x = -this.MOVE_SPEED;
    this.y += 10;
  }
};


/* Explosion */

function Explosion(innerText) {
  GameObject.apply(this, arguments);
};

Explosion.prototype = new GameObject();
Explosion.prototype.constructor = Explosion;

Explosion.prototype.handle_resize = function handle_resize() {
  GameObject.prototype.handle_resize.apply(this, arguments);
}

Explosion.prototype.reset = function reset() {
  GameObject.prototype.reset.apply(this, arguments);
};

Explosion.prototype.edge_check = function edge_check() {
  GameObject.prototype.edge_check.apply(this, arguments);
};

Explosion.prototype.do_math = function do_math() {
  GameObject.prototype.do_math.apply(this, arguments);
  this.elem.style.opacity *= .8;
  if (this.elem.style.opacity < .1) {
    this.reset();
  }
};

Explosion.prototype.explode_at = function(obj) {
  play_sound(explosion_audio_buffer, .6);
  this.activate();
  this.elem.style.opacity = 1;
  this.x = obj.x;
  this.y = obj.y;
};


/* Start the game */

function start_game() {
  requestAnimationFrame(do_game_frame);

  frame_count = 0;
  is_firing = false;

  score = new Counter("Score: ", 10, 10);
  score.activate();

  lives = new Counter("Lives:", 10, 30);
  lives.add_count(5);
  lives.activate();

  ship = new Ship("/\\");
  ship.activate();

  laser = new Laser("|");

  for(var i=0; i<ALIEN_COLS; i++) {
    for(var j=0; j<ALIEN_ROWS; j++) {
      aliens[i + j * ALIEN_COLS] = new Alien("<o>", i, j);
      aliens[i + j * ALIEN_COLS].activate();
    }
  }

  for(var i=0; i<EXPLOSIONS; i++) {
    explosions[i] = new Explosion("***");
  }

  load_sounds(context, function() {
    play_sound(synthloop_audio_buffer, .7, true);
  });

  window.addEventListener("keydown", key_down);
  window.addEventListener("keyup", key_up);
  window.addEventListener("resize", handle_resize);

  handle_resize();
}

function handle_resize() {
  game_objects.forEach(function(game_object) {
    game_object.handle_resize();
  });
}


function getTimeMillis() {
  return new Date().getTime();
}

function ord(chr) {
  return chr.charCodeAt(0);
}

function key_down(evt) {
  if (evt.keyCode == ord('A') || evt.keyCode == KEY_CODE_LEFT) {
    ship.left();
  }

  if (evt.keyCode == ord('D') || evt.keyCode == KEY_CODE_RIGHT) {
    ship.right();
  }

  if (evt.keyCode == ord('X')) {
    ship.hold();
  }

  if (evt.keyCode == ord(' ')) {
    is_firing = true;
  }
}

function key_up(evt) {
  if (evt.keyCode == ord(' ')) {
    is_firing = false;
  }
}


/* Explosions */

function explode(obj) {
  for(var i=0; i<EXPLOSIONS; i++) {
    if (explosions[i].active) {
      continue;
    }
    explosions[i].explode_at(obj);
  }
  obj.reset();
}


/* Execute one game frame */

function do_game_frame() {
  requestAnimationFrame(do_game_frame);
  frame_count++;

  if (is_firing && lives.count > 0) {
    laser.fire(20);
  }

  game_objects.forEach(function(game_object) {
    game_object.step();
  });

  aliens.forEach(function(alien) {
    if (laser.is_firing() && collision(laser, alien)) {
      score.add_count(10);
      explode(alien);
      laser.reset();
    }
    if (collision(ship, alien)) {
      explode(alien);
      explode(ship);
      ship.die();
    }
  });
}


/* Collision check */

function _collision(p1, w1, p2, w2) {
  return (p1 + w1) > (p2 - w2) && (p1 - w1) < (p2 + w2);
}

function collision(obj1, obj2) {
  return obj1.active && obj2.active &&
    _collision(obj1.x, obj1.half_width, obj2.x, obj2.half_width) &&
    _collision(obj1.y, obj1.half_height, obj2.y, obj2.half_height);
}


/* Audio helpers */

function load_sounds(context, finishedLoading) {
  bufferLoader = new BufferLoader(
    context,
    [
      // http://freesound.org/people/Stereo%20Surgeon/sounds/261208/
      '/audio/261208__stereo-surgeon__insomniac-snyth-loop.mp3',

      // http://freesound.org/people/fins/sounds/146725/
      '/audio/146725__fins__laser.wav',

      // http://freesound.org/people/IanStarGem/sounds/270651/
      '/audio/270651__ianstargem__glitchy-impact-explosion-4.wav',
    ],
    function (bufferList) {
      synthloop_audio_buffer = bufferList[0];
      laser_audio_buffer = bufferList[1];
      explosion_audio_buffer = bufferList[2];
      finishedLoading();
    }
    );

  bufferLoader.load();
}

function play_sound(buffer, gain, loop) {
  var source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = loop;

  var gainNode = context.createGain();
  gainNode.gain.value = gain;

  source.connect(gainNode);
  gainNode.connect(context.destination);
  source.start(0);
}
