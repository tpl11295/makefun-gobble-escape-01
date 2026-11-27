// Gobble's Great Escape — the game boot and loop.
//
// With ?shot=start|play|chase|end&seed=N the game stages one deterministic
// scene, paints it twice, and sets window.__shotReady for the screenshot
// helper: the four pictures in screenshots/ are taken exactly this way.
// Without a shot it runs the game: a fixed-step loop (1/60 s), the title,
// the run, the pause, and the end screen, with the best score kept in this
// browser.

import { BEST_KEY, FIELD, STEP } from './config.js';
import { createWorld, resetWorld, stepAmbient, stepWorld, WORLD_EVENTS } from './world.js';
import { render } from './render.js';
import { attachInput, clearOneShots, createInput, readMove } from './input.js';
import {
  createAudio,
  ensureAudio,
  playAlarm,
  playDash,
  playGateOpen,
  playGobble,
  playHit,
  playLose,
  playPickup,
  playWin,
  setSizzle,
} from './audio.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const status = document.querySelector('#status');

function fitCanvas() {
  const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
  canvas.style.width = `${Math.floor(FIELD.width * scale)}px`;
  canvas.style.height = `${Math.floor(FIELD.height * scale)}px`;
}

function paint(world) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#20261c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(canvas.width / FIELD.width, 0, 0, canvas.height / FIELD.height, 0, 0);
  render(ctx, world, world.time);
}

function announce(message) {
  if (status) status.textContent = message;
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function writeBest(score) {
  try {
    window.localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // A best score that cannot be stored is a pity, never an error.
  }
}

if (shot) {
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;
  const { world } = stageShot(shot, seed);
  world.best = readBest();
  paint(world);
  paint(world);
  window.__shotReady = true;
} else {
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  const audio = createAudio();
  const input = createInput();
  attachInput(input, canvas, (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * FIELD.width,
      y: ((clientY - rect.top) / rect.height) * FIELD.height,
    };
  });

  let world = createWorld(Math.floor(Math.random() * 2147483647), 1);
  world.best = readBest();
  let lastAnnounced = '';

  function playEventSounds() {
    for (const event of world.events) {
      if (event === WORLD_EVENTS.SPOTTED) playAlarm(audio);
      else if (event === WORLD_EVENTS.CORN) playPickup(audio);
      else if (event === WORLD_EVENTS.HIT) playHit(audio);
      else if (event === WORLD_EVENTS.DASH) playDash(audio);
      else if (event === WORLD_EVENTS.GATE_OPEN) playGateOpen(audio);
      else if (event === WORLD_EVENTS.ESCAPED) playWin(audio);
      else if (event === WORLD_EVENTS.CAUGHT) playLose(audio);
    }
    world.events.length = 0;
  }

  function startRun() {
    ensureAudio(audio);
    playGobble(audio);
    world.state = 'play';
    announce('The turkey is running. Collect three corn cobs, then reach the forest gate.');
  }

  function nextYard() {
    const next = createWorld(world.seed, world.level + 1);
    next.score = world.score;
    next.best = world.best;
    world = next;
    world.state = 'play';
    announce(`Yard ${world.level}: ${world.layout.name}. The farmer is faster here.`);
  }

  function restartRun() {
    const fresh = resetWorld(world, world.level);
    fresh.best = world.best;
    fresh.score = 0;
    world = fresh;
    world.state = 'play';
    announce('A fresh run. Collect three corn cobs, then reach the forest gate.');
  }

  let lastTime = performance.now();
  let accumulator = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min(0.25, (now - lastTime) / 1000);
    lastTime = now;
    accumulator += elapsed;

    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      accumulator -= STEP;
      steps += 1;
      if (world.state === 'title') {
        stepAmbient(world, STEP);
        if (input.confirm) startRun();
      } else if (world.state === 'play') {
        if (input.pause) {
          world.state = 'paused';
          announce('Paused.');
        } else {
          const move = readMove(input, world.turkey);
          stepWorld(world, { mx: move.mx, my: move.my, dash: input.dash }, STEP);
          playEventSounds();
          setSizzle(audio, world.inHeat);
          if (world.state === 'over') {
            if (world.score > world.best) {
              world.best = world.score;
              writeBest(world.best);
            }
            announce(
              world.outcome === 'escaped'
                ? `Escaped with ${world.score} points.`
                : `Caught with ${world.score} points.`,
            );
          }
        }
      } else if (world.state === 'paused') {
        if (input.pause || input.confirm) {
          world.state = 'play';
          announce('Running again.');
        }
      } else if (world.state === 'over') {
        if (input.restart) restartRun();
        else if (input.next && world.outcome === 'escaped' && world.level < 3) nextYard();
        else if (input.confirm && world.outcome === 'caught') restartRun();
      }
      clearOneShots(input);
    }
    if (steps === 5) accumulator = 0;

    const announcement =
      world.state === 'title'
        ? 'Gobble’s Great Escape. Press Space or click to play.'
        : world.state === 'play'
          ? ''
          : world.state === 'paused'
            ? 'Paused.'
            : world.outcome === 'escaped'
              ? 'Escaped.'
              : 'Caught.';
    if (announcement && announcement !== lastAnnounced) {
      lastAnnounced = announcement;
      announce(announcement);
    }

    paint(world);
  }

  announce('Gobble’s Great Escape. Press Space or click to play.');
  requestAnimationFrame(frame);
}
