// Keyboard and mouse, read as one honest input state each step. Arrows or the mouse fly
// the aircraft (the mouse steers toward where it sits from the screen's centre), WASD
// covers throttle and rudder for hands that prefer them, and a few keys run the game.

export function createInput(canvas) {
  const keys = new Set();
  const input = {
    pitch: 0, roll: 0, rudder: 0, throttle: 0, brake: false,
    mouseSteer: true,
    pressed: new Set(), // keys that went down since the last read (edge triggers)
  };
  let mouseX = 0;
  let mouseY = 0;
  let mouseSeen = false;

  addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!keys.has(e.code)) input.pressed.add(e.code);
    keys.add(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouseX = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouseY = ((e.clientY - r.top) / r.height) * 2 - 1;
    mouseSeen = true;
  });
  canvas.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (!t) return;
    const r = canvas.getBoundingClientRect();
    mouseX = ((t.clientX - r.left) / r.width) * 2 - 1;
    mouseY = ((t.clientY - r.top) / r.height) * 2 - 1;
    mouseSeen = true;
    e.preventDefault();
  }, { passive: false });

  const held = (code) => keys.has(code) ? 1 : 0;

  /** Sample the controls into the input state. Call once per simulation step. */
  input.read = () => {
    let pitch = held('ArrowDown') - held('ArrowUp'); // pull (down arrow / S-style) raises the nose
    let roll = held('ArrowRight') - held('ArrowLeft');
    if (mouseSeen && input.mouseSteer && roll === 0 && pitch === 0) {
      roll = Math.max(-1, Math.min(1, mouseX * 1.25));
      pitch = Math.max(-1, Math.min(1, mouseY * 1.1)); // mouse low on the screen = pull, like a stick
      if (Math.abs(roll) < 0.09) roll = 0;
      if (Math.abs(pitch) < 0.09) pitch = 0;
    }
    input.pitch = pitch;
    input.roll = roll;
    input.rudder = held('KeyD') - held('KeyA');
    input.throttle = held('KeyW') - held('KeyS');
    input.brake = keys.has('Space');
  };

  /** Take (and clear) the set of keys pressed since the last call. */
  input.takePressed = () => {
    const p = new Set(input.pressed);
    input.pressed.clear();
    return p;
  };

  return input;
}
