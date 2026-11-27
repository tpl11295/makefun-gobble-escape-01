// Keyboard and pointer input, kept apart from the rules: this module only
// reports what the player is doing right now. WASD or the arrow keys steer,
// Space dashes (and confirms on the title and end screens), P pauses, R
// restarts after being caught, Enter moves to the next yard after an escape.
// Holding the pointer down steers the turkey toward it, so the game plays
// with the mouse alone too.

const KEY_DIRECTIONS = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  KeyW: [0, -1],
  KeyS: [0, 1],
  KeyA: [-1, 0],
  KeyD: [1, 0],
};

export function createInput() {
  return {
    keys: new Set(),
    dash: false,
    confirm: false,
    pause: false,
    restart: false,
    next: false,
    pointerDown: false,
    pointerX: 0,
    pointerY: 0,
  };
}

/** The steering vector for this frame: keys first, the held pointer second. */
export function readMove(input, turkey) {
  let mx = 0;
  let my = 0;
  for (const key of input.keys) {
    const direction = KEY_DIRECTIONS[key];
    if (direction) {
      mx += direction[0];
      my += direction[1];
    }
  }
  if (mx !== 0 || my !== 0) {
    const length = Math.hypot(mx, my);
    return { mx: mx / length, my: my / length };
  }
  if (input.pointerDown) {
    const dx = input.pointerX - turkey.x;
    const dy = input.pointerY - turkey.y;
    const length = Math.hypot(dx, dy);
    if (length > 14) return { mx: dx / length, my: dy / length };
  }
  return { mx: 0, my: 0 };
}

export function attachInput(input, canvas, toLogical) {
  window.addEventListener('keydown', (event) => {
    if (event.repeat) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
      return;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    input.keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') input.confirm = true;
    if (event.code === 'Space') input.dash = true;
    if (event.code === 'KeyP' || event.code === 'Escape') input.pause = true;
    if (event.code === 'KeyR') input.restart = true;
    if (event.code === 'Enter') input.next = true;
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.pointerDown = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    input.pointerDown = true;
    const point = toLogical(event.clientX, event.clientY);
    input.pointerX = point.x;
    input.pointerY = point.y;
    input.confirm = true;
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!input.pointerDown) return;
    const point = toLogical(event.clientX, event.clientY);
    input.pointerX = point.x;
    input.pointerY = point.y;
  });
  const release = () => {
    input.pointerDown = false;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', release);
}

/** Clear the one-shot flags after a frame has consumed them. */
export function clearOneShots(input) {
  input.dash = false;
  input.confirm = false;
  input.pause = false;
  input.restart = false;
  input.next = false;
}
