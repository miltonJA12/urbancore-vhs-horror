import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { Octree } from 'three/addons/math/Octree.js';
import { Capsule } from 'three/addons/math/Capsule.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import RAPIER from 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.20.0/+esm';

await RAPIER.init();

const MODEL_PATH = './assets/models/environment/model.glb';
const CHARACTER_PATH = './assets/models/character/character.fbx';
const ENEMY_PATH = './assets/models/enemy/enemy.fbx';
const IDLE_PATH = './assets/models/props/Idle.fbx';
const WALK_PATH = './assets/models/props/Walking.fbx';
const RUN_PATH = './assets/models/props/Fast Run.fbx';
const THROW_PATH = './assets/models/props/Throw.fbx';

const THIRD_PERSON_DISTANCE = 4.15;
const THIRD_PERSON_FOCUS_HEIGHT = 1.28;
const THIRD_PERSON_SHOULDER = 0.58;
const THIRD_PERSON_HEIGHT = 0.48;
const THIRD_PERSON_MIN_DISTANCE = 0.72;
const THIRD_PERSON_SMOOTHNESS = 12;
const CAMERA_MOUSE_SENSITIVITY = 0.0022;
const CAMERA_MIN_PITCH = -0.55;
const CAMERA_MAX_PITCH = 0.75;
const CHARACTER_HEIGHT = 1.72;
const CHARACTER_ROTATION_OFFSET = Math.PI;

let cameraYaw = 0;
let cameraPitch = 0.10;

const MAX_LIVES = 3;

const PLAYER_RADIUS = 0.32;
const PLAYER_HEIGHT = 1.72;

const WALK_SPEED = 3.1;
const RUN_SPEED = 5.6;

const GROUND_ACCELERATION = 10.5;
const AIR_ACCELERATION = 2.5;

const GRAVITY = 9.81;
const TERMINAL_VELOCITY = 32;

const JUMP_VELOCITY = 4.35;

const COYOTE_TIME = 0.12;
const JUMP_BUFFER_TIME = 0.15;

const MAX_DYNAMIC_MAP_LIGHTS = 24;
const COLLIDER_MIN_SIZE = 0.75;

const LIGHT_ACTIVE_DISTANCE = 32;
const LIGHT_UPDATE_INTERVAL = 0.18;

const INTERACTION_INTERVAL = 0.06;

const LOW_FPS_THRESHOLD = 38;
const HIGH_FPS_THRESHOLD = 54;

const MIN_PIXEL_RATIO = 0.72;
const MAX_PIXEL_RATIO = 1.0;

const SHOT_POWER_MIN = 8;
const SHOT_POWER_MAX = 55;
const SHOT_POWER_DEFAULT = 26;
const PROJECTILE_SPEED_FACTOR = 0.72;
const PROJECTILE_RADIUS = 0.12;
const PROJECTILE_LIFETIME = 5;
const MAX_PROJECTILES = 12;
const PHYSICAL_PROP_COUNT = 16;
const KNOCKDOWN_ROWS = 4;
const KNOCKDOWN_COLUMNS = 5;

const ENTITY_CATCH_DISTANCE = 1.65;
const ENTITY_STALK_MIN_DISTANCE = 14;
const ENTITY_STALK_MAX_DISTANCE = 28;

let entity = null;

let entityVisible = false;
let entityChasing = false;
let entityCatchActive = false;

let entitySightTimer = 10;
let entityVisibleTimer = 0;

let entityGlitchAmount = 0;
let entitySpeed = 0;

const entityDirection = new THREE.Vector3();
const entityTarget = new THREE.Vector3();
const entityLookTarget = new THREE.Vector3();

const GAMEPAD_DEADZONE = 0.16;
const GAMEPAD_LOOK_SPEED = 2.15;

let activeGamepadIndex = null;

let gamepadMoveX = 0;
let gamepadMoveY = 0;

let gamepadLookX = 0;
let gamepadLookY = 0;

let gamepadRunning = false;

const previousGamepadButtons = [];

let gameStarted = false;
let gamePaused = false;
let gameOver = false;
let gameWon = false;
let mapReady = false;

let lives = MAX_LIVES;

let lastFallDamageTime = 0;

let characterRoot = null;
let characterAnimationRoot = null;
let characterModel = null;
let characterReady = false;

const characterLoader = new FBXLoader();
const animationLoader = new FBXLoader();
const enemyLoader = new FBXLoader();

const characterMoveDirection = new THREE.Vector3();
const thirdPersonForward = new THREE.Vector3();
const thirdPersonRight = new THREE.Vector3();
const thirdPersonFocus = new THREE.Vector3();
const desiredThirdPersonCamera = new THREE.Vector3();
const smoothedThirdPersonCamera = new THREE.Vector3();
const cameraCollisionDirection = new THREE.Vector3();
const playerWorldPosition = new THREE.Vector3();
const cameraCollisionRaycaster = new THREE.Raycaster();

const cameraCollisionMeshes = [];

let characterMixer = null;

const characterActions = {};

let currentCharacterAction = '';
let characterActionLockedUntil = 0;
let lastLocomotionState = 'idle';

function getPlayerWorldPosition(target = playerWorldPosition) {
  target.copy(playerCollider.start);
  target.y -= PLAYER_RADIUS;

  return target;
}

function loadFBXPromise(path, loader = animationLoader) {
  return new Promise((resolve, reject) => {
    loader.load(path, resolve, undefined, reject);
  });
}

// ============================================================
// NORMALIZAR NOMBRES DE HUESOS
// ============================================================

function normalizeRigName(name = '') {
  let clean = String(name)
    .split('|')
    .pop()
    .split(':')
    .pop()
    .toLowerCase();

  clean = clean
    .replace(/mixamorig\d*/g, '')
    .replace(/armature\d*/g, '')
    .replace(/cc[\s_-]*base[\s_-]*/g, '')
    .replace(/bip0*1/g, '')
    .replace(/^def[\s_-]*/g, '')
    .replace(/^org[\s_-]*/g, '')
    .replace(/[^a-z0-9]/g, '');

  return clean;
}

// ============================================================
// IDENTIFICAR SEMÁNTICAMENTE LOS HUESOS
// ============================================================

function semanticRigName(name = '') {
  const n = normalizeRigName(name);

  const aliases = {
    hips: [
      'hips',
      'hip',
      'pelvis',
      'pelvisbone'
    ],

    spine: [
      'spine',
      'spine0',
      'spine00',
      'spine01',
      'spinea'
    ],

    spine1: [
      'spine1',
      'spine02',
      'chest',
      'spineb'
    ],

    spine2: [
      'spine2',
      'spine03',
      'upperchest',
      'spinec'
    ],

    neck: [
      'neck',
      'neck01',
      'neck1'
    ],

    head: [
      'head',
      'head01'
    ],

    leftshoulder: [
      'leftshoulder',
      'lshoulder',
      'shoulderl',
      'claviclel',
      'leftclavicle',
      'clavicleleft'
    ],

    rightshoulder: [
      'rightshoulder',
      'rshoulder',
      'shoulderr',
      'clavicler',
      'rightclavicle',
      'clavicleright'
    ],

    leftarm: [
      'leftarm',
      'leftupperarm',
      'upperarml',
      'lupperarm',
      'arml',
      'larm'
    ],

    rightarm: [
      'rightarm',
      'rightupperarm',
      'upperarmr',
      'rupperarm',
      'armr',
      'rarm'
    ],

    leftforearm: [
      'leftforearm',
      'leftlowerarm',
      'lowerarml',
      'forearml',
      'lforearm',
      'llowerarm'
    ],

    rightforearm: [
      'rightforearm',
      'rightlowerarm',
      'lowerarmr',
      'forearmr',
      'rforearm',
      'rlowerarm'
    ],

    lefthand: [
      'lefthand',
      'handl',
      'lhand'
    ],

    righthand: [
      'righthand',
      'handr',
      'rhand'
    ],

    leftupleg: [
      'leftupleg',
      'leftupperleg',
      'leftthigh',
      'thighl',
      'upperlegl',
      'lupleg',
      'lthigh'
    ],

    rightupleg: [
      'rightupleg',
      'rightupperleg',
      'rightthigh',
      'thighr',
      'upperlegr',
      'rupleg',
      'rthigh'
    ],

    leftleg: [
      'leftleg',
      'leftlowerleg',
      'leftcalf',
      'calfl',
      'shinl',
      'lowerlegl',
      'lleg',
      'lcalf'
    ],

    rightleg: [
      'rightleg',
      'rightlowerleg',
      'rightcalf',
      'calfr',
      'shinr',
      'lowerlegr',
      'rleg',
      'rcalf'
    ],

    leftfoot: [
      'leftfoot',
      'footl',
      'lfoot',
      'anklel'
    ],

    rightfoot: [
      'rightfoot',
      'footr',
      'rfoot',
      'ankler'
    ],

    lefttoebase: [
      'lefttoebase',
      'lefttoe',
      'toel',
      'ltoe',
      'balll'
    ],

    righttoebase: [
      'righttoebase',
      'righttoe',
      'toer',
      'rtoe',
      'ballr'
    ]
  };

  for (const [semantic, list] of Object.entries(aliases)) {
    if (list.includes(n)) {
      return semantic;
    }
  }

  for (const [semantic, list] of Object.entries(aliases)) {
    const ordered = [...list].sort(
      (a, b) => b.length - a.length
    );

    if (
      ordered.some(alias =>
        alias.length >= 4 &&
        n.endsWith(alias)
      )
    ) {
      return semantic;
    }
  }

  const finger = n.match(
    /(left|right|l|r)(?:hand)?(thumb|index|middle|ring|pinky|little)([0-4])/
  );

  if (finger) {
    const side =
      finger[1] === 'l'
        ? 'left'
        : finger[1] === 'r'
          ? 'right'
          : finger[1];

    const fingerName =
      finger[2] === 'little'
        ? 'pinky'
        : finger[2];

    return `${side}${fingerName}${finger[3]}`;
  }

  return n;
}

function stripTrackNodeName(name = '') {
  return String(name)
    .split('|')
    .pop()
    .split(':')
    .pop();
}

// ============================================================
// CONSTRUIR MAPA DE HUESOS
// ============================================================

function buildRigMaps(root) {
  const exact = new Map();
  const semantic = new Map();

  const bones = [];
  const namedObjects = [];

  root.traverse(object => {
    if (!object.name) {
      return;
    }

    namedObjects.push(object);

    if (object.isBone) {
      bones.push(object);
    }
  });

  const candidates =
    bones.length > 0
      ? bones
      : namedObjects;

  for (const object of candidates) {
    const exactKey =
      normalizeRigName(object.name);

    if (
      exactKey &&
      !exact.has(exactKey)
    ) {
      exact.set(
        exactKey,
        object
      );
    }

    const semanticKey =
      semanticRigName(object.name);

    if (
      semanticKey &&
      !semantic.has(semanticKey)
    ) {
      semantic.set(
        semanticKey,
        object
      );
    }
  }

  return {
    exact,
    semantic,
    bones
  };
}

function getModelHeight(root) {
  root.updateMatrixWorld(true);

  const box =
    new THREE.Box3()
      .setFromObject(root);

  return Math.max(
    0.001,
    box.max.y - box.min.y
  );
}

// ============================================================
// RETARGET DE ANIMACIONES
// ============================================================

function createRetargetedClip(
  sourceFBX,
  targetRoot,
  clipName
) {
  const sourceClip =
    sourceFBX.animations?.[0];

  if (!sourceClip) {
    console.warn(
      `⚠️ ${clipName}: el FBX no contiene animación.`
    );

    return null;
  }

  sourceFBX.updateMatrixWorld(true);
  targetRoot.updateMatrixWorld(true);

  const sourceMaps =
    buildRigMaps(sourceFBX);

  const targetMaps =
    buildRigMaps(targetRoot);

  if (!targetMaps.bones.length) {
    console.error(
      `❌ ${clipName}: character.fbx no tiene huesos detectables.`
    );

    return null;
  }

  const tracks = [];

  let linkedQuaternionTracks = 0;
  let linkedPositionTracks = 0;
  let skippedTracks = 0;

  const sourceHeight =
    getModelHeight(sourceFBX);

  const targetHeight =
    getModelHeight(targetRoot);

  const translationScale =
    sourceHeight > 0.05
      ? targetHeight / sourceHeight
      : 1;

  for (const sourceTrack of sourceClip.tracks) {
    const dot =
      sourceTrack.name.lastIndexOf('.');

    if (dot < 0) {
      skippedTracks++;
      continue;
    }

    const rawNodeName =
      sourceTrack.name.slice(
        0,
        dot
      );

    const property =
      sourceTrack.name.slice(
        dot + 1
      );

    const rawNode =
      stripTrackNodeName(
        rawNodeName
      );

    const exactKey =
      normalizeRigName(
        rawNode
      );

    const semanticKey =
      semanticRigName(
        rawNode
      );

    const sourceBone =
      sourceMaps.exact.get(
        exactKey
      ) ||
      sourceMaps.semantic.get(
        semanticKey
      );

    const targetBone =
      targetMaps.exact.get(
        exactKey
      ) ||
      targetMaps.semantic.get(
        semanticKey
      );

    if (!targetBone) {
      skippedTracks++;
      continue;
    }

    // ========================================================
    // ROTACIONES DE LOS HUESOS
    // ========================================================

    if (
      property === 'quaternion' &&
      sourceTrack.values.length >= 4
    ) {
      const values =
        new Float32Array(
          sourceTrack.values.length
        );

      const qAnim =
        new THREE.Quaternion();

      const qDelta =
        new THREE.Quaternion();

      const qTarget =
        new THREE.Quaternion();

      const srcRest =
        sourceBone
          ? sourceBone.quaternion.clone()
          : new THREE.Quaternion();

      const srcRestInv =
        srcRest
          .clone()
          .invert();

      const tgtRest =
        targetBone
          .quaternion
          .clone();

      for (
        let i = 0;
        i < sourceTrack.values.length;
        i += 4
      ) {
        qAnim
          .fromArray(
            sourceTrack.values,
            i
          )
          .normalize();

        if (sourceBone) {
          qDelta
            .copy(srcRestInv)
            .multiply(qAnim)
            .normalize();

          qTarget
            .copy(tgtRest)
            .multiply(qDelta)
            .normalize();

        } else {
          qTarget
            .copy(qAnim)
            .normalize();
        }

        qTarget.toArray(
          values,
          i
        );
      }

      tracks.push(
        new THREE.QuaternionKeyframeTrack(
          `${targetBone.uuid}.quaternion`,
          Array.from(
            sourceTrack.times
          ),
          Array.from(
            values
          )
        )
      );

      linkedQuaternionTracks++;

      continue;
    }

    // ========================================================
    // POSICIÓN DE HIPS
    // ========================================================

    if (
      property === 'position' &&
      semanticKey === 'hips' &&
      clipName !== 'Walk' &&
      clipName !== 'Run' &&
      sourceTrack.values.length >= 3
    ) {
      const values =
        new Float32Array(
          sourceTrack.values.length
        );

      const firstX =
        sourceTrack.values[0];

      const firstY =
        sourceTrack.values[1];

      const firstZ =
        sourceTrack.values[2];

      const targetRest =
        targetBone
          .position
          .clone();

      for (
        let i = 0;
        i < sourceTrack.values.length;
        i += 3
      ) {
        values[i] =
          targetRest.x;

        values[i + 1] =
          targetRest.y +
          (
            sourceTrack.values[i + 1] -
            firstY
          ) *
          translationScale;

        values[i + 2] =
          targetRest.z;

        void firstX;
        void firstZ;
      }

      tracks.push(
        new THREE.VectorKeyframeTrack(
          `${targetBone.uuid}.position`,
          Array.from(
            sourceTrack.times
          ),
          Array.from(
            values
          )
        )
      );

      linkedPositionTracks++;

      continue;
    }

    skippedTracks++;
  }

  console.log(
    `🎯 ${clipName}: ${linkedQuaternionTracks} rotaciones + ${linkedPositionTracks} posiciones enlazadas. ${skippedTracks} tracks ignorados.`
  );

  if (linkedQuaternionTracks === 0) {
    console.error(
      `❌ ${clipName}: no se enlazó ninguna rotación con character.fbx.`
    );

    console.group(
      `🔎 ${clipName} - diagnóstico de huesos`
    );

    console.log(
      'Huesos fuente:',
      sourceMaps.bones.map(
        bone => bone.name
      )
    );

    console.log(
      'Huesos destino:',
      targetMaps.bones.map(
        bone => bone.name
      )
    );

    console.groupEnd();

    return null;
  }

  const clip =
    new THREE.AnimationClip(
      clipName,
      sourceClip.duration,
      tracks
    );

  clip.resetDuration();
  clip.optimize();

  return clip;
}

// ============================================================
// FALLBACK
// ============================================================

function createFallbackCharacterClips() {
  const idle =
    new THREE.AnimationClip(
      'IdleFallback',
      1.4,
      [
        new THREE.NumberKeyframeTrack(
          '.position[y]',
          [
            0,
            0.7,
            1.4
          ],
          [
            0,
            0.025,
            0
          ]
        )
      ]
    );

  const walk =
    new THREE.AnimationClip(
      'WalkFallback',
      0.55,
      [
        new THREE.NumberKeyframeTrack(
          '.rotation[z]',
          [
            0,
            0.1375,
            0.275,
            0.4125,
            0.55
          ],
          [
            0,
            0.025,
            0,
            -0.025,
            0
          ]
        )
      ]
    );

  const run =
    new THREE.AnimationClip(
      'RunFallback',
      0.34,
      [
        new THREE.NumberKeyframeTrack(
          '.rotation[z]',
          [
            0,
            0.085,
            0.17,
            0.255,
            0.34
          ],
          [
            0,
            0.045,
            0,
            -0.045,
            0
          ]
        )
      ]
    );

  const throwClip =
    new THREE.AnimationClip(
      'ThrowFallback',
      0.42,
      [
        new THREE.NumberKeyframeTrack(
          '.rotation[x]',
          [
            0,
            0.12,
            0.24,
            0.42
          ],
          [
            0,
            -0.16,
            0.1,
            0
          ]
        )
      ]
    );

  return {
    idle,
    walk,
    run,
    throw: throwClip
  };
}

// ============================================================
// CONFIGURAR ANIMACIONES
// ============================================================

async function setupCharacterAnimations() {
  const [
    idleFBX,
    walkFBX,
    runFBX,
    throwFBX
  ] =
    await Promise.all([
      loadFBXPromise(
        IDLE_PATH
      ),

      loadFBXPromise(
        WALK_PATH
      ),

      loadFBXPromise(
        RUN_PATH
      ),

      loadFBXPromise(
        THROW_PATH
      )
    ]);

  const fallback =
    createFallbackCharacterClips();

  const selected = {
    idle:
      createRetargetedClip(
        idleFBX,
        characterModel,
        'Idle'
      ) ||
      fallback.idle,

    walk:
      createRetargetedClip(
        walkFBX,
        characterModel,
        'Walk'
      ) ||
      fallback.walk,

    run:
      createRetargetedClip(
        runFBX,
        characterModel,
        'Run'
      ) ||
      fallback.run,

    throw:
      createRetargetedClip(
        throwFBX,
        characterModel,
        'Throw'
      ) ||
      fallback.throw
  };

  characterMixer =
    new THREE.AnimationMixer(
      characterModel
    );

  for (
    const [
      name,
      clip
    ]
    of Object.entries(
      selected
    )
  ) {
    const action =
      characterMixer.clipAction(
        clip
      );

    action.enabled = true;

    action.setEffectiveWeight(
      1
    );

    action.setEffectiveTimeScale(
      1
    );

    if (
      name === 'throw'
    ) {
      action.setLoop(
        THREE.LoopOnce,
        1
      );

      action.clampWhenFinished =
        true;

    } else {
      action.setLoop(
        THREE.LoopRepeat,
        Infinity
      );
    }

    characterActions[name] =
      action;
  }

  playCharacterAction(
    'idle',
    0,
    true
  );

  console.log(
    '🎬 AnimationMixer listo: Idle / Walk / Run / Throw'
  );
}

// ============================================================
// CAMBIAR ANIMACIÓN
// ============================================================

function playCharacterAction(
  name,
  fade = 0.16,
  force = false
) {
  if (
    !characterMixer ||
    !characterActions[name]
  ) {
    return;
  }

  if (
    !force &&
    currentCharacterAction === name
  ) {
    return;
  }

  const previous =
    characterActions[
      currentCharacterAction
    ];

  const next =
    characterActions[name];

  if (
    previous &&
    previous !== next
  ) {
    previous.fadeOut(
      fade
    );
  }

  next.enabled = true;

  next.setEffectiveWeight(
    1
  );

  next.setEffectiveTimeScale(
    1
  );

  next
    .reset()
    .fadeIn(
      fade
    )
    .play();

  currentCharacterAction =
    name;
}

// ============================================================
// LOCOMOCIÓN
// ============================================================

function updateCharacterLocomotion(
  moving,
  running
) {
  const state =
    !moving
      ? 'idle'
      : (
          running
            ? 'run'
            : 'walk'
        );

  lastLocomotionState =
    state;

  if (
    performance.now() >=
    characterActionLockedUntil
  ) {
    playCharacterAction(
      state
    );
  }
}

// ============================================================
// THROW
// ============================================================

function playThrowAnimation() {
  characterActionLockedUntil =
    performance.now() +
    520;

  playCharacterAction(
    'throw',
    0.08,
    true
  );

  setTimeout(
    () => {
      playCharacterAction(
        lastLocomotionState,
        0.1,
        true
      );
    },
    500
  );
}

// ============================================================
// MISIÓN
// ============================================================

const TOTAL_TAPES = 5;

let tapesCollected = 0;

let hasMaintenanceKey = false;
let hasFuse = false;
let powerRestored = false;

let questStage = 0;

const questObjects = [];
const tapeObjects = [];

let maintenanceKeyObject = null;
let fuseObject = null;
let powerBoxObject = null;
let transmitterObject = null;

let safeFloorPoints = [];

let vhsEventTimer = 0;

let groundedGraceTimer = 0;
let jumpBufferTimer = 0;

// ============================================================
// ELEMENTOS HTML
// ============================================================

const startScreen =
  document.getElementById(
    'start-screen'
  );

const pauseScreen =
  document.getElementById(
    'pause-screen'
  );

const optionsScreen =
  document.getElementById(
    'options-screen'
  );

const gameOverScreen =
  document.getElementById(
    'game-over-screen'
  );

const startButton =
  document.getElementById(
    'start-button'
  );

const resumeButton =
  document.getElementById(
    'resume-button'
  );

const optionsButton =
  document.getElementById(
    'options-button'
  );

const optionsBackButton =
  document.getElementById(
    'options-back-button'
  );

const restartButton =
  document.getElementById(
    'restart-button'
  );

const mainMenuButton =
  document.getElementById(
    'main-menu-button'
  );

const gameOverRestart =
  document.getElementById(
    'game-over-restart'
  );

const gameOverMenu =
  document.getElementById(
    'game-over-menu'
  );

const loadingStatus =
  document.getElementById(
    'loading-status'
  );

const sensitivitySlider =
  document.getElementById(
    'sensitivity-slider'
  );

const sensitivityValue =
  document.getElementById(
    'sensitivity-value'
  );

const brightnessSlider =
  document.getElementById(
    'brightness-slider'
  );

const brightnessValue =
  document.getElementById(
    'brightness-value'
  );

const vhsToggle =
  document.getElementById(
    'vhs-toggle'
  );

const livesContainer =
  document.getElementById(
    'lives-container'
  );

const damageFlash =
  document.getElementById(
    'damage-flash'
  );

const gameHUD =
  document.querySelectorAll(
    '.game-hud'
  );

const promptElem =
  document.getElementById(
    'interaction-prompt'
  );

const flashlightStatus =
  document.getElementById(
    'flashlight-status'
  );

const vhsOverlay =
  document.querySelector(
    '.vhs-overlay'
  );

const vhsScanlines =
  document.querySelector(
    '.vhs-scanlines'
  );

const vhsNoise =
  document.querySelector(
    '.vhs-noise'
  );

const staminaSegments =
  document.getElementById(
    'stamina-segments'
  );

const staminaPercent =
  document.getElementById(
    'stamina-percent'
  );

const batteryLevel =
  document.getElementById(
    'battery-level'
  );

const objectiveText =
  document.querySelector(
    '.objective-text'
  );

// ============================================================
// NOTIFICACIÓN DE OBJETIVOS
// ============================================================

const questNotification =
  document.createElement(
    'div'
  );

questNotification.style.position =
  'fixed';

questNotification.style.left =
  '50%';

questNotification.style.top =
  '18%';

questNotification.style.transform =
  'translateX(-50%)';

questNotification.style.zIndex =
  '70';

questNotification.style.padding =
  '10px 18px';

questNotification.style.background =
  'rgba(0,0,0,.78)';

questNotification.style.border =
  '1px solid rgba(255,255,255,.25)';

questNotification.style.color =
  '#eee';

questNotification.style.fontFamily =
  '"Courier New", monospace';

questNotification.style.fontSize =
  '11px';

questNotification.style.letterSpacing =
  '2px';

questNotification.style.pointerEvents =
  'none';

questNotification.style.opacity =
  '0';

questNotification.style.transition =
  'opacity .25s';

document.body.appendChild(
  questNotification
);

let notificationTimer = null;

function showQuestNotification(
  message,
  duration = 2800
) {
  questNotification.textContent =
    message;

  questNotification.style.opacity =
    '1';

  clearTimeout(
    notificationTimer
  );

  notificationTimer =
    setTimeout(
      () => {
        questNotification.style.opacity =
          '0';
      },
      duration
    );
}

// ============================================================
// SCREAMER
// ============================================================

const screamerOverlay =
  document.createElement(
    'div'
  );

Object.assign(
  screamerOverlay.style,
  {
    position: 'fixed',
    inset: '0',
    zIndex: '500',
    background: '#000',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    overflow: 'hidden'
  }
);

screamerOverlay.innerHTML = `

  <div
    id="entity-screamer-flash"
    style="
      position:absolute;
      inset:0;
      background:white;
      opacity:0;
    "
  ></div>

  <div
    id="entity-screamer-red"
    style="
      position:absolute;
      inset:0;
      background:#8f0000;
      opacity:0;
    "
  ></div>

  <div
    id="entity-screamer-static"
    style="
      position:absolute;
      inset:-20%;
      opacity:0;
      background:
        repeating-radial-gradient(
          circle,
          rgba(255,255,255,.95) 0px,
          rgba(255,255,255,.25) 1px,
          transparent 2px,
          transparent 5px
        );
      background-size:7px 7px;
    "
  ></div>

  <div
    id="entity-screamer-face"
    style="
      position:relative;
      width:min(92vw,780px);
      height:min(92vh,780px);
      transform:scale(.05) rotate(-8deg);
      opacity:0;
      filter:contrast(180%) brightness(75%);
      will-change:transform,opacity,filter;
    "
  >

    <div
      style="
        position:absolute;
        left:50%;
        top:50%;
        width:48%;
        height:78%;
        transform:translate(-50%,-50%);
        border-radius:46% 46% 37% 37%;
        background:
          radial-gradient(
            ellipse at 50% 38%,
            #343434 0%,
            #111 35%,
            #020202 68%,
            #000 100%
          );
        box-shadow:
          0 0 100px black,
          inset 0 0 90px black;
      "
    ></div>

    <div
      style="
        position:absolute;
        left:27%;
        top:31%;
        width:18%;
        height:13%;
        border-radius:50%;
        background:#000;
        transform:rotate(7deg);
      "
    ></div>

    <div
      style="
        position:absolute;
        right:27%;
        top:31%;
        width:18%;
        height:13%;
        border-radius:50%;
        background:#000;
        transform:rotate(-7deg);
      "
    ></div>

    <div
      id="screamer-eye-left"
      style="
        position:absolute;
        left:32%;
        top:34%;
        width:8%;
        height:5%;
        border-radius:50%;
        background:#f4f4f4;
        box-shadow:
          0 0 18px white,
          0 0 45px rgba(255,0,0,.85);
      "
    ></div>

    <div
      id="screamer-eye-right"
      style="
        position:absolute;
        right:32%;
        top:34%;
        width:8%;
        height:5%;
        border-radius:50%;
        background:#f4f4f4;
        box-shadow:
          0 0 18px white,
          0 0 45px rgba(255,0,0,.85);
      "
    ></div>

    <div
      style="
        position:absolute;
        left:50%;
        top:48%;
        width:7%;
        height:13%;
        transform:translateX(-50%);
        background:#000;
        clip-path:polygon(
          50% 0,
          100% 100%,
          0 100%
        );
      "
    ></div>

    <div
      id="screamer-mouth"
      style="
        position:absolute;
        left:50%;
        bottom:17%;
        width:17%;
        height:24%;
        transform:
          translateX(-50%)
          scaleY(.25);
        transform-origin:center top;
        border-radius:40% 40% 48% 48%;
        background:
          radial-gradient(
            ellipse at center,
            #3d0000 0%,
            #090000 45%,
            #000 100%
          );
        box-shadow:
          inset 0 0 35px rgba(180,0,0,.85),
          0 0 24px rgba(255,0,0,.3);
      "
    ></div>

  </div>
`;

document.body.appendChild(
  screamerOverlay
);

const screamerFace =
  screamerOverlay.querySelector(
    '#entity-screamer-face'
  );

const screamerFlash =
  screamerOverlay.querySelector(
    '#entity-screamer-flash'
  );

const screamerRed =
  screamerOverlay.querySelector(
    '#entity-screamer-red'
  );

const screamerStatic =
  screamerOverlay.querySelector(
    '#entity-screamer-static'
  );

const screamerMouth =
  screamerOverlay.querySelector(
    '#screamer-mouth'
  );

const screamerEyeLeft =
  screamerOverlay.querySelector(
    '#screamer-eye-left'
  );

const screamerEyeRight =
  screamerOverlay.querySelector(
    '#screamer-eye-right'
  );

// ============================================================
// VICTORIA
// ============================================================

const victoryScreen =
  document.createElement(
    'section'
  );

victoryScreen.className =
  'menu-screen hidden';

victoryScreen.style.zIndex =
  '120';

victoryScreen.innerHTML = `

  <div class="menu-box">

    <div class="menu-small-label">
      SIGNAL TRANSMITTED
    </div>

    <h2 class="pause-title">
      TRANSMISSION COMPLETE
    </h2>

    <div class="menu-divider"></div>

    <p class="menu-description">
      Las cinco grabaciones fueron transmitidas.
      <br><br>
      Pero alguien respondió a la señal.
    </p>

    <button
      id="victory-restart"
      class="menu-button primary"
    >
      REINICIAR CINTA
    </button>

    <button
      id="victory-menu"
      class="menu-button"
    >
      MENÚ PRINCIPAL
    </button>

  </div>
`;

document.body.appendChild(
  victoryScreen
);

// ============================================================
// DEBUG
// ============================================================

const debugPanel =
  document.createElement(
    'div'
  );

debugPanel.style.position =
  'fixed';

debugPanel.style.top =
  '15px';

debugPanel.style.left =
  '50%';

debugPanel.style.transform =
  'translateX(-50%)';

debugPanel.style.zIndex =
  '200';

debugPanel.style.padding =
  '8px 12px';

debugPanel.style.background =
  'rgba(0,0,0,.72)';

debugPanel.style.border =
  '1px solid rgba(255,255,255,.2)';

debugPanel.style.color =
  '#ddd';

debugPanel.style.font =
  '11px monospace';

debugPanel.style.pointerEvents =
  'none';

debugPanel.style.display =
  'none';

debugPanel.style.whiteSpace =
  'pre';

document.body.appendChild(
  debugPanel
);

let debugVisible = false;

// ============================================================
// ESCENA
// ============================================================

const scene =
  new THREE.Scene();

scene.background =
  new THREE.Color(
    0x030509
  );

scene.fog =
  new THREE.FogExp2(
    0x030509,
    0.0105
  );

// ============================================================
// CÁMARA
// ============================================================

const camera =
  new THREE.PerspectiveCamera(
    72,
    window.innerWidth /
      window.innerHeight,
    0.1,
    1200
  );

const gamepadCameraEuler =
  new THREE.Euler(
    0,
    0,
    0,
    'YXZ'
  );

// ============================================================
// RENDERER
// ============================================================

const renderer =
  new THREE.WebGLRenderer({
    antialias: false,
    powerPreference:
      'high-performance'
  });

let currentPixelRatio =
  Math.min(
    window.devicePixelRatio,
    MAX_PIXEL_RATIO
  );

renderer.setSize(
  window.innerWidth,
  window.innerHeight
);

renderer.setPixelRatio(
  currentPixelRatio
);

renderer.shadowMap.enabled =
  true;

renderer.shadowMap.type =
  THREE.PCFSoftShadowMap;

renderer.toneMapping =
  THREE.ACESFilmicToneMapping;

renderer.toneMappingExposure =
  1;

renderer.outputColorSpace =
  THREE.SRGBColorSpace;

document
  .getElementById(
    'scene-container'
  )
  .appendChild(
    renderer.domElement
  );

// ============================================================
// CONTROLES
// ============================================================

const controls =
  new PointerLockControls(
    camera,
    document.body
  );

controls.pointerSpeed = 0;

// ============================================================
// VHS
// ============================================================

const composer =
  new EffectComposer(
    renderer
  );

composer.addPass(
  new RenderPass(
    scene,
    camera
  )
);

const RetroShader = {
  uniforms: {
    tDiffuse: {
      value: null
    },

    pixelSize: {
      value: 3
    },

    resolution: {
      value:
        new THREE.Vector2(
          window.innerWidth,
          window.innerHeight
        )
    },

    time: {
      value: 0
    },

    glitchBoost: {
      value: 0
    }
  },

  vertexShader: `
    varying vec2 vUv;

    void main() {

      vUv = uv;

      gl_Position =
        projectionMatrix *
        modelViewMatrix *
        vec4(
          position,
          1.0
        );

    }
  `,

  fragmentShader: `
    uniform sampler2D tDiffuse;

    uniform float pixelSize;
    uniform vec2 resolution;
    uniform float time;
    uniform float glitchBoost;

    varying vec2 vUv;

    float random(vec2 st) {

      return fract(
        sin(
          dot(
            st.xy,
            vec2(
              12.9898,
              78.233
            )
          )
        ) *
        43758.5453123
      );

    }

    void main() {

      vec2 uv = vUv;

      float lineJitter =
        step(
          0.985 -
          glitchBoost *
          0.08,

          random(
            vec2(
              floor(
                uv.y *
                45.0
              ),
              floor(
                time *
                6.0
              )
            )
          )
        ) *
        (
          0.006 +
          glitchBoost *
          0.025
        );

      float wave =
        sin(
          uv.y *
          150.0 +
          time *
          4.0
        ) *
        (
          0.0012 +
          glitchBoost *
          0.003
        );

      uv.x +=
        wave +
        lineJitter;

      vec2 dxy =
        pixelSize /
        resolution;

      vec2 coord =
        dxy *
        floor(
          uv /
          dxy
        );

      float chroma =
        0.0018 +
        glitchBoost *
        0.006;

      float r =
        texture2D(
          tDiffuse,
          coord +
          vec2(
            chroma,
            0.0
          )
        ).r;

      float g =
        texture2D(
          tDiffuse,
          coord
        ).g;

      float b =
        texture2D(
          tDiffuse,
          coord -
          vec2(
            chroma,
            0.0
          )
        ).b;

      vec4 color =
        vec4(
          r,
          g,
          b,
          1.0
        );

      color.rgb +=
        random(
          coord +
          time
        ) *
        (
          0.055 +
          glitchBoost *
          0.12
        );

      float scan =
        sin(
          coord.y *
          resolution.y *
          1.25
        ) *
        0.035;

      color.rgb -=
        scan;

      float vignette =
        distance(
          vUv,
          vec2(
            0.5
          )
        );

      color.rgb *=
        1.0 -
        smoothstep(
          0.28,
          0.78,
          vignette
        ) *
        0.42;

      gl_FragColor =
        color;

    }
  `
};

const retroPass =
  new ShaderPass(
    RetroShader
  );

composer.addPass(
  retroPass
);

// ============================================================
// LUCES
// ============================================================

const ambientLight =
  new THREE.AmbientLight(
    0x182030,
    0.28
  );

scene.add(
  ambientLight
);

const hemisphere =
  new THREE.HemisphereLight(
    0x26374a,
    0x080706,
    0.35
  );

scene.add(
  hemisphere
);

const moon =
  new THREE.DirectionalLight(
    0xa5c9ff,
    1.15
  );

moon.position.set(
  -30,
  55,
  -20
);

moon.castShadow =
  true;

moon.shadow.mapSize.set(
  768,
  768
);

scene.add(
  moon
);

// ============================================================
// LINTERNA
// ============================================================

const flashlight =
  new THREE.SpotLight(
    0xfff1d5,
    42,
    32,
    Math.PI / 5,
    0.5,
    1.3
  );

scene.add(
  flashlight
);

scene.add(
  flashlight.target
);

let flashlightOn =
  true;

const camDir =
  new THREE.Vector3();

// ============================================================
// PLAYER
// ============================================================

const worldOctree =
  new Octree();

const playerCollider =
  new Capsule(
    new THREE.Vector3(
      0,
      PLAYER_RADIUS,
      0
    ),

    new THREE.Vector3(
      0,
      PLAYER_HEIGHT -
      PLAYER_RADIUS,
      0
    ),

    PLAYER_RADIUS
  );

const playerVelocity =
  new THREE.Vector3();

const movementDirection =
  new THREE.Vector3();

const forwardVector =
  new THREE.Vector3();

const sideVector =
  new THREE.Vector3();

const movementStep =
  new THREE.Vector3();

const collisionCorrection =
  new THREE.Vector3();

let playerOnFloor = false;

let bobTime = 0;

// ============================================================
// SPAWN
// ============================================================

const spawnPoint =
  new THREE.Vector3();

let spawnReady = false;

let killHeight = -50;

// ============================================================
// TECLADO
// ============================================================

const keyStates = {};

document.addEventListener(
  'keydown',
  event => {
    keyStates[event.code] =
      true;

    if (
      event.code === 'F3'
    ) {
      event.preventDefault();

      debugVisible =
        !debugVisible;

      debugPanel.style.display =
        debugVisible
          ? 'block'
          : 'none';
    }

    if (
      event.code === 'Space' &&
      !event.repeat
    ) {
      event.preventDefault();

      queueJump();
    }

    if (
      event.code === 'KeyF' &&
      !event.repeat &&
      gameStarted &&
      !gamePaused
    ) {
      toggleFlashlight();
    }

    if (
      event.code === 'KeyE' &&
      !event.repeat &&
      gameStarted &&
      !gamePaused
    ) {
      executeInteraction();
    }
  }
);

document.addEventListener(
  'keyup',
  event => {
    keyStates[event.code] =
      false;
  }
);

// ============================================================
// SALTO
// ============================================================

function queueJump() {
  if (
    !gameStarted ||
    gamePaused ||
    gameOver ||
    gameWon ||
    entityCatchActive ||
    !spawnReady
  ) {
    return;
  }

  jumpBufferTimer =
    JUMP_BUFFER_TIME;

  tryConsumeJump();
}

function tryConsumeJump() {
  if (
    jumpBufferTimer <= 0
  ) {
    return;
  }

  if (
    !playerOnFloor &&
    groundedGraceTimer <= 0
  ) {
    return;
  }

  playerVelocity.y =
    JUMP_VELOCITY;

  playerOnFloor =
    false;

  groundedGraceTimer =
    0;

  jumpBufferTimer =
    0;
}

// ============================================================
// LINTERNA
// ============================================================

function toggleFlashlight() {
  flashlightOn =
    !flashlightOn;

  flashlight.visible =
    flashlightOn;

  flashlightStatus.textContent =
    flashlightOn
      ? 'LIGHT ●'
      : 'LIGHT ○';

  flashlightStatus.classList.toggle(
    'off',
    !flashlightOn
  );
}

// ============================================================
// GAMEPAD
// ============================================================

window.addEventListener(
  'gamepadconnected',
  event => {
    activeGamepadIndex =
      event.gamepad.index;

    console.log(
      '🎮 Control conectado:',
      event.gamepad.id
    );
  }
);

window.addEventListener(
  'gamepaddisconnected',
  event => {
    if (
      activeGamepadIndex ===
      event.gamepad.index
    ) {
      activeGamepadIndex =
        null;
    }

    gamepadMoveX = 0;
    gamepadMoveY = 0;

    gamepadLookX = 0;
    gamepadLookY = 0;

    gamepadRunning =
      false;
  }
);

function applyDeadzone(
  value,
  deadzone =
    GAMEPAD_DEADZONE
) {
  const absolute =
    Math.abs(value);

  if (
    absolute <
    deadzone
  ) {
    return 0;
  }

  const normalized =
    (
      absolute -
      deadzone
    ) /
    (
      1 -
      deadzone
    );

  return (
    Math.sign(value) *
    normalized
  );
}

function gamepadButtonPressed(
  gamepad,
  buttonIndex
) {
  if (
    !gamepad.buttons[
      buttonIndex
    ]
  ) {
    return false;
  }

  const pressed =
    gamepad.buttons[
      buttonIndex
    ].pressed;

  const previous =
    previousGamepadButtons[
      buttonIndex
    ] ||
    false;

  previousGamepadButtons[
    buttonIndex
  ] =
    pressed;

  return (
    pressed &&
    !previous
  );
}

function updateGamepad(
  delta
) {
  const gamepads =
    navigator.getGamepads
      ? navigator.getGamepads()
      : [];

  let gamepad =
    null;

  if (
    activeGamepadIndex !==
    null
  ) {
    gamepad =
      gamepads[
        activeGamepadIndex
      ];
  }

  if (
    !gamepad
  ) {
    for (
      const pad
      of gamepads
    ) {
      if (
        pad &&
        pad.connected
      ) {
        gamepad =
          pad;

        activeGamepadIndex =
          pad.index;

        break;
      }
    }
  }

  if (
    !gamepad
  ) {
    gamepadMoveX = 0;
    gamepadMoveY = 0;

    gamepadLookX = 0;
    gamepadLookY = 0;

    gamepadRunning =
      false;

    return;
  }

  gamepadMoveX =
    applyDeadzone(
      gamepad.axes[0] ||
      0
    );

  gamepadMoveY =
    applyDeadzone(
      gamepad.axes[1] ||
      0
    );

  gamepadLookX =
    applyDeadzone(
      gamepad.axes[2] ||
      0
    );

  gamepadLookY =
    applyDeadzone(
      gamepad.axes[3] ||
      0
    );

  gamepadRunning =
    (
      gamepad.buttons[7]
        ?.value ||
      0
    ) >
    0.35;

  if (
    gamepadButtonPressed(
      gamepad,
      0
    )
  ) {
    queueJump();
  }

  if (
    gamepadButtonPressed(
      gamepad,
      2
    )
  ) {
    executeInteraction();
  }

  if (
    gamepadButtonPressed(
      gamepad,
      3
    )
  ) {
    toggleFlashlight();
  }

  if (
    gamepadButtonPressed(
      gamepad,
      5
    )
  ) {
    spawnProjectile();
  }

  updateGamepadCamera(
    delta
  );
}

function updateGamepadCamera(
  delta
) {
  if (
    Math.abs(
      gamepadLookX
    ) <
    0.001 &&
    Math.abs(
      gamepadLookY
    ) <
    0.001
  ) {
    return;
  }

  cameraYaw -=
    gamepadLookX *
    GAMEPAD_LOOK_SPEED *
    delta;

  cameraPitch -=
    gamepadLookY *
    GAMEPAD_LOOK_SPEED *
    delta;

  cameraPitch =
    THREE.MathUtils.clamp(
      cameraPitch,
      CAMERA_MIN_PITCH,
      CAMERA_MAX_PITCH
    );
}

// ============================================================
// MOUSE
// ============================================================

document.addEventListener(
  'mousemove',
  event => {
    if (
      !controls.isLocked ||
      !gameStarted ||
      gamePaused ||
      gameOver ||
      gameWon ||
      entityCatchActive
    ) {
      return;
    }

    const sensitivity =
      Number(
        sensitivitySlider
          ?.value ||
        1
      );

    cameraYaw -=
      event.movementX *
      CAMERA_MOUSE_SENSITIVITY *
      sensitivity;

    cameraPitch -=
      event.movementY *
      CAMERA_MOUSE_SENSITIVITY *
      sensitivity;

    cameraPitch =
      THREE.MathUtils.clamp(
        cameraPitch,
        CAMERA_MIN_PITCH,
        CAMERA_MAX_PITCH
      );
  }
);

// ============================================================
// DIRECCIÓN DEL MOVIMIENTO
// ============================================================

function calculateMovementDirection() {
  movementDirection.set(
    0,
    0,
    0
  );

  forwardVector.set(
    -Math.sin(
      cameraYaw
    ),
    0,
    -Math.cos(
      cameraYaw
    )
  );

  forwardVector.normalize();

  sideVector
    .crossVectors(
      forwardVector,
      camera.up
    )
    .normalize();

  if (
    keyStates.KeyW
  ) {
    movementDirection.add(
      forwardVector
    );
  }

  if (
    keyStates.KeyS
  ) {
    movementDirection.sub(
      forwardVector
    );
  }

  if (
    keyStates.KeyD
  ) {
    movementDirection.add(
      sideVector
    );
  }

  if (
    keyStates.KeyA
  ) {
    movementDirection.sub(
      sideVector
    );
  }

  movementDirection
    .addScaledVector(
      forwardVector,
      -gamepadMoveY
    );

  movementDirection
    .addScaledVector(
      sideVector,
      gamepadMoveX
    );

  if (
    movementDirection
      .lengthSq() >
    1
  ) {
    movementDirection
      .normalize();
  }

  return movementDirection;
}

// ============================================================
// SINCRONIZAR PERSONAJE
// ============================================================

function syncCharacterToPlayer() {
  if (
    !characterRoot ||
    !spawnReady
  ) {
    return;
  }

  const position =
    getPlayerWorldPosition();

  characterRoot.position.copy(
    position
  );

  const horizontalSpeedSq =
    playerVelocity.x *
    playerVelocity.x +
    playerVelocity.z *
    playerVelocity.z;

  if (
    horizontalSpeedSq >
    0.01
  ) {
    characterMoveDirection.set(
      playerVelocity.x,
      0,
      playerVelocity.z
    );

    characterMoveDirection
      .normalize();

    const desiredRotation =
      Math.atan2(
        characterMoveDirection.x,
        characterMoveDirection.z
      ) +
      CHARACTER_ROTATION_OFFSET;

    let difference =
      desiredRotation -
      characterRoot.rotation.y;

    difference =
      Math.atan2(
        Math.sin(
          difference
        ),
        Math.cos(
          difference
        )
      );

    characterRoot.rotation.y +=
      difference *
      0.18;
  }
}

// ============================================================
// CÁMARA TERCERA PERSONA
// ============================================================

function updateThirdPersonCamera(
  delta,
  immediate = false
) {
  if (
    !spawnReady
  ) {
    return;
  }

  const playerPosition =
    getPlayerWorldPosition(
      playerWorldPosition
    );

  thirdPersonForward.set(
    -Math.sin(
      cameraYaw
    ),
    0,
    -Math.cos(
      cameraYaw
    )
  );

  thirdPersonForward
    .normalize();

  thirdPersonRight
    .crossVectors(
      thirdPersonForward,
      camera.up
    )
    .normalize();

  thirdPersonFocus.set(
    playerPosition.x,
    playerPosition.y +
      THIRD_PERSON_FOCUS_HEIGHT,
    playerPosition.z
  );

  desiredThirdPersonCamera
    .copy(
      thirdPersonFocus
    );

  desiredThirdPersonCamera
    .addScaledVector(
      thirdPersonForward,
      -THIRD_PERSON_DISTANCE
    );

  desiredThirdPersonCamera
    .addScaledVector(
      thirdPersonRight,
      THIRD_PERSON_SHOULDER
    );

  desiredThirdPersonCamera.y +=
    THIRD_PERSON_HEIGHT;

  const pitchVertical =
    Math.sin(
      cameraPitch
    ) *
    2.4;

  desiredThirdPersonCamera.y +=
    pitchVertical;

  cameraCollisionDirection
    .subVectors(
      desiredThirdPersonCamera,
      thirdPersonFocus
    );

  const desiredDistance =
    cameraCollisionDirection
      .length();

  if (
    desiredDistance >
    0.001
  ) {
    cameraCollisionDirection
      .normalize();

    cameraCollisionRaycaster
      .set(
        thirdPersonFocus,
        cameraCollisionDirection
      );

    cameraCollisionRaycaster.far =
      desiredDistance;

    const collisions =
      cameraCollisionRaycaster
        .intersectObjects(
          cameraCollisionMeshes,
          false
        );

    if (
      collisions.length >
      0
    ) {
      const safeDistance =
        Math.max(
          THIRD_PERSON_MIN_DISTANCE,
          collisions[0].distance -
          0.22
        );

      desiredThirdPersonCamera
        .copy(
          thirdPersonFocus
        )
        .addScaledVector(
          cameraCollisionDirection,
          safeDistance
        );
    }
  }

  if (
    immediate
  ) {
    smoothedThirdPersonCamera
      .copy(
        desiredThirdPersonCamera
      );

  } else {
    const smoothing =
      1 -
      Math.exp(
        -THIRD_PERSON_SMOOTHNESS *
        delta
      );

    smoothedThirdPersonCamera
      .lerp(
        desiredThirdPersonCamera,
        smoothing
      );
  }

  camera.position.copy(
    smoothedThirdPersonCamera
  );

  const lookTarget =
    new THREE.Vector3()
      .copy(
        thirdPersonFocus
      );

  lookTarget
    .addScaledVector(
      thirdPersonForward,
      1.15
    );

  lookTarget.y +=
    Math.sin(
      cameraPitch
    ) *
    0.55;

  camera.lookAt(
    lookTarget
  );
}

// ============================================================
// RAPIER
// ============================================================

const rapierWorld =
  new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0
  });

let rapierReady = false;

let rapierGroundBody = null;

let rapierPlayerBody = null;

let rapierPlayerCollider = null;

let shotPower =
  SHOT_POWER_DEFAULT;

const physicalBodies = [];

const knockdownBodies = [];

const projectiles = [];

const rapierTempPlayer =
  new THREE.Vector3();

const rapierTempDirection =
  new THREE.Vector3();

const rapierTempSpawn =
  new THREE.Vector3();

// ============================================================
// HUD FÍSICAS
// ============================================================

function createExamHUD() {
  if (
    document.getElementById(
      'exam-physics-panel'
    )
  ) {
    return;
  }

  const style =
    document.createElement(
      'style'
    );

  style.textContent = `

    #exam-physics-panel {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 65;
      width: 240px;
      padding: 12px 14px;
      background: rgba(0,0,0,.72);
      border: 1px solid rgba(255,255,255,.20);
      box-shadow: 0 0 25px rgba(0,0,0,.55);
      font-family: "Courier New", monospace;
      color: #e8e8e8;
      backdrop-filter: blur(3px);
      pointer-events: auto;
    }

    #exam-physics-panel .exam-title {
      font-size: 10px;
      letter-spacing: 2px;
      color: #ff5454;
      margin-bottom: 8px;
    }

    #exam-physics-panel .exam-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      font-size: 10px;
      margin: 7px 0;
    }

    #exam-physics-panel input[type="range"] {
      width: 100%;
      accent-color: #ddd;
    }

    #exam-physics-panel .exam-value {
      min-width: 30px;
      text-align: right;
      color: white;
    }

    #exam-physics-panel .exam-hint {
      font-size: 9px;
      line-height: 1.55;
      opacity: .72;
      border-top: 1px solid rgba(255,255,255,.12);
      padding-top: 8px;
      margin-top: 8px;
    }

    @media(max-width:700px) {
      #exam-physics-panel {
        right: 8px;
        bottom: 8px;
        width: 200px;
        padding: 9px 10px;
      }
    }

  `;

  document.head.appendChild(
    style
  );

  const panel =
    document.createElement(
      'div'
    );

  panel.id =
    'exam-physics-panel';

  panel.innerHTML = `

    <div class="exam-title">
      PHYSICS // RAPIER
    </div>

    <div class="exam-row">

      <label for="shot-power">
        SHOT POWER
      </label>

      <span
        id="shot-power-value"
        class="exam-value"
      >
        ${shotPower}
      </span>

    </div>

    <input
      id="shot-power"
      type="range"
      min="${SHOT_POWER_MIN}"
      max="${SHOT_POWER_MAX}"
      value="${shotPower}"
      step="1"
    >

    <div class="exam-row">

      <span>
        OBJECTS
      </span>

      <span
        id="dynamic-count"
        class="exam-value"
      >
        0
      </span>

    </div>

    <div class="exam-hint">

      CLICK: disparar<br>
      WASD: mover<br>
      SHIFT: correr<br>
      SPACE: saltar<br>
      E: interactuar<br>
      F: linterna

    </div>

  `;

  document.body.appendChild(
    panel
  );

  panel.style.display =
    gameStarted
      ? 'block'
      : 'none';

  const slider =
    panel.querySelector(
      '#shot-power'
    );

  const value =
    panel.querySelector(
      '#shot-power-value'
    );

  slider.addEventListener(
    'input',
    () => {
      shotPower =
        Number(
          slider.value
        );

      value.textContent =
        String(
          shotPower
        );
    }
  );
}

function updateExamHUD() {
  const counter =
    document.getElementById(
      'dynamic-count'
    );

  if (
    counter
  ) {
    counter.textContent =
      String(
        physicalBodies.length +
        knockdownBodies.length
      );
  }
}

function clearRapierBodyList(
  list
) {
  while (
    list.length
  ) {
    const item =
      list.pop();

    if (
      item.mesh?.parent
    ) {
      item.mesh.parent.remove(
        item.mesh
      );
    }

    if (
      item.body
    ) {
      try {
        rapierWorld.removeRigidBody(
          item.body
        );
      }
      catch (
        error
      ) {
      }
    }

    item.mesh?.geometry?.dispose?.();

    if (
      item.mesh?.material
    ) {
      const materials =
        Array.isArray(
          item.mesh.material
        )
          ? item.mesh.material
          : [
              item.mesh.material
            ];

      materials.forEach(
        material =>
          material.dispose?.()
      );
    }
  }
}

function clearProjectiles() {
  clearRapierBodyList(
    projectiles
  );
}

function clearExamPhysicsObjects() {
  clearRapierBodyList(
    physicalBodies
  );

  clearRapierBodyList(
    knockdownBodies
  );

  clearProjectiles();

  updateExamHUD();
}

function createRapierGround(
  map
) {
  const bounds =
    new THREE.Box3()
      .setFromObject(
        map
      );

  const size =
    new THREE.Vector3();

  const center =
    new THREE.Vector3();

  bounds.getSize(
    size
  );

  bounds.getCenter(
    center
  );

  const floorY =
    spawnReady
      ? spawnPoint.y - 0.16
      : bounds.min.y;

  const halfX =
    Math.max(
      size.x * 0.52,
      25
    );

  const halfZ =
    Math.max(
      size.z * 0.52,
      25
    );

  const bodyDesc =
    RAPIER
      .RigidBodyDesc
      .fixed()
      .setTranslation(
        center.x,
        floorY - 0.25,
        center.z
      );

  rapierGroundBody =
    rapierWorld.createRigidBody(
      bodyDesc
    );

  rapierWorld.createCollider(
    RAPIER
      .ColliderDesc
      .cuboid(
        halfX,
        0.25,
        halfZ
      )
      .setFriction(
        0.9
      )
      .setRestitution(
        0.05
      ),

    rapierGroundBody
  );
}

function createRapierPlayerProxy() {
  if (
    rapierPlayerBody
  ) {
    try {
      rapierWorld.removeRigidBody(
        rapierPlayerBody
      );
    }
    catch (
      error
    ) {
    }
  }

  const position =
    getPlayerWorldPosition(
      rapierTempPlayer
    );

  rapierPlayerBody =
    rapierWorld.createRigidBody(
      RAPIER
        .RigidBodyDesc
        .kinematicPositionBased()
        .setTranslation(
          position.x,

          position.y +
          PLAYER_HEIGHT *
          0.5,

          position.z
        )
    );

  rapierPlayerCollider =
    rapierWorld.createCollider(
      RAPIER
        .ColliderDesc
        .capsule(
          PLAYER_HEIGHT *
          0.33,

          PLAYER_RADIUS
        )
        .setFriction(
          0.6
        )
        .setRestitution(
          0
        ),

      rapierPlayerBody
    );
}

function syncRapierPlayerProxy() {
  if (
    !rapierPlayerBody
  ) {
    return;
  }

  const position =
    getPlayerWorldPosition(
      rapierTempPlayer
    );

  rapierPlayerBody
    .setNextKinematicTranslation({
      x:
        position.x,

      y:
        position.y +
        PLAYER_HEIGHT *
        0.5,

      z:
        position.z
    });
}

function getValidPhysicsPoint(
  index = 0,
  minDistance = 6
) {
  const player =
    getPlayerWorldPosition(
      rapierTempPlayer
    );

  const valid =
    safeFloorPoints.filter(
      point =>
        point.distanceToSquared(
          player
        ) >=
        minDistance *
        minDistance
    );

  const source =
    valid.length
      ? valid
      : safeFloorPoints;

  if (
    !source.length
  ) {
    return spawnPoint.clone();
  }

  return source[
    index %
    source.length
  ].clone();
}

function makePhysicalMaterial(
  type
) {
  const colors = {
    box:
      0x4a4a4a,

    sphere:
      0x777777,

    cylinder:
      0x525b63,

    cone:
      0x6d5850,

    wall:
      0x5c5551,

    projectile:
      0xff4444
  };

  return new THREE.MeshStandardMaterial({
    color:
      colors[type] ||
      0x666666,

    roughness:
      0.72,

    metalness:
      type ===
        'projectile'
        ? 0.35
        : 0.08,

    emissive:
      type ===
        'projectile'
        ? 0x660000
        : 0x000000,

    emissiveIntensity:
      type ===
        'projectile'
        ? 1.5
        : 0
  });
}

function createPhysicalObject(
  type,
  position,
  scale = 1,
  collection =
    physicalBodies
) {
  let geometry;

  let colliderDesc;

  let yOffset =
    0.55 *
    scale;

  if (
    type ===
    'sphere'
  ) {
    const radius =
      0.42 *
      scale;

    geometry =
      new THREE.SphereGeometry(
        radius,
        16,
        12
      );

    colliderDesc =
      RAPIER
        .ColliderDesc
        .ball(
          radius
        );

    yOffset =
      radius;
  }

  else if (
    type ===
    'cylinder'
  ) {
    const radius =
      0.36 *
      scale;

    const halfHeight =
      0.48 *
      scale;

    geometry =
      new THREE.CylinderGeometry(
        radius,
        radius,
        halfHeight * 2,
        14
      );

    colliderDesc =
      RAPIER
        .ColliderDesc
        .cylinder(
          halfHeight,
          radius
        );

    yOffset =
      halfHeight;
  }

  else if (
    type ===
    'cone'
  ) {
    const radius =
      0.42 *
      scale;

    const halfHeight =
      0.52 *
      scale;

    geometry =
      new THREE.ConeGeometry(
        radius,
        halfHeight * 2,
        14
      );

    colliderDesc =
      RAPIER
        .ColliderDesc
        .cone(
          halfHeight,
          radius
        );

    yOffset =
      halfHeight;
  }

  else {
    const halfX =
      0.42 *
      scale;

    const halfY =
      0.42 *
      scale;

    const halfZ =
      0.42 *
      scale;

    geometry =
      new THREE.BoxGeometry(
        halfX * 2,
        halfY * 2,
        halfZ * 2
      );

    colliderDesc =
      RAPIER
        .ColliderDesc
        .cuboid(
          halfX,
          halfY,
          halfZ
        );

    yOffset =
      halfY;
  }

  const mesh =
    new THREE.Mesh(
      geometry,

      makePhysicalMaterial(
        type
      )
    );

  mesh.castShadow =
    true;

  mesh.receiveShadow =
    true;

  scene.add(
    mesh
  );

  const body =
    rapierWorld.createRigidBody(
      RAPIER
        .RigidBodyDesc
        .dynamic()
        .setTranslation(
          position.x,

          position.y +
          yOffset +
          0.15,

          position.z
        )
        .setLinearDamping(
          0.18
        )
        .setAngularDamping(
          0.12
        )
    );

  const collider =
    rapierWorld.createCollider(
      colliderDesc
        .setDensity(
          1.1
        )
        .setFriction(
          0.72
        )
        .setRestitution(
          type ===
            'sphere'
            ? 0.55
            : 0.18
        ),

      body
    );

  const item = {
    mesh,
    body,
    collider,
    type
  };

  collection.push(
    item
  );

  return item;
}

function spawnDynamicPhysicalObjects() {
  const types = [
    'box',
    'sphere',
    'cylinder',
    'cone'
  ];

  for (
    let i = 0;
    i <
    PHYSICAL_PROP_COUNT;
    i++
  ) {
    const point =
      getValidPhysicsPoint(
        i * 3 + 2,
        7
      );

    point.x +=
      (
        (
          i %
          3
        ) -
        1
      ) *
      0.8;

    point.z +=
      (
        (
          (
            i *
            2
          ) %
          3
        ) -
        1
      ) *
      0.8;

    createPhysicalObject(
      types[
        i %
        types.length
      ],

      point,

      0.78 +
      (
        i %
        3
      ) *
      0.12
    );
  }
}

function createKnockdownStructure() {
  const base =
    getValidPhysicsPoint(
      11,
      10
    );

  const spacing =
    0.9;

  for (
    let row = 0;
    row <
    KNOCKDOWN_ROWS;
    row++
  ) {
    for (
      let column = 0;
      column <
      KNOCKDOWN_COLUMNS;
      column++
    ) {
      const point =
        base.clone();

      point.x +=
        (
          column -
          (
            KNOCKDOWN_COLUMNS -
            1
          ) /
          2
        ) *
        spacing;

      point.y +=
        row *
        0.88;

      const item =
        createPhysicalObject(
          'box',

          point,

          0.9,

          knockdownBodies
        );

      item.mesh.material.color.setHex(
        row %
        2
          ? 0x5b5550
          : 0x44484c
      );
    }
  }
}

function resetExamPhysicsObjects() {
  if (
    !rapierReady
  ) {
    return;
  }

  clearExamPhysicsObjects();

  spawnDynamicPhysicalObjects();

  createKnockdownStructure();

  updateExamHUD();
}

function spawnProjectile() {
  if (
    !rapierReady ||
    !gameStarted ||
    gamePaused ||
    gameOver ||
    gameWon ||
    entityCatchActive
  ) {
    return;
  }

  if (
    projectiles.length >=
    MAX_PROJECTILES
  ) {
    const oldest =
      projectiles.shift();

    if (
      oldest?.mesh?.parent
    ) {
      oldest.mesh.parent.remove(
        oldest.mesh
      );
    }

    if (
      oldest?.body
    ) {
      try {
        rapierWorld.removeRigidBody(
          oldest.body
        );
      }
      catch (
        error
      ) {
      }
    }
  }

  playThrowAnimation();

  const origin =
    getPlayerWorldPosition(
      rapierTempSpawn
    );

  origin.y +=
    1.25;

  camera.getWorldDirection(
    rapierTempDirection
  );

  rapierTempDirection.normalize();

  origin.addScaledVector(
    rapierTempDirection,
    0.85
  );

  const mesh =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        PROJECTILE_RADIUS,
        12,
        8
      ),

      makePhysicalMaterial(
        'projectile'
      )
    );

  mesh.position.copy(
    origin
  );

  mesh.castShadow =
    true;

  scene.add(
    mesh
  );

  const body =
    rapierWorld.createRigidBody(
      RAPIER
        .RigidBodyDesc
        .dynamic()
        .setTranslation(
          origin.x,
          origin.y,
          origin.z
        )
        .setCcdEnabled(
          true
        )
        .setLinearDamping(
          0.03
        )
    );

  const collider =
    rapierWorld.createCollider(
      RAPIER
        .ColliderDesc
        .ball(
          PROJECTILE_RADIUS
        )
        .setDensity(
          2.2
        )
        .setRestitution(
          0.15
        ),

      body
    );

  const speed =
    shotPower *
    PROJECTILE_SPEED_FACTOR;

  body.setLinvel({
    x:
      rapierTempDirection.x *
      speed,

    y:
      rapierTempDirection.y *
      speed +
      0.5,

    z:
      rapierTempDirection.z *
      speed

  }, true);

  projectiles.push({
    mesh,
    body,
    collider,

    type:
      'projectile',

    born:
      performance.now(),

    power:
      shotPower
  });

  triggerVHSGlitch(
    0.15
  );
}

function projectileImpactSweep() {
  for (
    let i =
      projectiles.length -
      1;
    i >= 0;
    i--
  ) {
    const projectile =
      projectiles[i];

    const projectilePosition =
      projectile.body
        .translation();

    let impacted =
      false;

    for (
      const item
      of [
        ...physicalBodies,
        ...knockdownBodies
      ]
    ) {
      const bodyPosition =
        item.body
          .translation();

      const dx =
        bodyPosition.x -
        projectilePosition.x;

      const dy =
        bodyPosition.y -
        projectilePosition.y;

      const dz =
        bodyPosition.z -
        projectilePosition.z;

      const distanceSquared =
        dx * dx +
        dy * dy +
        dz * dz;

      if (
        distanceSquared >
        1.05 *
        1.05
      ) {
        continue;
      }

      const inverseDistance =
        1 /
        Math.max(
          Math.sqrt(
            distanceSquared
          ),
          0.15
        );

      const impulse =
        projectile.power *
        0.44;

      item.body.applyImpulse({
        x:
          dx *
          inverseDistance *
          impulse,

        y:
          Math.max(
            2.2,

            dy *
            inverseDistance *
            impulse +
            impulse *
            0.24
          ),

        z:
          dz *
          inverseDistance *
          impulse

      }, true);

      item.body.applyTorqueImpulse({
        x:
          (
            Math.random() -
            0.5
          ) *
          impulse *
          0.35,

        y:
          (
            Math.random() -
            0.5
          ) *
          impulse *
          0.35,

        z:
          (
            Math.random() -
            0.5
          ) *
          impulse *
          0.35

      }, true);

      impacted =
        true;

      break;
    }

    const expired =
      performance.now() -
      projectile.born >
      PROJECTILE_LIFETIME *
      1000;

    if (
      impacted ||
      expired ||
      projectilePosition.y <
      killHeight
    ) {
      if (
        projectile.mesh.parent
      ) {
        projectile.mesh.parent.remove(
          projectile.mesh
        );
      }

      try {
        rapierWorld.removeRigidBody(
          projectile.body
        );
      }
      catch (
        error
      ) {
      }

      projectile.mesh.geometry.dispose();

      projectile.mesh.material.dispose();

      projectiles.splice(
        i,
        1
      );

      if (
        impacted
      ) {
        triggerVHSGlitch(
          0.35
        );
      }
    }
  }
}

function syncRapierMeshes() {
  const objects = [
    ...physicalBodies,
    ...knockdownBodies,
    ...projectiles
  ];

  for (
    const item
    of objects
  ) {
    const position =
      item.body
        .translation();

    const rotation =
      item.body
        .rotation();

    item.mesh.position.set(
      position.x,
      position.y,
      position.z
    );

    item.mesh.quaternion.set(
      rotation.x,
      rotation.y,
      rotation.z,
      rotation.w
    );
  }
}

function updateRapierPhysics(
  delta
) {
  if (
    !rapierReady
  ) {
    return;
  }

  syncRapierPlayerProxy();

  rapierWorld.timestep =
    Math.min(
      delta,
      1 / 30
    );

  rapierWorld.step();

  projectileImpactSweep();

  syncRapierMeshes();
}

function setupExamPhysics(
  map
) {
  createRapierGround(
    map
  );

  createRapierPlayerProxy();

  createExamHUD();

  rapierReady =
    true;

  resetExamPhysicsObjects();

  console.log(
    '✅ Rapier 3D listo.'
  );

  console.log(
    '✅ 4 tipos físicos: box / sphere / cylinder / cone.'
  );

  console.log(
    '✅ Estructura derribable lista.'
  );

  console.log(
    '✅ Proyectiles físicos listos.'
  );
}

document.addEventListener(
  'mousedown',
  event => {
    if (
      event.button === 0 &&
      controls.isLocked
    ) {
      spawnProjectile();
    }
  }
);

// ============================================================
// ENEMIGO
// ============================================================

function createEntity() {
  enemyLoader.load(
    ENEMY_PATH,

    fbx => {
      const root =
        new THREE.Group();

      root.name =
        'ENTITY_01';

      const model =
        fbx;

      model.name =
        'ENTITY_MODEL';

      const blackMaterial =
        new THREE.MeshStandardMaterial({
          color:
            0x000000,

          roughness:
            1,

          metalness:
            0,

          emissive:
            0x000000,

          emissiveIntensity:
            0
        });

      model.traverse(
        child => {
          if (
            !child.isMesh
          ) {
            return;
          }

          child.material =
            blackMaterial;

          child.castShadow =
            true;

          child.receiveShadow =
            false;
        }
      );

      root.add(
        model
      );

      scene.add(
        root
      );

      model.scale.setScalar(
        1
      );

      model.updateMatrixWorld(
        true
      );

      let box =
        new THREE.Box3()
          .setFromObject(
            model
          );

      const size =
        new THREE.Vector3();

      box.getSize(
        size
      );

      if (
        size.y >
        0.001
      ) {
        const scale =
          1.92 /
          size.y;

        model.scale.setScalar(
          scale
        );
      }

      model.updateMatrixWorld(
        true
      );

      box =
        new THREE.Box3()
          .setFromObject(
            model
          );

      model.position.y -=
        box.min.y;

      entity =
        root;

      entity.visible =
        false;

      entityReady =
        true;

      console.log(
        '👤 ENTITY cargado en T-pose.'
      );

      console.log(
        '⬛ ENTITY material negro aplicado.'
      );

      checkReady();
    },

    progress => {
      if (
        progress.total
      ) {
        const percent =
          Math.floor(
            progress.loaded /
            progress.total *
            100
          );

        console.log(
          `ENTITY ${percent}%`
        );
      }
    },

    error => {
      console.error(
        '❌ Error cargando enemy.fbx:',
        error
      );

      entityReady =
        false;

      if (
        loadingStatus
      ) {
        loadingStatus.textContent =
          'ENTITY ERROR';
      }
    }
  );
}

const entityGroundRay =
  new THREE.Raycaster();

const entityGroundOrigin =
  new THREE.Vector3();

const entityGroundDirection =
  new THREE.Vector3(
    0,
    -1,
    0
  );

function getEntityGroundY(
  x,
  z,
  fallbackY =
    spawnPoint.y
) {
  if (
    !cameraCollisionMeshes.length
  ) {
    return fallbackY;
  }

  entityGroundOrigin.set(
    x,
    fallbackY + 30,
    z
  );

  entityGroundRay.set(
    entityGroundOrigin,
    entityGroundDirection
  );

  entityGroundRay.far =
    70;

  const hits =
    entityGroundRay
      .intersectObjects(
        cameraCollisionMeshes,
        false
      );

  for (
    const hit
    of hits
  ) {
    if (
      !hit.face
    ) {
      continue;
    }

    const normal =
      hit.face.normal
        .clone()
        .transformDirection(
          hit.object.matrixWorld
        );

    if (
      normal.y >
      0.45
    ) {
      return hit.point.y;
    }
  }

  return fallbackY;
}

function snapEntityToGround(
  immediate = false
) {
  if (
    !entity
  ) {
    return;
  }

  const groundY =
    getEntityGroundY(
      entity.position.x,
      entity.position.z,
      entity.position.y
    );

  if (
    immediate
  ) {
    entity.position.y =
      groundY;

  } else {
    entity.position.y =
      THREE.MathUtils.lerp(
        entity.position.y,
        groundY,
        0.25
      );
  }
}

function getEntitySpawnPoint(
  minDistance =
    ENTITY_STALK_MIN_DISTANCE,

  maxDistance =
    ENTITY_STALK_MAX_DISTANCE
) {
  if (
    !safeFloorPoints.length
  ) {
    return spawnPoint.clone();
  }

  const player =
    getPlayerWorldPosition(
      new THREE.Vector3()
    );

  const candidates =
    safeFloorPoints.filter(
      point => {
        const distance =
          Math.hypot(
            point.x -
            player.x,

            point.z -
            player.z
          );

        return (
          distance >=
          minDistance &&
          distance <=
          maxDistance
        );
      }
    );

  if (
    candidates.length
  ) {
    return candidates[
      Math.floor(
        Math.random() *
        candidates.length
      )
    ].clone();
  }

  return safeFloorPoints[
    Math.floor(
      Math.random() *
      safeFloorPoints.length
    )
  ].clone();
}

function hideEntity() {
  if (
    entity
  ) {
    entity.visible =
      false;
  }

  entityVisible =
    false;

  entityChasing =
    false;

  entityGlitchAmount =
    0;
}

function showEntityStalking() {
  if (
    !entity ||
    !entityReady ||
    entityCatchActive ||
    tapesCollected <
    1
  ) {
    return;
  }

  const position =
    getEntitySpawnPoint();

  entity.position.copy(
    position
  );

  snapEntityToGround(
    true
  );

  entity.visible =
    true;

  entityVisible =
    true;

  entityChasing =
    false;

  entityVisibleTimer =
    2.5 +
    Math.random() *
    2;
}

function beginEntityChase() {
  if (
    !entity ||
    !entityReady ||
    entityCatchActive
  ) {
    return;
  }

  if (
    !entity.visible
  ) {
    const position =
      getEntitySpawnPoint(
        12,
        20
      );

    entity.position.copy(
      position
    );

    snapEntityToGround(
      true
    );
  }

  entity.visible =
    true;

  entityVisible =
    true;

  entityChasing =
    true;

  triggerVHSGlitch(
    0.7
  );
}

function calculateEntitySpeed() {
  if (
    !powerRestored
  ) {
    return 0;
  }

  if (
    tapesCollected <=
    1
  ) {
    return 1.45;
  }

  if (
    tapesCollected ===
    2
  ) {
    return 1.85;
  }

  if (
    tapesCollected ===
    3
  ) {
    return 2.3;
  }

  if (
    tapesCollected ===
    4
  ) {
    return 2.8;
  }

  return 3.5;
}

function horizontalEntityDistance() {
  if (
    !entity
  ) {
    return Infinity;
  }

  const player =
    getPlayerWorldPosition(
      new THREE.Vector3()
    );

  return Math.hypot(
    player.x -
    entity.position.x,

    player.z -
    entity.position.z
  );
}

function playScreamerSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext;

    if (
      !AudioContextClass
    ) {
      return;
    }

    const audio =
      new AudioContextClass();

    const oscillator1 =
      audio.createOscillator();

    const oscillator2 =
      audio.createOscillator();

    const gain =
      audio.createGain();

    const distortion =
      audio.createWaveShaper();

    const curve =
      new Float32Array(
        256
      );

    for (
      let i = 0;
      i <
      curve.length;
      i++
    ) {
      const x =
        i *
        2 /
        curve.length -
        1;

      curve[i] =
        Math.tanh(
          x *
          5
        );
    }

    distortion.curve =
      curve;

    oscillator1.type =
      'sawtooth';

    oscillator2.type =
      'square';

    oscillator1.frequency
      .setValueAtTime(
        85,
        audio.currentTime
      );

    oscillator1.frequency
      .exponentialRampToValueAtTime(
        900,
        audio.currentTime +
        0.22
      );

    oscillator2.frequency
      .setValueAtTime(
        45,
        audio.currentTime
      );

    oscillator2.frequency
      .exponentialRampToValueAtTime(
        430,
        audio.currentTime +
        0.3
      );

    gain.gain
      .setValueAtTime(
        0.32,
        audio.currentTime
      );

    gain.gain
      .exponentialRampToValueAtTime(
        0.01,
        audio.currentTime +
        0.95
      );

    oscillator1.connect(
      distortion
    );

    oscillator2.connect(
      distortion
    );

    distortion.connect(
      gain
    );

    gain.connect(
      audio.destination
    );

    oscillator1.start();

    oscillator2.start();

    oscillator1.stop(
      audio.currentTime +
      0.95
    );

    oscillator2.stop(
      audio.currentTime +
      0.95
    );
  }

  catch (
    error
  ) {
  }
}

function triggerEntityCatch() {
  if (
    entityCatchActive ||
    gameOver ||
    gameWon
  ) {
    return;
  }

  entityCatchActive =
    true;

  gamePaused =
    true;

  playerVelocity.set(
    0,
    0,
    0
  );

  screamerOverlay.style.display =
    'flex';

  screamerFace.style.opacity =
    '0';

  screamerFace.style.transform =
    'scale(.05) rotate(-8deg)';

  screamerFlash.style.opacity =
    '1';

  screamerRed.style.opacity =
    '0';

  screamerStatic.style.opacity =
    '0';

  screamerMouth.style.transform =
    'translateX(-50%) scaleY(.25)';

  playScreamerSound();

  triggerVHSGlitch(
    2
  );

  setTimeout(
    () => {
      screamerFlash.style.opacity =
        '0';

      screamerRed.style.opacity =
        '0.35';

      screamerStatic.style.opacity =
        '0.22';

      screamerFace.style.opacity =
        '1';

      screamerFace.style.transition =
        'transform .13s linear';

      screamerFace.style.transform =
        'scale(1.45) rotate(3deg)';

      screamerMouth.style.transform =
        'translateX(-50%) scaleY(1)';
    },
    70
  );

  setTimeout(
    () => {
      screamerFace.style.transform =
        'scale(2.15) rotate(-5deg)';

      screamerRed.style.opacity =
        '0.18';

      screamerStatic.style.opacity =
        '0.42';

      screamerEyeLeft.style.transform =
        'scale(1.25)';

      screamerEyeRight.style.transform =
        'scale(1.25)';
    },
    270
  );

  setTimeout(
    () => {
      screamerFace.style.transform =
        'scale(3.1) rotate(6deg)';

      screamerFlash.style.opacity =
        '0.55';

      screamerStatic.style.opacity =
        '0.75';
    },
    520
  );

  setTimeout(
    () => {
      screamerFace.style.opacity =
        '0';

      screamerFlash.style.opacity =
        '0';

      screamerRed.style.opacity =
        '0';

      screamerStatic.style.opacity =
        '0';
    },
    760
  );

  setTimeout(
    () => {
      screamerOverlay.style.display =
        'none';

      screamerFace.style.transform =
        'scale(.05) rotate(-8deg)';

      screamerEyeLeft.style.transform =
        '';

      screamerEyeRight.style.transform =
        '';

      screamerMouth.style.transform =
        'translateX(-50%) scaleY(.25)';

      entityCatchActive =
        false;

      hideEntity();

      loseLife();

      entitySightTimer =
        6;

      if (
        !gameOver
      ) {
        gamePaused =
          false;
      }
    },
    930
  );
}

function updateEntity(
  delta
) {
  if (
    !entity ||
    !entityReady ||
    !gameStarted ||
    gamePaused ||
    gameOver ||
    gameWon ||
    entityCatchActive
  ) {
    entityGlitchAmount =
      THREE.MathUtils.lerp(
        entityGlitchAmount,
        0,
        0.08
      );

    return;
  }

  if (
    tapesCollected <
    1
  ) {
    hideEntity();

    return;
  }

  if (
    !powerRestored
  ) {
    entitySightTimer -=
      delta;

    if (
      !entityVisible &&
      entitySightTimer <=
      0
    ) {
      showEntityStalking();

      entitySightTimer =
        9 +
        Math.random() *
        6;
    }

    if (
      entityVisible
    ) {
      entityVisibleTimer -=
        delta;

      const player =
        getPlayerWorldPosition(
          entityTarget
        );

      entityLookTarget.set(
        player.x,

        entity.position.y +
        1,

        player.z
      );

      entity.lookAt(
        entityLookTarget
      );

      entity.rotation.y +=
        Math.PI;

      snapEntityToGround(
        false
      );

      const distance =
        horizontalEntityDistance();

      entityGlitchAmount =
        distance <
        10
          ? (
              1 -
              distance /
              10
            ) *
            0.45
          : 0.04;

      if (
        distance <
        ENTITY_CATCH_DISTANCE
      ) {
        triggerEntityCatch();

        return;
      }

      if (
        entityVisibleTimer <=
        0
      ) {
        hideEntity();
      }
    }

    return;
  }

  if (
    !entityChasing
  ) {
    beginEntityChase();
  }

  const player =
    getPlayerWorldPosition(
      entityTarget
    );

  entityDirection.set(
    player.x -
    entity.position.x,

    0,

    player.z -
    entity.position.z
  );

  const distance =
    entityDirection.length();

  if (
    distance >
    0.001
  ) {
    entityDirection.normalize();
  }

  entitySpeed =
    calculateEntitySpeed();

  entity.position.addScaledVector(
    entityDirection,

    entitySpeed *
    delta
  );

  snapEntityToGround(
    false
  );

  entityLookTarget.set(
    player.x,

    entity.position.y +
    1,

    player.z
  );

  entity.lookAt(
    entityLookTarget
  );

  entity.rotation.y +=
    Math.PI;

  if (
    distance <
    12
  ) {
    entityGlitchAmount =
      (
        1 -
        THREE.MathUtils.clamp(
          distance /
          12,
          0,
          1
        )
      ) *
      0.85;

  } else {
    entityGlitchAmount =
      THREE.MathUtils.lerp(
        entityGlitchAmount,
        0,
        0.05
      );
  }

  if (
    distance <
    ENTITY_CATCH_DISTANCE
  ) {
    triggerEntityCatch();
  }
}

// ============================================================
// INTERACCIONES
// ============================================================

const interactiveObjects = [];
const doors = [];

let currentTarget = null;
let interactionTimer = 0;

const interactiveWorldPosition =
  new THREE.Vector3();

const interactionForward =
  new THREE.Vector3();

const interactionToTarget =
  new THREE.Vector3();

function isDoorObject(
  object
) {
  let current =
    object;

  while (
    current
  ) {
    const name =
      (
        current.name ||
        ''
      )
        .toLowerCase();

    if (
      name.includes(
        'door'
      ) ||
      name.includes(
        'puerta'
      ) ||
      name.includes(
        'gate'
      )
    ) {
      return true;
    }

    current =
      current.parent;
  }

  return false;
}

function findDoorRoot(
  object
) {
  let current =
    object;

  let result =
    null;

  while (
    current &&
    current !==
    scene
  ) {
    const name =
      (
        current.name ||
        ''
      )
        .toLowerCase();

    if (
      name.includes(
        'door'
      ) ||
      name.includes(
        'puerta'
      ) ||
      name.includes(
        'gate'
      )
    ) {
      result =
        current;
    }

    current =
      current.parent;
  }

  return result;
}

function checkInteractions() {
  if (
    !gameStarted ||
    gamePaused ||
    gameOver ||
    gameWon ||
    entityCatchActive
  ) {
    currentTarget =
      null;

    if (
      promptElem
    ) {
      promptElem.style.display =
        'none';
    }

    return;
  }

  const player =
    getPlayerWorldPosition(
      new THREE.Vector3()
    );

  interactionForward.set(
    -Math.sin(
      cameraYaw
    ),
    0,
    -Math.cos(
      cameraYaw
    )
  );

  interactionForward.normalize();

  let bestObject =
    null;

  let bestScore =
    Infinity;

  for (
    const object
    of interactiveObjects
  ) {
    if (
      !object ||
      object.visible ===
      false
    ) {
      continue;
    }

    object.getWorldPosition(
      interactiveWorldPosition
    );

    interactionToTarget
      .subVectors(
        interactiveWorldPosition,
        player
      );

    interactionToTarget.y =
      0;

    const distance =
      interactionToTarget
        .length();

    const type =
      object.userData
        ?.interactType;

    const maxDistance =
      type ===
        'door'
        ? 3.0
        : 2.45;

    if (
      distance >
      maxDistance
    ) {
      continue;
    }

    if (
      distance >
      0.001
    ) {
      interactionToTarget
        .normalize();
    }

    const facing =
      interactionForward
        .dot(
          interactionToTarget
        );

    const requiredFacing =
      type ===
        'door'
        ? -0.05
        : -0.65;

    if (
      facing <
      requiredFacing
    ) {
      continue;
    }

    const score =
      distance -
      facing *
      0.35;

    if (
      score <
      bestScore
    ) {
      bestScore =
        score;

      bestObject =
        object;
    }
  }

  currentTarget =
    bestObject;

  if (
    currentTarget
  ) {
    if (
      promptElem
    ) {
      promptElem.textContent =
        currentTarget
          .userData
          .promptText ||
        '[E] INTERACTUAR';

      promptElem.style.display =
        'block';
    }

  } else {
    if (
      promptElem
    ) {
      promptElem.style.display =
        'none';
    }
  }
}

function removeInteractiveObject(
  object
) {
  const index =
    interactiveObjects
      .indexOf(
        object
      );

  if (
    index >= 0
  ) {
    interactiveObjects.splice(
      index,
      1
    );
  }
}

function executeInteraction() {
  checkInteractions();

  if (
    !currentTarget ||
    gamePaused ||
    gameOver ||
    gameWon
  ) {
    return;
  }

  const type =
    currentTarget
      .userData
      .interactType;

  switch (
    type
  ) {
    case 'door':

      currentTarget
        .userData
        .isOpen =
        !currentTarget
          .userData
          .isOpen;

      currentTarget.rotation.y =
        currentTarget
          .userData
          .closedRotation +
        (
          currentTarget
            .userData
            .isOpen
            ? Math.PI /
              2
            : 0
        );

      currentTarget
        .userData
        .promptText =
        currentTarget
          .userData
          .isOpen
          ? '[E] CERRAR'
          : '[E] ABRIR';

      triggerVHSGlitch(
        0.08
      );

      break;

    case 'tape':

      collectTape(
        currentTarget
      );

      break;

    case 'maintenanceKey':

      collectMaintenanceKey();

      break;

    case 'fuse':

      collectFuse();

      break;

    case 'powerBox':

      restorePower();

      break;

    case 'transmitter':

      useTransmitter();

      break;
  }

  checkInteractions();
}

function updateObjectiveHUD() {
  if (
    !objectiveText
  ) {
    return;
  }

  const objectives = [
    'Encuentra la primera cinta VHS.',
    'Encuentra la llave de mantenimiento.',
    'Encuentra un fusible.',
    'Restaura la energía de la ciudad.',
    `Recupera las cintas restantes. ${tapesCollected}/${TOTAL_TAPES}`,
    'Encuentra la torre de transmisión.',
    'Transmite las grabaciones.'
  ];

  objectiveText.textContent =
    objectives[
      questStage
    ] ||
    objectives[0];
}

function triggerVHSGlitch(
  duration = 1
) {
  vhsEventTimer =
    Math.max(
      vhsEventTimer,
      duration
    );
}

// ============================================================
// CINTAS
// ============================================================

function createTape(
  number,
  position
) {
  const group =
    new THREE.Group();

  group.name =
    `TAPE_${number}`;

  const body =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.42,
        0.10,
        0.26
      ),

      new THREE.MeshStandardMaterial({
        color:
          0x111111,

        roughness:
          0.78,

        metalness:
          0.04
      })
    );

  body.castShadow =
    true;

  const label =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.27,
        0.012,
        0.14
      ),

      new THREE.MeshStandardMaterial({
        color:
          0xe7e2d2,

        emissive:
          0x342f27,

        emissiveIntensity:
          0.55,

        roughness:
          0.65
      })
    );

  label.position.y =
    0.057;

  const reelMaterial =
    new THREE.MeshStandardMaterial({
      color:
        0x333333,

      metalness:
        0.25,

      roughness:
        0.6
    });

  const reelGeometry =
    new THREE.CylinderGeometry(
      0.045,
      0.045,
      0.018,
      12
    );

  const reelLeft =
    new THREE.Mesh(
      reelGeometry,
      reelMaterial
    );

  const reelRight =
    new THREE.Mesh(
      reelGeometry.clone(),
      reelMaterial.clone()
    );

  reelLeft.rotation.x =
    Math.PI /
    2;

  reelRight.rotation.x =
    Math.PI /
    2;

  reelLeft.position.set(
    -0.09,
    0.065,
    0
  );

  reelRight.position.set(
    0.09,
    0.065,
    0
  );

  group.add(
    body,
    label,
    reelLeft,
    reelRight
  );

  group.position.copy(
    position
  );

  group.position.y +=
    0.34;

  group.userData = {
    interactType:
      'tape',

    tapeNumber:
      number,

    collected:
      false,

    baseY:
      group.position.y,

    promptText:
      `[E] RECOGER CINTA ${number}`
  };

  scene.add(
    group
  );

  tapeObjects.push(
    group
  );

  questObjects.push(
    group
  );

  interactiveObjects.push(
    group
  );

  return group;
}

function createMaintenanceKey(
  position
) {
  const group =
    new THREE.Group();

  group.name =
    'MAINTENANCE_KEY';

  const material =
    new THREE.MeshStandardMaterial({
      color:
        0xc6ad68,

      metalness:
        0.85,

      roughness:
        0.25
    });

  const ring =
    new THREE.Mesh(
      new THREE.TorusGeometry(
        0.12,
        0.025,
        8,
        18
      ),

      material
    );

  ring.rotation.x =
    Math.PI /
    2;

  const shaft =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.06,
        0.03,
        0.27
      ),

      material
    );

  shaft.position.z =
    0.18;

  const tooth1 =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.06,
        0.035,
        0.07
      ),

      material
    );

  tooth1.position.set(
    0,
    -0.02,
    0.30
  );

  const tooth2 =
    tooth1.clone();

  tooth2.position.z =
    0.24;

  group.add(
    ring,
    shaft,
    tooth1,
    tooth2
  );

  group.position.copy(
    position
  );

  group.position.y +=
    0.45;

  group.userData = {
    interactType:
      'maintenanceKey',

    baseY:
      group.position.y,

    promptText:
      '[E] RECOGER LLAVE'
  };

  scene.add(
    group
  );

  questObjects.push(
    group
  );

  interactiveObjects.push(
    group
  );

  return group;
}

function createFuse(
  position
) {
  const group =
    new THREE.Group();

  group.name =
    'POWER_FUSE';

  const glassMaterial =
    new THREE.MeshStandardMaterial({
      color:
        0x9ed8ff,

      emissive:
        0x164d6b,

      emissiveIntensity:
        1.4,

      roughness:
        0.2,

      metalness:
        0.05
    });

  const metalMaterial =
    new THREE.MeshStandardMaterial({
      color:
        0xb5b8bb,

      metalness:
        0.8,

      roughness:
        0.25
    });

  const tube =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.065,
        0.065,
        0.30,
        12
      ),

      glassMaterial
    );

  tube.rotation.z =
    Math.PI /
    2;

  const end1 =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.076,
        0.076,
        0.055,
        12
      ),

      metalMaterial
    );

  end1.rotation.z =
    Math.PI /
    2;

  end1.position.x =
    -0.16;

  const end2 =
    end1.clone();

  end2.position.x =
    0.16;

  group.add(
    tube,
    end1,
    end2
  );

  group.position.copy(
    position
  );

  group.position.y +=
    0.45;

  group.userData = {
    interactType:
      'fuse',

    baseY:
      group.position.y,

    promptText:
      '[E] RECOGER FUSIBLE'
  };

  scene.add(
    group
  );

  questObjects.push(
    group
  );

  interactiveObjects.push(
    group
  );

  return group;
}

function createPowerBox(
  position
) {
  const group =
    new THREE.Group();

  group.name =
    'POWER_BOX';

  const body =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.72,
        1.05,
        0.30
      ),

      new THREE.MeshStandardMaterial({
        color:
          0x30363a,

        metalness:
          0.58,

        roughness:
          0.52
      })
    );

  body.position.y =
    0.525;

  body.castShadow =
    true;

  body.receiveShadow =
    true;

  const panel =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.52,
        0.62,
        0.035
      ),

      new THREE.MeshStandardMaterial({
        color:
          0x17191b,

        metalness:
          0.45,

        roughness:
          0.65
      })
    );

  panel.position.set(
    0,
    0.58,
    0.17
  );

  const indicatorMaterial =
    new THREE.MeshStandardMaterial({
      color:
        0x550000,

      emissive:
        0x550000,

      emissiveIntensity:
        2
    });

  const indicator =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        0.055,
        10,
        10
      ),

      indicatorMaterial
    );

  indicator.position.set(
    0,
    0.78,
    0.205
  );

  const lever =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.08,
        0.24,
        0.06
      ),

      new THREE.MeshStandardMaterial({
        color:
          0x777777,

        metalness:
          0.8,

        roughness:
          0.25
      })
    );

  lever.position.set(
    0,
    0.44,
    0.21
  );

  lever.rotation.x =
    -0.25;

  group.add(
    body,
    panel,
    indicator,
    lever
  );

  group.position.copy(
    position
  );

  group.userData = {
    interactType:
      'powerBox',

    indicatorMaterial,

    lever,

    promptText:
      '[E] RESTAURAR ENERGÍA'
  };

  scene.add(
    group
  );

  questObjects.push(
    group
  );

  interactiveObjects.push(
    group
  );

  return group;
}

function createTransmitter(
  position
) {
  const group =
    new THREE.Group();

  group.name =
    'TRANSMITTER';

  const metalMaterial =
    new THREE.MeshStandardMaterial({
      color:
        0x34383d,

      metalness:
        0.75,

      roughness:
        0.45
    });

  const base =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        1.3,
        0.6,
        1.1
      ),

      metalMaterial
    );

  base.position.y =
    0.3;

  base.castShadow =
    true;

  const mast =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.05,
        0.08,
        3.2,
        8
      ),

      metalMaterial
    );

  mast.position.y =
    2.1;

  const arm1 =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        1.1,
        0.05,
        0.05
      ),

      metalMaterial
    );

  arm1.position.y =
    3.0;

  const arm2 =
    arm1.clone();

  arm2.rotation.y =
    Math.PI /
    2;

  const beaconMaterial =
    new THREE.MeshStandardMaterial({
      color:
        0xaa0000,

      emissive:
        0xff0000,

      emissiveIntensity:
        2
    });

  const beacon =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        0.12,
        12,
        12
      ),

      beaconMaterial
    );

  beacon.position.y =
    3.75;

  const beaconLight =
    new THREE.PointLight(
      0xff0000,
      3,
      8,
      2
    );

  beaconLight.position.y =
    3.75;

  group.add(
    base,
    mast,
    arm1,
    arm2,
    beacon,
    beaconLight
  );

  group.position.copy(
    position
  );

  group.userData = {
    interactType:
      'transmitter',

    beacon,

    beaconLight,

    promptText:
      '[E] TRANSMITIR CINTAS'
  };

  scene.add(
    group
  );

  questObjects.push(
    group
  );

  interactiveObjects.push(
    group
  );

  return group;
}

function getQuestPositions(
  amount
) {
  if (
    !safeFloorPoints.length
  ) {
    return [];
  }

  const available = [
    ...safeFloorPoints
  ];

  available.sort(
    (
      a,
      b
    ) =>
      b.distanceToSquared(
        spawnPoint
      ) -

      a.distanceToSquared(
        spawnPoint
      )
  );

  const selected =
    [];

  for (
    const point
    of available
  ) {
    if (
      selected.length >=
      amount
    ) {
      break;
    }

    const separated =
      selected.every(
        selectedPoint =>
          selectedPoint
            .distanceTo(
              point
            ) >
          4.0
      );

    if (
      separated ||
      selected.length ===
      0
    ) {
      selected.push(
        point
      );
    }
  }

  let index =
    0;

  while (
    selected.length <
    amount &&
    available.length
  ) {
    selected.push(
      available[
        index %
        available.length
      ].clone()
    );

    index++;
  }

  return selected;
}

function setupQuestSystem() {
  const positions =
    getQuestPositions(
      9
    );

  const fallback =
    spawnPoint.clone();

  for (
    let i = 0;
    i <
    TOTAL_TAPES;
    i++
  ) {
    const position =
      positions[i] ||

      fallback
        .clone()
        .add(
          new THREE.Vector3(
            3 +
            i *
            2,
            0,
            0
          )
        );

    createTape(
      i + 1,
      position
    );
  }

  maintenanceKeyObject =
    createMaintenanceKey(
      positions[5] ||

      fallback
        .clone()
        .add(
          new THREE.Vector3(
            4,
            0,
            4
          )
        )
    );

  fuseObject =
    createFuse(
      positions[6] ||

      fallback
        .clone()
        .add(
          new THREE.Vector3(
            -4,
            0,
            4
          )
        )
    );

  powerBoxObject =
    createPowerBox(
      positions[7] ||

      fallback
        .clone()
        .add(
          new THREE.Vector3(
            5,
            0,
            -5
          )
        )
    );

  transmitterObject =
    createTransmitter(
      positions[8] ||

      fallback
        .clone()
        .add(
          new THREE.Vector3(
            -6,
            0,
            -6
          )
        )
    );

  tapeObjects.forEach(
    (
      tape,
      index
    ) => {
      tape.visible =
        index === 0;
    }
  );

  maintenanceKeyObject.visible =
    false;

  fuseObject.visible =
    false;

  powerBoxObject.visible =
    false;

  transmitterObject.visible =
    false;

  updateObjectiveHUD();
}

function collectTape(
  tape
) {
  if (
    tape.userData
      .collected
  ) {
    return;
  }

  tape.userData.collected =
    true;

  tape.visible =
    false;

  removeInteractiveObject(
    tape
  );

  tapesCollected++;

  triggerVHSGlitch(
    0.9
  );

  showQuestNotification(
    `TAPE ${tape.userData.tapeNumber} RECOVERED // ${tapesCollected}/${TOTAL_TAPES}`,
    3000
  );

  if (
    tapesCollected ===
    1 &&
    questStage ===
    0
  ) {
    questStage =
      1;

    maintenanceKeyObject.visible =
      true;

    entitySightTimer =
      2;

    showQuestNotification(
      'ALGO TE ESTÁ OBSERVANDO...',
      2200
    );
  }

  if (
    tapesCollected >=
    TOTAL_TAPES &&
    powerRestored
  ) {
    questStage =
      5;

    transmitterObject.visible =
      true;

    showQuestNotification(
      'ALL TAPES RECOVERED // FIND THE TRANSMITTER',
      3500
    );
  }

  updateObjectiveHUD();
}

function collectMaintenanceKey() {
  if (
    hasMaintenanceKey
  ) {
    return;
  }

  hasMaintenanceKey =
    true;

  maintenanceKeyObject.visible =
    false;

  removeInteractiveObject(
    maintenanceKeyObject
  );

  fuseObject.visible =
    true;

  questStage =
    2;

  triggerVHSGlitch(
    0.2
  );

  showQuestNotification(
    'MAINTENANCE KEY ACQUIRED',
    2500
  );

  updateObjectiveHUD();
}

function collectFuse() {
  if (
    hasFuse
  ) {
    return;
  }

  hasFuse =
    true;

  fuseObject.visible =
    false;

  removeInteractiveObject(
    fuseObject
  );

  powerBoxObject.visible =
    true;

  questStage =
    3;

  triggerVHSGlitch(
    0.25
  );

  showQuestNotification(
    'FUSE ACQUIRED',
    2500
  );

  updateObjectiveHUD();
}

function restorePower() {
  if (
    !hasFuse
  ) {
    showQuestNotification(
      'FUSE REQUIRED'
    );

    return;
  }

  if (
    powerRestored
  ) {
    showQuestNotification(
      'POWER ALREADY RESTORED'
    );

    return;
  }

  powerRestored =
    true;

  powerBoxObject
    .userData
    .indicatorMaterial
    .color
    .set(
      0x00ff55
    );

  powerBoxObject
    .userData
    .indicatorMaterial
    .emissive
    .set(
      0x00ff55
    );

  powerBoxObject
    .userData
    .indicatorMaterial
    .emissiveIntensity =
    3;

  if (
    powerBoxObject
      .userData
      .lever
  ) {
    powerBoxObject
      .userData
      .lever
      .rotation
      .x =
      0.35;
  }

  tapeObjects.forEach(
    tape => {
      if (
        !tape.userData
          .collected
      ) {
        tape.visible =
          true;
      }
    }
  );

  questStage =
    4;

  beginEntityChase();

  triggerVHSGlitch(
    1.6
  );

  showQuestNotification(
    'CITY POWER RESTORED // ENTITY ACTIVE',
    4200
  );

  updateObjectiveHUD();
}

function useTransmitter() {
  if (
    tapesCollected <
    TOTAL_TAPES
  ) {
    showQuestNotification(
      `MISSING TAPES // ${tapesCollected}/${TOTAL_TAPES}`,
      2600
    );

    return;
  }

  if (
    !powerRestored
  ) {
    showQuestNotification(
      'NO POWER'
    );

    return;
  }

  questStage =
    6;

  updateObjectiveHUD();

  triggerVHSGlitch(
    1
  );

  showQuestNotification(
    'TRANSMITTING...',
    2300
  );

  setTimeout(
    () => {
      finishGame();
    },
    2450
  );
}

function updateQuestObjects(
  time
) {
  questObjects.forEach(
    (
      object,
      index
    ) => {
      if (
        !object.visible
      ) {
        return;
      }

      const type =
        object.userData
          .interactType;

      if (
        type ===
        'tape' ||
        type ===
        'maintenanceKey' ||
        type ===
        'fuse'
      ) {
        object.rotation.y +=
          0.008;

        object.rotation.z =
          Math.sin(
            time *
            1.5 +
            index
          ) *
          0.04;

        object.position.y =
          object.userData
            .baseY +
          Math.sin(
            time *
            2 +
            index
          ) *
          0.06;
      }

      if (
        type ===
        'transmitter'
      ) {
        const pulse =
          1.5 +
          Math.sin(
            time *
            5
          ) *
          0.9;

        object
          .userData
          .beacon
          .material
          .emissiveIntensity =
          pulse;

        object
          .userData
          .beaconLight
          .intensity =
          2 +
          Math.sin(
            time *
            5
          ) *
          1.5;
      }
    }
  );
}

function resetQuestState() {
  tapesCollected =
    0;

  hasMaintenanceKey =
    false;

  hasFuse =
    false;

  powerRestored =
    false;

  questStage =
    0;

  tapeObjects.forEach(
    (
      tape,
      index
    ) => {
      tape.userData.collected =
        false;

      tape.visible =
        index ===
        0;

      if (
        !interactiveObjects
          .includes(
            tape
          )
      ) {
        interactiveObjects.push(
          tape
        );
      }
    }
  );

  maintenanceKeyObject.visible =
    false;

  fuseObject.visible =
    false;

  powerBoxObject.visible =
    false;

  transmitterObject.visible =
    false;

  const objectsToRestore = [
    maintenanceKeyObject,
    fuseObject,
    powerBoxObject,
    transmitterObject
  ];

  objectsToRestore.forEach(
    object => {
      if (
        object &&
        !interactiveObjects
          .includes(
            object
          )
      ) {
        interactiveObjects.push(
          object
        );
      }
    }
  );

  powerBoxObject
    .userData
    .indicatorMaterial
    .color
    .set(
      0x550000
    );

  powerBoxObject
    .userData
    .indicatorMaterial
    .emissive
    .set(
      0x550000
    );

  powerBoxObject
    .userData
    .indicatorMaterial
    .emissiveIntensity =
    2;

  if (
    powerBoxObject
      .userData
      .lever
  ) {
    powerBoxObject
      .userData
      .lever
      .rotation
      .x =
      -0.25;
  }

  hideEntity();

  entitySightTimer =
    8;

  entityVisibleTimer =
    0;

  entityGlitchAmount =
    0;

  updateObjectiveHUD();
}

// ============================================================
// PERSONAJE / PLAYER
// ============================================================

let entityReady = false;

let stamina = 100;
let isExhausted = false;

let battery = 0.82;

const TOTAL_STAMINA_SEGMENTS = 14;

const tempBox =
  new THREE.Box3();

const tempSize =
  new THREE.Vector3();

const tempCenter =
  new THREE.Vector3();

const tempNormal =
  new THREE.Vector3();

const tempPlayerPosition =
  new THREE.Vector3();

const tempCharacterBox =
  new THREE.Box3();

const tempCharacterSize =
  new THREE.Vector3();

function normalizeCharacterModel(
  model,
  desiredHeight
) {
  model.scale.setScalar(
    1
  );

  model.position.set(
    0,
    0,
    0
  );

  model.updateMatrixWorld(
    true
  );

  tempCharacterBox
    .setFromObject(
      model
    );

  tempCharacterBox.getSize(
    tempCharacterSize
  );

  if (
    tempCharacterSize.y >
    0.001
  ) {
    const scale =
      desiredHeight /
      tempCharacterSize.y;

    model.scale.setScalar(
      scale
    );
  }

  model.updateMatrixWorld(
    true
  );

  tempCharacterBox
    .setFromObject(
      model
    );

  model.position.y -=
    tempCharacterBox.min.y;

  model.updateMatrixWorld(
    true
  );
}

function printCharacterSkeleton(
  root
) {
  console.group(
    '🦴 PLAYER SKELETON'
  );

  let boneCount =
    0;

  root.traverse(
    object => {
      if (
        object.isBone
      ) {
        boneCount++;

        console.log(
          `${boneCount}.`,
          object.name
        );
      }
    }
  );

  console.log(
    `TOTAL BONES: ${boneCount}`
  );

  console.groupEnd();
}

// ============================================================
// CARGAR PERSONAJE
// ============================================================

async function loadCharacter() {
  try {
    if (
      loadingStatus
    ) {
      loadingStatus.textContent =
        'LOADING CHARACTER...';
    }

    const fbx =
      await loadFBXPromise(
        CHARACTER_PATH,
        characterLoader
      );

    characterRoot =
      new THREE.Group();

    characterRoot.name =
      'PLAYER_ROOT';

    characterModel =
      fbx;

    characterModel.name =
      'PLAYER_CHARACTER';

    characterAnimationRoot =
      characterModel;

    characterModel.traverse(
      child => {
        if (
          child.isMesh
        ) {
          child.castShadow =
            true;

          child.receiveShadow =
            true;

          child.frustumCulled =
            true;
        }
      }
    );

    characterRoot.add(
      characterModel
    );

    scene.add(
      characterRoot
    );

    normalizeCharacterModel(
      characterModel,
      CHARACTER_HEIGHT
    );

    printCharacterSkeleton(
      characterModel
    );

    if (
      loadingStatus
    ) {
      loadingStatus.textContent =
        'LOADING ANIMATIONS...';
    }

    await setupCharacterAnimations();

    characterReady =
      true;

    characterRoot.visible =
      false;

    syncCharacterToPlayer();

    console.log(
      '✅ PLAYER cargado.'
    );

    console.log(
      '✅ Character AnimationMixer configurado.'
    );

    checkReady();
  }

  catch (
    error
  ) {
    characterReady =
      false;

    console.error(
      '❌ Error cargando character.fbx:',
      error
    );

    if (
      loadingStatus
    ) {
      loadingStatus.textContent =
        'CHARACTER ERROR';
    }
  }
}

// ============================================================
// COLISIONES DEL MAPA
// ============================================================

function buildCollisionOctree(
  map
) {
  const collisionWorld =
    new THREE.Group();

  const generatedGeometries =
    [];

  map.updateMatrixWorld(
    true
  );

  map.traverse(
    child => {
      if (
        !child.isMesh ||
        !child.geometry
      ) {
        return;
      }

      if (
        isDoorObject(
          child
        )
      ) {
        return;
      }

      const name =
        (
          child.name ||
          ''
        )
          .toLowerCase();

      if (
        name.includes(
          'wire'
        ) ||
        name.includes(
          'cable'
        ) ||
        name.includes(
          'decal'
        ) ||
        name.includes(
          'nocollision'
        )
      ) {
        return;
      }

      tempBox.setFromObject(
        child
      );

      tempBox.getSize(
        tempSize
      );

      const largest =
        Math.max(
          tempSize.x,
          tempSize.y,
          tempSize.z
        );

      if (
        largest <
        COLLIDER_MIN_SIZE
      ) {
        return;
      }

      tempBox.getCenter(
        tempCenter
      );

      const geometry =
        new THREE.BoxGeometry(
          Math.max(
            tempSize.x,
            0.05
          ),

          Math.max(
            tempSize.y,
            0.05
          ),

          Math.max(
            tempSize.z,
            0.05
          )
        );

      geometry.translate(
        tempCenter.x,
        tempCenter.y,
        tempCenter.z
      );

      generatedGeometries.push(
        geometry
      );

      const colliderMesh =
        new THREE.Mesh(
          geometry
        );

      collisionWorld.add(
        colliderMesh
      );
    }
  );

  collisionWorld.updateMatrixWorld(
    true
  );

  worldOctree.fromGraphNode(
    collisionWorld
  );

  collisionWorld.clear();

  generatedGeometries.forEach(
    geometry => {
      geometry.dispose();
    }
  );

  console.log(
    '✅ Octree de colisiones creado.'
  );
}

// ============================================================
// ENCONTRAR SPAWN
// ============================================================

function findSpawn(
  map
) {
  const bounds =
    new THREE.Box3()
      .setFromObject(
        map
      );

  const center =
    new THREE.Vector3();

  const size =
    new THREE.Vector3();

  bounds.getCenter(
    center
  );

  bounds.getSize(
    size
  );

  killHeight =
    bounds.min.y -
    20;

  const meshes =
    [];

  map.traverse(
    child => {
      if (
        child.isMesh &&
        !isDoorObject(
          child
        )
      ) {
        meshes.push(
          child
        );
      }
    }
  );

  const raycaster =
    new THREE.Raycaster();

  const down =
    new THREE.Vector3(
      0,
      -1,
      0
    );

  const candidates =
    [];

  const GRID =
    18;

  for (
    let x = 0;
    x < GRID;
    x++
  ) {
    for (
      let z = 0;
      z < GRID;
      z++
    ) {
      const px =
        THREE.MathUtils.lerp(
          bounds.min.x,
          bounds.max.x,
          (
            x +
            0.5
          ) /
          GRID
        );

      const pz =
        THREE.MathUtils.lerp(
          bounds.min.z,
          bounds.max.z,
          (
            z +
            0.5
          ) /
          GRID
        );

      raycaster.set(
        new THREE.Vector3(
          px,

          bounds.max.y +
          10,

          pz
        ),

        down
      );

      raycaster.far =
        size.y +
        100;

      const hits =
        raycaster.intersectObjects(
          meshes,
          false
        );

      for (
        const hit
        of hits
      ) {
        if (
          !hit.face
        ) {
          continue;
        }

        tempNormal
          .copy(
            hit.face.normal
          )
          .transformDirection(
            hit.object.matrixWorld
          );

        if (
          tempNormal.y <
          0.85
        ) {
          continue;
        }

        candidates.push(
          hit.point.clone()
        );

        break;
      }
    }
  }

  if (
    candidates.length ===
    0
  ) {
    spawnPoint.set(
      center.x,
      bounds.min.y,
      center.z
    );

    safeFloorPoints = [
      spawnPoint.clone()
    ];

    spawnReady =
      true;

    console.warn(
      '⚠️ No se detectaron puntos de piso. Usando centro del mapa.'
    );

    return;
  }

  const levels =
    new Map();

  candidates.forEach(
    point => {
      const level =
        Math.round(
          point.y *
          2
        ) /
        2;

      if (
        !levels.has(
          level
        )
      ) {
        levels.set(
          level,
          []
        );
      }

      levels
        .get(
          level
        )
        .push(
          point
        );
    }
  );

  let mainFloor =
    [];

  for (
    const points
    of levels.values()
  ) {
    if (
      points.length >
      mainFloor.length
    ) {
      mainFloor =
        points;
    }
  }

  safeFloorPoints =
    mainFloor;

  mainFloor.sort(
    (
      a,
      b
    ) =>
      a.distanceToSquared(
        center
      ) -

      b.distanceToSquared(
        center
      )
  );

  spawnPoint.copy(
    mainFloor[0]
  );

  spawnReady =
    true;

  console.log(
    '✅ Spawn detectado:',
    spawnPoint
  );

  console.log(
    `✅ Puntos válidos de piso: ${safeFloorPoints.length}`
  );
}

// ============================================================
// RESPAWN
// ============================================================

function respawnPlayer() {
  if (
    !spawnReady
  ) {
    return;
  }

  playerCollider.start.set(
    spawnPoint.x,

    spawnPoint.y +
    PLAYER_RADIUS +
    0.05,

    spawnPoint.z
  );

  playerCollider.end.set(
    spawnPoint.x,

    spawnPoint.y +
    PLAYER_HEIGHT -
    PLAYER_RADIUS +
    0.05,

    spawnPoint.z
  );

  playerVelocity.set(
    0,
    0,
    0
  );

  playerOnFloor =
    false;

  groundedGraceTimer =
    0;

  jumpBufferTimer =
    0;

  syncCharacterToPlayer();

  smoothedThirdPersonCamera.set(
    spawnPoint.x,

    spawnPoint.y +
    2.2,

    spawnPoint.z +
    THIRD_PERSON_DISTANCE
  );

  updateThirdPersonCamera(
    1 / 60,
    true
  );
}

// ============================================================
// COLISIONES PLAYER
// ============================================================

function resolvePlayerCollision() {
  for (
    let iteration = 0;
    iteration < 4;
    iteration++
  ) {
    const result =
      worldOctree
        .capsuleIntersect(
          playerCollider
        );

    if (
      !result
    ) {
      break;
    }

    if (
      result.normal.y >
      0.5
    ) {
      playerOnFloor =
        true;

      groundedGraceTimer =
        COYOTE_TIME;

      if (
        playerVelocity.y <
        0
      ) {
        playerVelocity.y =
          0;
      }
    }

    const velocityIntoWall =
      result.normal.dot(
        playerVelocity
      );

    if (
      velocityIntoWall <
      0
    ) {
      playerVelocity
        .addScaledVector(
          result.normal,
          -velocityIntoWall
        );
    }

    collisionCorrection
      .copy(
        result.normal
      )
      .multiplyScalar(
        result.depth +
        0.001
      );

    playerCollider.translate(
      collisionCorrection
    );
  }
}

// ============================================================
// UPDATE PLAYER
// ============================================================

function updatePlayer(
  delta
) {
  if (
    !gameStarted ||
    gamePaused ||
    gameOver ||
    gameWon ||
    entityCatchActive ||
    !spawnReady
  ) {
    return;
  }

  groundedGraceTimer =
    Math.max(
      0,
      groundedGraceTimer -
      delta
    );

  jumpBufferTimer =
    Math.max(
      0,
      jumpBufferTimer -
      delta
    );

  playerOnFloor =
    false;

  const direction =
    calculateMovementDirection();

  const moving =
    direction.lengthSq() >
    0.001;

  const running =
    moving &&
    (
      keyStates.ShiftLeft ||
      keyStates.ShiftRight ||
      gamepadRunning
    ) &&
    !isExhausted;

  updateStamina(
    delta,
    moving,
    running
  );

  const targetSpeed =
    running
      ? RUN_SPEED
      : WALK_SPEED;

  const acceleration =
    groundedGraceTimer >
    0
      ? GROUND_ACCELERATION
      : AIR_ACCELERATION;

  const smoothing =
    1 -
    Math.exp(
      -acceleration *
      delta
    );

  playerVelocity.x =
    THREE.MathUtils.lerp(
      playerVelocity.x,

      direction.x *
      targetSpeed,

      smoothing
    );

  playerVelocity.z =
    THREE.MathUtils.lerp(
      playerVelocity.z,

      direction.z *
      targetSpeed,

      smoothing
    );

  if (
    groundedGraceTimer <=
    0
  ) {
    playerVelocity.y -=
      GRAVITY *
      delta;

    playerVelocity.y =
      Math.max(
        playerVelocity.y,
        -TERMINAL_VELOCITY
      );
  }

  tryConsumeJump();

  const STEPS =
    4;

  const step =
    delta /
    STEPS;

  for (
    let i = 0;
    i < STEPS;
    i++
  ) {
    movementStep
      .copy(
        playerVelocity
      )
      .multiplyScalar(
        step
      );

    playerCollider.translate(
      movementStep
    );

    resolvePlayerCollision();
  }

  if (
    playerCollider.end.y <
    killHeight
  ) {
    const now =
      performance.now();

    if (
      now -
      lastFallDamageTime >
      1200
    ) {
      lastFallDamageTime =
        now;

      loseLife();
    }

    return;
  }

  updateCharacterLocomotion(
    moving,
    running
  );

  syncCharacterToPlayer();

  updateThirdPersonCamera(
    delta
  );
}

// ============================================================
// STAMINA
// ============================================================

function buildStaminaSegments() {
  if (
    !staminaSegments
  ) {
    return;
  }

  staminaSegments.innerHTML =
    '';

  for (
    let i = 0;
    i <
    TOTAL_STAMINA_SEGMENTS;
    i++
  ) {
    const segment =
      document.createElement(
        'div'
      );

    segment.className =
      'breath-segment active';

    staminaSegments.appendChild(
      segment
    );
  }
}

function updateStamina(
  delta,
  moving,
  running
) {
  if (
    moving &&
    running &&
    !isExhausted
  ) {
    stamina -=
      16 *
      delta;

  } else {
    stamina +=
      12 *
      delta;
  }

  stamina =
    THREE.MathUtils.clamp(
      stamina,
      0,
      100
    );

  if (
    stamina <=
    0
  ) {
    isExhausted =
      true;
  }

  if (
    stamina >=
    35
  ) {
    isExhausted =
      false;
  }

  if (
    staminaPercent
  ) {
    staminaPercent.textContent =
      String(
        Math.floor(
          stamina
        )
      );
  }

  if (
    !staminaSegments
  ) {
    return;
  }

  const activeSegments =
    Math.ceil(
      stamina /
      100 *
      TOTAL_STAMINA_SEGMENTS
    );

  [
    ...staminaSegments.children
  ].forEach(
    (
      segment,
      index
    ) => {
      segment.className =
        'breath-segment';

      if (
        index <
        activeSegments
      ) {
        segment.classList.add(
          'active'
        );
      }

      if (
        stamina <
        30
      ) {
        segment.classList.add(
          'warning'
        );
      }
    }
  );
}

// ============================================================
// BATERÍA
// ============================================================

function updateBattery(
  delta
) {
  battery -=
    delta *
    0.00008;

  battery =
    THREE.MathUtils.clamp(
      battery,
      0.12,
      1
    );

  if (
    batteryLevel
  ) {
    batteryLevel.style.width =
      `${battery * 100}%`;
  }
}

// ============================================================
// VIDAS
// ============================================================

function updateLivesHUD() {
  if (
    !livesContainer
  ) {
    return;
  }

  livesContainer.innerHTML =
    '';

  for (
    let i = 0;
    i < MAX_LIVES;
    i++
  ) {
    const life =
      document.createElement(
        'span'
      );

    life.textContent =
      '♥';

    life.className =
      i <
      lives
        ? 'life'
        : 'life lost';

    livesContainer.appendChild(
      life
    );
  }
}

function loseLife() {
  if (
    gameOver ||
    gameWon
  ) {
    return;
  }

  lives--;

  updateLivesHUD();

  damageFlash
    ?.classList
    .add(
      'active'
    );

  setTimeout(
    () => {
      damageFlash
        ?.classList
        .remove(
          'active'
        );
    },
    180
  );

  triggerVHSGlitch(
    0.7
  );

  if (
    lives <=
    0
  ) {
    triggerGameOver();

    return;
  }

  respawnPlayer();
}

// ============================================================
// HUD
// ============================================================

function showHUD(
  visible
) {
  gameHUD.forEach(
    element => {
      element
        .classList
        .toggle(
          'hidden',
          !visible
        );
    }
  );

  const physicsPanel =
    document.getElementById(
      'exam-physics-panel'
    );

  if (
    physicsPanel
  ) {
    physicsPanel.style.display =
      visible
        ? 'block'
        : 'none';
  }
}

// ============================================================
// INICIAR JUEGO
// ============================================================

function startGame() {
  if (
    !mapReady ||
    !characterReady ||
    !entityReady ||
    !rapierReady
  ) {
    console.warn(
      '⏳ Recursos pendientes:',
      {
        mapReady,
        characterReady,
        entityReady,
        rapierReady
      }
    );

    return;
  }

  gameStarted =
    true;

  gamePaused =
    false;

  gameOver =
    false;

  gameWon =
    false;

  lives =
    MAX_LIVES;

  stamina =
    100;

  isExhausted =
    false;

  battery =
    0.82;

  entityCatchActive =
    false;

  resetQuestState();

  resetExamPhysicsObjects();

  respawnPlayer();

  characterRoot.visible =
    true;

  playCharacterAction(
    'idle',
    0,
    true
  );

  updateLivesHUD();

  startScreen
    ?.classList
    .add(
      'hidden'
    );

  pauseScreen
    ?.classList
    .add(
      'hidden'
    );

  optionsScreen
    ?.classList
    .add(
      'hidden'
    );

  gameOverScreen
    ?.classList
    .add(
      'hidden'
    );

  victoryScreen
    .classList
    .add(
      'hidden'
    );

  showHUD(
    true
  );

  showQuestNotification(
    'OBJECTIVE // FIND THE FIRST TAPE',
    3500
  );

  controls.lock();
}

function pauseGame() {
  if (
    !gameStarted ||
    gameOver ||
    gameWon ||
    entityCatchActive
  ) {
    return;
  }

  gamePaused =
    true;

  pauseScreen
    ?.classList
    .remove(
      'hidden'
    );
}

function resumeGame() {
  if (
    gameOver ||
    gameWon
  ) {
    return;
  }

  gamePaused =
    false;

  pauseScreen
    ?.classList
    .add(
      'hidden'
    );

  optionsScreen
    ?.classList
    .add(
      'hidden'
    );

  controls.lock();
}

function triggerGameOver() {
  gameOver =
    true;

  gamePaused =
    true;

  hideEntity();

  playerVelocity.set(
    0,
    0,
    0
  );

  controls.unlock();

  showHUD(
    false
  );

  gameOverScreen
    ?.classList
    .remove(
      'hidden'
    );
}

function finishGame() {
  gameWon =
    true;

  gamePaused =
    true;

  hideEntity();

  playerVelocity.set(
    0,
    0,
    0
  );

  controls.unlock();

  showHUD(
    false
  );

  victoryScreen
    .classList
    .remove(
      'hidden'
    );
}

function returnToMainMenu() {
  gameStarted =
    false;

  gamePaused =
    false;

  gameOver =
    false;

  gameWon =
    false;

  hideEntity();

  playerVelocity.set(
    0,
    0,
    0
  );

  controls.unlock();

  showHUD(
    false
  );

  if (
    characterRoot
  ) {
    characterRoot.visible =
      false;
  }

  pauseScreen
    ?.classList
    .add(
      'hidden'
    );

  optionsScreen
    ?.classList
    .add(
      'hidden'
    );

  gameOverScreen
    ?.classList
    .add(
      'hidden'
    );

  victoryScreen
    .classList
    .add(
      'hidden'
    );

  startScreen
    ?.classList
    .remove(
      'hidden'
    );
}

// ============================================================
// BOTONES
// ============================================================

startButton
  ?.addEventListener(
    'click',
    startGame
  );

resumeButton
  ?.addEventListener(
    'click',
    resumeGame
  );

restartButton
  ?.addEventListener(
    'click',
    startGame
  );

mainMenuButton
  ?.addEventListener(
    'click',
    returnToMainMenu
  );

gameOverRestart
  ?.addEventListener(
    'click',
    startGame
  );

gameOverMenu
  ?.addEventListener(
    'click',
    returnToMainMenu
  );

document
  .getElementById(
    'victory-restart'
  )
  ?.addEventListener(
    'click',
    startGame
  );

document
  .getElementById(
    'victory-menu'
  )
  ?.addEventListener(
    'click',
    returnToMainMenu
  );

optionsButton
  ?.addEventListener(
    'click',
    () => {
      pauseScreen
        ?.classList
        .add(
          'hidden'
        );

      optionsScreen
        ?.classList
        .remove(
          'hidden'
        );
    }
  );

optionsBackButton
  ?.addEventListener(
    'click',
    () => {
      optionsScreen
        ?.classList
        .add(
          'hidden'
        );

      pauseScreen
        ?.classList
        .remove(
          'hidden'
        );
    }
  );

controls.addEventListener(
  'unlock',
  () => {
    if (
      gameStarted &&
      !gameOver &&
      !gameWon &&
      !entityCatchActive
    ) {
      pauseGame();
    }
  }
);

controls.addEventListener(
  'lock',
  () => {
    if (
      gameStarted
    ) {
      gamePaused =
        false;

      pauseScreen
        ?.classList
        .add(
          'hidden'
        );
    }
  }
);

brightnessSlider
  ?.addEventListener(
    'input',
    () => {
      renderer.toneMappingExposure =
        Number(
          brightnessSlider.value
        );

      if (
        brightnessValue
      ) {
        brightnessValue.textContent =
          `${Math.round(
            Number(
              brightnessSlider.value
            ) *
            100
          )}%`;
      }
    }
  );

sensitivitySlider
  ?.addEventListener(
    'input',
    () => {
      if (
        sensitivityValue
      ) {
        sensitivityValue.textContent =
          `${Math.round(
            Number(
              sensitivitySlider.value
            ) *
            100
          )}%`;
      }
    }
  );

vhsToggle
  ?.addEventListener(
    'change',
    () => {
      const enabled =
        vhsToggle.checked;

      retroPass.enabled =
        enabled;

      if (
        vhsOverlay
      ) {
        vhsOverlay.style.display =
          enabled
            ? ''
            : 'none';
      }

      if (
        vhsScanlines
      ) {
        vhsScanlines.style.display =
          enabled
            ? ''
            : 'none';
      }

      if (
        vhsNoise
      ) {
        vhsNoise.style.display =
          enabled
            ? ''
            : 'none';
      }
    }
  );

// ============================================================
// LUCES DEL MAPA
// ============================================================

const dynamicMapLights =
  [];

let lightUpdateTimer =
  0;

function setupMapLighting(
  map
) {
  let count =
    0;

  const keywords = [
    'light',
    'lamp',
    'bulb',
    'neon',
    'farol',
    'luz'
  ];

  map.traverse(
    child => {
      if (
        !child.isMesh ||
        count >=
        MAX_DYNAMIC_MAP_LIGHTS
      ) {
        return;
      }

      const name =
        (
          child.name ||
          ''
        )
          .toLowerCase();

      const isLight =
        keywords.some(
          keyword =>
            name.includes(
              keyword
            )
        );

      if (
        !isLight
      ) {
        return;
      }

      tempBox.setFromObject(
        child
      );

      tempBox.getCenter(
        tempCenter
      );

      const light =
        new THREE.PointLight(
          0xffd8a8,
          12,
          12,
          2
        );

      light.position.copy(
        tempCenter
      );

      scene.add(
        light
      );

      dynamicMapLights.push(
        light
      );

      count++;
    }
  );
}

function updateDynamicLights() {
  const player =
    getPlayerWorldPosition(
      tempPlayerPosition
    );

  dynamicMapLights.forEach(
    light => {
      light.visible =
        light.position
          .distanceTo(
            player
          ) <
        LIGHT_ACTIVE_DISTANCE;
    }
  );
}

// ============================================================
// DEBUG
// ============================================================

function updateDebugPanel() {
  if (
    !debugVisible
  ) {
    return;
  }

  const enemyDistance =
    entityVisible &&
    entity
      ? horizontalEntityDistance()
      : Infinity;

  debugPanel.textContent =
`FPS       ${currentFPS}
LIVES     ${lives}
STAMINA   ${Math.floor(stamina)}
TAPES     ${tapesCollected}/${TOTAL_TAPES}
QUEST     ${questStage}
POWER     ${powerRestored ? 'ON' : 'OFF'}
GROUND    ${playerOnFloor ? 'YES' : 'NO'}
PLAYER    ${characterReady ? 'READY' : 'WAIT'}
ANIM      ${currentCharacterAction || '--'}
ENTITY    ${entityVisible ? (entityChasing ? 'CHASE' : 'STALK') : 'HIDDEN'}
DIST      ${Number.isFinite(enemyDistance) ? enemyDistance.toFixed(1) : '--'}
RAPIER    ${rapierReady ? 'READY' : 'WAIT'}
OBJECTS   ${physicalBodies.length + knockdownBodies.length}
SHOT      ${shotPower}`;
}

// ============================================================
// FPS ADAPTATIVO
// ============================================================

let fpsAccumulator =
  0;

let fpsFrameCount =
  0;

let fpsTimer =
  0;

let currentFPS =
  60;

function updateAdaptiveQuality(
  delta
) {
  fpsAccumulator +=
    delta;

  fpsFrameCount++;

  fpsTimer +=
    delta;

  if (
    fpsTimer <
    1
  ) {
    return;
  }

  currentFPS =
    Math.round(
      fpsFrameCount /
      fpsAccumulator
    );

  fpsAccumulator =
    0;

  fpsFrameCount =
    0;

  fpsTimer =
    0;

  let newRatio =
    currentPixelRatio;

  if (
    currentFPS <
    LOW_FPS_THRESHOLD
  ) {
    newRatio =
      Math.max(
        MIN_PIXEL_RATIO,
        currentPixelRatio -
        0.08
      );
  }

  else if (
    currentFPS >
    HIGH_FPS_THRESHOLD
  ) {
    newRatio =
      Math.min(
        MAX_PIXEL_RATIO,
        currentPixelRatio +
        0.04
      );
  }

  if (
    Math.abs(
      newRatio -
      currentPixelRatio
    ) >
    0.001
  ) {
    currentPixelRatio =
      newRatio;

    renderer.setPixelRatio(
      currentPixelRatio
    );

    composer.setSize(
      window.innerWidth,
      window.innerHeight
    );
  }
}

// ============================================================
// READY
// ============================================================

function checkReady() {
  console.log(
    'ESTADO:',
    {
      mapReady,
      characterReady,
      entityReady,
      rapierReady
    }
  );

  if (
    mapReady &&
    characterReady &&
    entityReady &&
    rapierReady
  ) {
    if (
      loadingStatus
    ) {
      loadingStatus.textContent =
        'SIGNAL READY';
    }

    if (
      startButton
    ) {
      startButton.disabled =
        false;
    }

    console.log(
      '✅ JUEGO COMPLETAMENTE LISTO.'
    );
  }
}

// ============================================================
// CARGAR MAPA
// ============================================================

const mapLoader =
  new GLTFLoader();

mapLoader.load(
  MODEL_PATH,

  async gltf => {
    const map =
      gltf.scene;

    map.name =
      'CITY_ENVIRONMENT';

    scene.add(
      map
    );

    map.updateMatrixWorld(
      true
    );

    cameraCollisionMeshes.length =
      0;

    map.traverse(
      child => {
        if (
          !child.isMesh
        ) {
          return;
        }

        child.castShadow =
          false;

        child.receiveShadow =
          true;

        child.frustumCulled =
          true;

        cameraCollisionMeshes.push(
          child
        );
      }
    );

    const detectedDoors =
      new Set();

    map.traverse(
      child => {
        if (
          !child.isMesh
        ) {
          return;
        }

        const door =
          findDoorRoot(
            child
          );

        if (
          !door ||
          detectedDoors.has(
            door
          )
        ) {
          return;
        }

        detectedDoors.add(
          door
        );

        door.userData = {
          ...door.userData,

          interactType:
            'door',

          isOpen:
            false,

          closedRotation:
            door.rotation.y,

          promptText:
            '[E] ABRIR'
        };

        doors.push(
          door
        );

        interactiveObjects.push(
          door
        );
      }
    );

    buildCollisionOctree(
      map
    );

    findSpawn(
      map
    );

    setupMapLighting(
      map
    );

    setupQuestSystem();

    setupExamPhysics(
      map
    );

    mapReady =
      true;

    console.log(
      '✅ Ciudad cargada.'
    );

    console.log(
      `✅ Puertas detectadas: ${doors.length}`
    );

    checkReady();

    await loadCharacter();

    createEntity();
  },

  progress => {
    if (
      progress.total &&
      loadingStatus
    ) {
      const percentage =
        Math.floor(
          progress.loaded /
          progress.total *
          100
        );

      loadingStatus.textContent =
        `LOADING CITY ${percentage}%`;
    }
  },

  error => {
    console.error(
      '❌ Error cargando ciudad:',
      error
    );

    if (
      loadingStatus
    ) {
      loadingStatus.textContent =
        'CITY ERROR';
    }
  }
);

// ============================================================
// GAME LOOP
// ============================================================

const clock =
  new THREE.Clock();

function animate() {
  requestAnimationFrame(
    animate
  );

  const delta =
    Math.min(
      clock.getDelta(),
      0.04
    );

  const time =
    clock.getElapsedTime();

  // MUY IMPORTANTE:
  // esto actualiza realmente el esqueleto.
  if (
    characterMixer
  ) {
    characterMixer.update(
      delta
    );
  }

  updateGamepad(
    delta
  );

  updateAdaptiveQuality(
    delta
  );

  if (
    vhsEventTimer >
    0
  ) {
    vhsEventTimer =
      Math.max(
        0,
        vhsEventTimer -
        delta
      );
  }

  retroPass
    .uniforms
    .glitchBoost
    .value =
    Math.max(
      Math.min(
        vhsEventTimer,
        1
      ),

      entityGlitchAmount
    );

  retroPass
    .uniforms
    .time
    .value =
    time;

  if (
    gameStarted &&
    !gamePaused &&
    !gameOver &&
    !gameWon &&
    !entityCatchActive
  ) {
    updatePlayer(
      delta
    );

    updateRapierPhysics(
      delta
    );

    updateEntity(
      delta
    );

    interactionTimer +=
      delta;

    if (
      interactionTimer >=
      INTERACTION_INTERVAL
    ) {
      interactionTimer =
        0;

      checkInteractions();
    }

    lightUpdateTimer +=
      delta;

    if (
      lightUpdateTimer >=
      LIGHT_UPDATE_INTERVAL
    ) {
      lightUpdateTimer =
        0;

      updateDynamicLights();
    }

    updateQuestObjects(
      time
    );

    flashlight.position.copy(
      camera.position
    );

    camera.getWorldDirection(
      camDir
    );

    flashlight.target.position
      .copy(
        camera.position
      )
      .addScaledVector(
        camDir,
        10
      );

    flashlight.target
      .updateMatrixWorld();

    flashlight.intensity =
      flashlightOn
        ? 42
        : 0;

    updateBattery(
      delta
    );

  } else {
    updateRapierPhysics(
      delta
    );

    if (
      promptElem
    ) {
      promptElem.style.display =
        'none';
    }
  }

  updateDebugPanel();

  composer.render();
}

// ============================================================
// INICIALIZAR
// ============================================================

if (
  startButton
) {
  startButton.disabled =
    true;
}

buildStaminaSegments();

showHUD(
  false
);

updateLivesHUD();

updateObjectiveHUD();

if (
  flashlightStatus
) {
  flashlightStatus.textContent =
    'LIGHT ●';
}

animate();

// ============================================================
// RESIZE
// ============================================================

window.addEventListener(
  'resize',
  () => {
    camera.aspect =
      window.innerWidth /
      window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
      window.innerWidth,
      window.innerHeight
    );

    composer.setSize(
      window.innerWidth,
      window.innerHeight
    );

    retroPass
      .uniforms
      .resolution
      .value
      .set(
        window.innerWidth,
        window.innerHeight
      );
  }
);