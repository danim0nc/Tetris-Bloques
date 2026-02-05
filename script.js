const COLS = 10;
const ROWS = 20;
const DROP_INTERVAL = 700;
const DOUBLE_DOWN_MS = 250;

const PRONOUNS = ["yo", "tú", "él", "ella", "nosotros", "ustedes", "ellos"];
const NOUNS = ["la casa", "el libro", "un café", "la música", "el parque", "un amigo", "la ciudad"];
const MODIFIERS = {
  preposiciones: ["en", "con", "sobre", "para", "desde", "hacia"],
  articulosDef: ["el", "la", "los", "las"],
  articulosInd: ["un", "una", "unos", "unas"],
};

const VERBS = {
  hablar: {
    basico: ["hablo", "hablas", "habla", "hablamos"],
    medio: ["hablé", "hablaba", "hablaré", "hablaría"],
    avanzado: ["haya hablado", "hubiera hablado", "hablase", "habría hablado"],
  },
  comer: {
    basico: ["como", "comes", "come", "comemos"],
    medio: ["comí", "comía", "comeré", "comería"],
    avanzado: ["haya comido", "hubiera comido", "comiese", "habría comido"],
  },
  vivir: {
    basico: ["vivo", "vives", "vive", "vivimos"],
    medio: ["viví", "vivía", "viviré", "viviría"],
    avanzado: ["haya vivido", "hubiera vivido", "viviese", "habría vivido"],
  },
  estudiar: {
    basico: ["estudio", "estudias", "estudia", "estudiamos"],
    medio: ["estudié", "estudiaba", "estudiaré", "estudiaría"],
    avanzado: ["haya estudiado", "hubiera estudiado", "estudiase", "habría estudiado"],
  },
};

const board = document.getElementById("board");
const scoreEl = document.getElementById("score");
const phrasesEl = document.getElementById("phrases");
const restartBtn = document.getElementById("restart");
const difficultySelect = document.getElementById("difficulty");

let grid = [];
let current = null;
let dropTimer = null;
let score = 0;
let blockIdCounter = 1;
let blocks = new Map();
let lastDownTime = 0;

const SHAPES = {
  square: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ],
  rect: [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
  ],
  lshape: [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
  ],
};

function initGrid() {
  grid = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => null)
  );
}

function createCells() {
  board.innerHTML = "";
  for (let i = 0; i < ROWS * COLS; i += 1) {
    const cell = document.createElement("div");
    cell.className = "cell";
    board.appendChild(cell);
  }
}

function cellIndex(x, y) {
  return y * COLS + x;
}

function render() {
  const cells = board.children;
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const cell = cells[cellIndex(x, y)];
      const data = grid[y][x];
      cell.className = "cell";
      cell.innerHTML = "";
      if (data) {
        cell.classList.add("filled", data.type);
        if (data.text && data.showText) {
          const span = document.createElement("span");
          span.textContent = data.text;
          cell.appendChild(span);
        }
      }
    }
  }
}

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomKey(obj) {
  const keys = Object.keys(obj);
  return keys[Math.floor(Math.random() * keys.length)];
}

function createBlock() {
  const types = ["square", "rect", "lshape"];
  const type = randomFrom(types);
  const id = blockIdCounter++;
  let text = "";
  let payload = {};

  if (type === "square") {
    text = randomFrom(PRONOUNS);
  }
  if (type === "rect") {
    const verb = randomKey(VERBS);
    const level = difficultySelect.value;
    text = randomFrom(VERBS[verb][level]);
    payload = { verb, level };
  }
  if (type === "lshape") {
    const noun = randomFrom(NOUNS);
    const modifier = randomModifier();
    text = `${modifier} ${noun}`;
    payload = { noun };
  }

  return {
    id,
    type,
    rotation: 0,
    x: 4,
    y: 0,
    text,
    payload,
  };
}

function randomModifier() {
  const groups = Object.values(MODIFIERS);
  return randomFrom(randomFrom(groups));
}

function rotatedShape(type, rotation) {
  let shape = SHAPES[type];
  let coords = shape.map((c) => ({ ...c }));
  for (let i = 0; i < rotation; i += 1) {
    coords = coords.map(({ x, y }) => ({ x: -y, y: x }));
    const minX = Math.min(...coords.map((c) => c.x));
    const minY = Math.min(...coords.map((c) => c.y));
    coords = coords.map((c) => ({ x: c.x - minX, y: c.y - minY }));
  }
  return coords;
}

function canMove(block, dx, dy, rotation = block.rotation) {
  const shape = rotatedShape(block.type, rotation);
  return shape.every(({ x, y }) => {
    const newX = block.x + x + dx;
    const newY = block.y + y + dy;
    if (newX < 0 || newX >= COLS || newY >= ROWS) {
      return false;
    }
    if (newY < 0) {
      return true;
    }
    const cell = grid[newY][newX];
    return !cell || cell.id === block.id;
  });
}

function placeBlock(block) {
  const shape = rotatedShape(block.type, block.rotation);
  shape.forEach(({ x, y }, index) => {
    const gx = block.x + x;
    const gy = block.y + y;
    if (gy >= 0 && gy < ROWS) {
      grid[gy][gx] = {
        id: block.id,
        type: block.type === "lshape" ? "el" : block.type,
        text: block.text,
        showText: index === 0,
      };
    }
  });
  blocks.set(block.id, {
    id: block.id,
    type: block.type,
    rotation: block.rotation,
    x: block.x,
    y: block.y,
    text: block.text,
    payload: block.payload,
  });
}

function clearBlock(block) {
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (grid[y][x]?.id === block.id) {
        grid[y][x] = null;
      }
    }
  }
}

function spawnBlock() {
  current = createBlock();
  if (!canMove(current, 0, 0)) {
    stopGame();
  } else {
    drawCurrent();
  }
}

function drawCurrent() {
  clearBlock(current);
  placeBlock(current);
  render();
}

function lockCurrent() {
  blocks.set(current.id, { ...current });
  checkPhrases();
  settleBlocks();
  spawnBlock();
}

function tick() {
  if (!current) {
    return;
  }
  if (canMove(current, 0, 1)) {
    current.y += 1;
    drawCurrent();
  } else {
    lockCurrent();
  }
}

function startGame() {
  initGrid();
  blocks = new Map();
  score = 0;
  scoreEl.textContent = score;
  phrasesEl.innerHTML = "";
  createCells();
  if (dropTimer) {
    clearInterval(dropTimer);
  }
  spawnBlock();
  dropTimer = setInterval(tick, DROP_INTERVAL);
}

function stopGame() {
  clearInterval(dropTimer);
  current = null;
  alert("Juego terminado. ¡Intenta de nuevo!");
}

function updateVerb(block) {
  if (block.type !== "rect") return;
  const verb = block.payload.verb;
  const level = difficultySelect.value;
  block.text = randomFrom(VERBS[verb][level]);
}

function updateLShape(block) {
  if (block.type !== "lshape") return;
  const modifier = randomModifier();
  block.text = `${modifier} ${block.payload.noun}`;
}

function handleRotate() {
  if (!current) return;
  if (current.type === "square") {
    return;
  }
  const nextRotation = (current.rotation + 1) % 4;
  if (canMove(current, 0, 0, nextRotation)) {
    current.rotation = nextRotation;
  }
  if (current.type === "rect") {
    updateVerb(current);
  }
  if (current.type === "lshape") {
    updateLShape(current);
  }
  drawCurrent();
}

function handleDown() {
  const now = Date.now();
  if (now - lastDownTime < DOUBLE_DOWN_MS) {
    while (canMove(current, 0, 1)) {
      current.y += 1;
    }
    drawCurrent();
    lockCurrent();
    lastDownTime = 0;
    return;
  }
  lastDownTime = now;
  if (canMove(current, 0, 1)) {
    current.y += 1;
    drawCurrent();
  }
}

function handleKey(event) {
  if (!current) return;
  switch (event.key) {
    case "ArrowLeft":
      if (canMove(current, -1, 0)) {
        current.x -= 1;
        drawCurrent();
      }
      break;
    case "ArrowRight":
      if (canMove(current, 1, 0)) {
        current.x += 1;
        drawCurrent();
      }
      break;
    case "ArrowDown":
      handleDown();
      break;
    case "ArrowUp":
      handleRotate();
      break;
    default:
      break;
  }
}

function adjacencyMap() {
  const map = new Map();
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const cell = grid[y][x];
      if (!cell) continue;
      const id = cell.id;
      if (!map.has(id)) map.set(id, new Set());
      const neighbors = [
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 },
      ];
      neighbors.forEach((pos) => {
        if (pos.x < 0 || pos.x >= COLS || pos.y < 0 || pos.y >= ROWS) return;
        const neighbor = grid[pos.y][pos.x];
        if (neighbor && neighbor.id !== id) {
          if (!map.has(id)) map.set(id, new Set());
          map.get(id).add(neighbor.id);
        }
      });
    }
  }
  return map;
}

function blockType(id) {
  const block = blocks.get(id);
  return block?.type;
}

function checkPhrases() {
  const adj = adjacencyMap();
  const phrases = [];
  const toRemove = new Set();

  for (const [id, neighbors] of adj.entries()) {
    if (blockType(id) !== "square" || toRemove.has(id)) continue;
    for (const verbId of neighbors) {
      if (blockType(verbId) !== "rect" || toRemove.has(verbId)) continue;
      const verbNeighbors = adj.get(verbId) || new Set();
      for (const compId of verbNeighbors) {
        if (blockType(compId) !== "lshape" || toRemove.has(compId)) continue;
        const pronoun = blocks.get(id)?.text;
        const verb = blocks.get(verbId)?.text;
        const complement = blocks.get(compId)?.text;
        if (pronoun && verb && complement) {
          phrases.push(`${pronoun} ${verb} ${complement}`);
          toRemove.add(id);
          toRemove.add(verbId);
          toRemove.add(compId);
        }
      }
    }
  }

  if (phrases.length > 0) {
    phrases.forEach((phrase) => {
      const li = document.createElement("li");
      li.textContent = phrase;
      phrasesEl.appendChild(li);
      score += 100;
    });
    scoreEl.textContent = score;
    toRemove.forEach((id) => removeBlockById(id));
    render();
  }
}

function removeBlockById(id) {
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (grid[y][x]?.id === id) {
        grid[y][x] = null;
      }
    }
  }
  blocks.delete(id);
}

function settleBlocks() {
  let moved = true;
  while (moved) {
    moved = false;
    blocks.forEach((block) => {
      if (block.id === current?.id) return;
      if (canBlockFall(block)) {
        clearBlock(block);
        block.y += 1;
        placeBlock(block);
        moved = true;
      }
    });
  }
  render();
}

function canBlockFall(block) {
  const shape = rotatedShape(block.type, block.rotation);
  return shape.every(({ x, y }) => {
    const gx = block.x + x;
    const gy = block.y + y + 1;
    if (gy >= ROWS) return false;
    const cell = grid[gy][gx];
    return !cell || cell.id === block.id;
  });
}

restartBtn.addEventListener("click", startGame);
difficultySelect.addEventListener("change", () => {
  if (current?.type === "rect") {
    updateVerb(current);
    drawCurrent();
  }
});

document.addEventListener("keydown", handleKey);

startGame();
