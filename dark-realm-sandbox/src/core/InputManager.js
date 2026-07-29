// ============================================================================
// Unified input manager: desktop keyboard/mouse (pointer lock) + mobile touch
// (dual virtual joysticks, tap-to-look, action buttons). Emits a normalized
// movementIntent object consumed by Player, plus discrete action events.
// ============================================================================
import { isMobile } from './Config.js';

export class InputManager {
  constructor(domElement, { onPrimaryAction, onSecondaryAction, onHotbar, onJumpTap, onInteract } = {}) {
    this.dom = domElement;
    this.mobile = isMobile();
    this.keys = new Set();
    this.yawDelta = 0;
    this.pitchDelta = 0;
    this.pointerLocked = false;
    this.callbacks = { onPrimaryAction, onSecondaryAction, onHotbar, onJumpTap, onInteract };

    this.moveVec = { x: 0, y: 0 }; // joystick left
    this.lookVec = { x: 0, y: 0 };
    this.jumpHeld = false;
    this.sprintHeld = false;
    this.crouchHeld = false;
    this.primaryHeld = false;
    this.secondaryHeld = false;

    this._bindDesktop();
    if (this.mobile) this._bindMobileUI();
  }

  _bindDesktop() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (/^Digit[1-9]$/.test(e.code)) this.callbacks.onHotbar?.(parseInt(e.code.replace('Digit', ''), 10) - 1);
      if (e.code === 'KeyE') this.callbacks.onInteract?.();
      if (e.code === 'Space') this.callbacks.onJumpTap?.();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    this.dom.addEventListener('click', () => {
      if (!this.mobile && document.pointerLockElement !== this.dom) this.dom.requestPointerLock?.();
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.dom;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.yawDelta -= e.movementX * 0.0022;
      this.pitchDelta -= e.movementY * 0.0022;
    });
    this.dom.addEventListener('mousedown', (e) => {
      if (!this.pointerLocked) return;
      if (e.button === 0) { this.primaryHeld = true; this.callbacks.onPrimaryAction?.(true); }
      if (e.button === 2) { this.secondaryHeld = true; this.callbacks.onSecondaryAction?.(true); }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) { this.primaryHeld = false; this.callbacks.onPrimaryAction?.(false); }
      if (e.button === 2) { this.secondaryHeld = false; this.callbacks.onSecondaryAction?.(false); }
    });
    this.dom.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => {
      this.callbacks.onScroll?.(Math.sign(e.deltaY));
    }, { passive: true });
  }

  _bindMobileUI() {
    const container = document.getElementById('mobile-controls');
    if (container) container.classList.remove('hidden');

    this._setupJoystick(document.getElementById('joystick-move'), (x, y) => { this.moveVec.x = x; this.moveVec.y = y; });
    this._setupLookPad(document.getElementById('look-pad'));

    const jumpBtn = document.getElementById('btn-jump');
    jumpBtn?.addEventListener('touchstart', (e) => { e.preventDefault(); this.jumpHeld = true; this.callbacks.onJumpTap?.(); }, { passive: false });
    jumpBtn?.addEventListener('touchend', (e) => { e.preventDefault(); this.jumpHeld = false; }, { passive: false });

    const sprintBtn = document.getElementById('btn-sprint');
    sprintBtn?.addEventListener('touchstart', (e) => { e.preventDefault(); this.sprintHeld = !this.sprintHeld; sprintBtn.classList.toggle('active', this.sprintHeld); }, { passive: false });

    const crouchBtn = document.getElementById('btn-crouch');
    crouchBtn?.addEventListener('touchstart', (e) => { e.preventDefault(); this.crouchHeld = !this.crouchHeld; crouchBtn.classList.toggle('active', this.crouchHeld); }, { passive: false });

    const attackBtn = document.getElementById('btn-attack');
    attackBtn?.addEventListener('touchstart', (e) => { e.preventDefault(); this.callbacks.onPrimaryAction?.(true); setTimeout(() => this.callbacks.onPrimaryAction?.(false), 120); }, { passive: false });

    const useBtn = document.getElementById('btn-use');
    useBtn?.addEventListener('touchstart', (e) => { e.preventDefault(); this.callbacks.onSecondaryAction?.(true); setTimeout(() => this.callbacks.onSecondaryAction?.(false), 120); }, { passive: false });

    const interactBtn = document.getElementById('btn-interact');
    interactBtn?.addEventListener('touchstart', (e) => { e.preventDefault(); this.callbacks.onInteract?.(); }, { passive: false });
  }

  _setupJoystick(el, onMove) {
    if (!el) return;
    const knob = el.querySelector('.joystick-knob');
    let active = false, touchId = null, cx = 0, cy = 0;
    const maxR = 38;

    const start = (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      touchId = t.identifier;
      const rect = el.getBoundingClientRect();
      cx = rect.left + rect.width / 2; cy = rect.top + rect.height / 2;
      active = true;
    };
    const move = (e) => {
      if (!active) return;
      const t = [...e.changedTouches].find(t => t.identifier === touchId);
      if (!t) return;
      e.preventDefault();
      let dx = t.clientX - cx, dy = t.clientY - cy;
      const dist = Math.min(maxR, Math.hypot(dx, dy));
      const ang = Math.atan2(dy, dx);
      dx = Math.cos(ang) * dist; dy = Math.sin(ang) * dist;
      if (knob) knob.style.transform = `translate(${dx}px, ${dy}px)`;
      onMove(dx / maxR, dy / maxR);
    };
    const end = (e) => {
      const t = [...e.changedTouches].find(t => t.identifier === touchId);
      if (touchId !== null && !t) return;
      active = false; touchId = null;
      if (knob) knob.style.transform = `translate(0px, 0px)`;
      onMove(0, 0);
    };
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', end, { passive: false });
  }

  _setupLookPad(el) {
    if (!el) return;
    let touchId = null, lastX = 0, lastY = 0;
    const start = (e) => {
      const t = e.changedTouches[0];
      touchId = t.identifier; lastX = t.clientX; lastY = t.clientY;
    };
    const move = (e) => {
      const t = [...e.changedTouches].find(t => t.identifier === touchId);
      if (!t) return;
      e.preventDefault();
      const dx = t.clientX - lastX, dy = t.clientY - lastY;
      lastX = t.clientX; lastY = t.clientY;
      this.yawDelta -= dx * 0.0032;
      this.pitchDelta -= dy * 0.0032;
    };
    const end = (e) => {
      const t = [...e.changedTouches].find(t => t.identifier === touchId);
      if (touchId !== null && !t) return;
      touchId = null;
    };
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', end, { passive: false });
  }

  consumeLookDelta() {
    const d = { yaw: this.yawDelta, pitch: this.pitchDelta };
    this.yawDelta = 0; this.pitchDelta = 0;
    return d;
  }

  getMovementIntent() {
    if (this.mobile) {
      return {
        forward: -this.moveVec.y,
        right: this.moveVec.x,
        jump: this.jumpHeld,
        sprint: this.sprintHeld,
        crouch: this.crouchHeld,
        descend: false,
        fly: false,
      };
    }
    const k = this.keys;
    const forward = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const right = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    return {
      forward, right,
      jump: k.has('Space'),
      sprint: k.has('ShiftLeft') || k.has('ShiftRight'),
      crouch: k.has('ControlLeft') || k.has('KeyC'),
      descend: k.has('ControlLeft'),
      fly: false,
    };
  }
}
