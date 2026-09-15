'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Locale } from '@/i18n/dictionary';

const stages = {
  ar: [
    ['01', 'بناء البرنامج'],
    ['02', 'استقبال الطلبات'],
    ['03', 'المراجعة والقرار'],
    ['04', 'إدارة المستفيدين'],
    ['05', 'تنفيذ الأنشطة'],
    ['06', 'قياس النتائج'],
    ['07', 'التقرير النهائي'],
  ],
  en: [
    ['01', 'Build the program'],
    ['02', 'Receive applications'],
    ['03', 'Review and decide'],
    ['04', 'Manage beneficiaries'],
    ['05', 'Deliver activities'],
    ['06', 'Measure outcomes'],
    ['07', 'Report results'],
  ],
} as const;

// Timing of one full lap: travel to a station, let it come alive, move on; pull back at the end, then start over
const TRAVEL_SECONDS = 1.25;
const DWELL_SECONDS = 2.1;
const HOLD_SECONDS = 3.6;
const RESET_SECONDS = 1.2;

const COLORS = {
  background: 0x0c141c,
  floor: 0x0e171f,
  navy: 0x283543,
  slateDim: 0x34424f,
  ivory: 0xcfc9b9,
  ivoryDim: 0x66737f,
  copper: 0xc16325,
  copperBright: 0xe58a3c,
  copperDim: 0x55463e,
};

type StationMaterials = {
  ring: THREE.MeshPhysicalMaterial;
  primary: THREE.MeshPhysicalMaterial;
  accent: THREE.MeshPhysicalMaterial;
  pulse: THREE.MeshBasicMaterial;
  column: THREE.MeshBasicMaterial;
  badge: THREE.SpriteMaterial;
  title: THREE.SpriteMaterial;
};

type Station = {
  group: THREE.Group;
  sculpture: THREE.Group;
  pulse: THREE.Mesh;
  column: THREE.Mesh;
  materials: StationMaterials;
  base: THREE.Vector3;
  t: number;
  pulseAge: number;
  lit: boolean;
};

type BoxFactory = (width: number, height: number, depth: number) => THREE.BufferGeometry;

const easeInOut = (value: number) => (value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2);

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function spriteFromCanvas(canvas: HTMLCanvasElement, width: number, height: number, opacity: number, anisotropy: number) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(width, height, 1);
  sprite.center.set(0.5, 0);
  return { sprite, material };
}

// A small numbered badge that stays above every station, so the order reads at a glance
function makeBadge(number: string, font: string, anisotropy: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 320;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = 'rgba(12, 19, 26, 0.88)';
    context.beginPath();
    context.arc(160, 160, 144, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(229,138,60,0.95)';
    context.lineWidth = 10;
    context.stroke();
    context.fillStyle = '#f4f1e8';
    context.font = `700 128px ${font}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(number, 160, 168);
  }
  return spriteFromCanvas(canvas, 0.52, 0.52, 0.55, anisotropy);
}

// The stage title, shown only above the station the traveller is visiting
function makeTitle(title: string, font: string, arabic: boolean, anisotropy: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 300;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = 'rgba(193, 99, 37, 0.97)';
    roundedRect(context, 12, 12, canvas.width - 24, canvas.height - 24, 80);
    context.fill();
    context.fillStyle = '#fff8ef';
    context.direction = arabic ? 'rtl' : 'ltr';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = `600 112px ${font}`;
    context.fillText(title, canvas.width / 2, canvas.height / 2 + (arabic ? 10 : 4));
  }
  return spriteFromCanvas(canvas, 2.4, 0.5625, 0, anisotropy);
}

function buildSculpture(index: number, primary: THREE.Material, accent: THREE.Material, box: BoxFactory) {
  const group = new THREE.Group();
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, rotation?: [number, number, number]) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    if (rotation) mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  switch (index) {
    case 0: {
      // Build the program: stacked layers with a copper core and corner pins
      add(box(0.92, 0.14, 0.92), primary, 0, 0.07, 0);
      add(box(0.72, 0.14, 0.72), primary, 0.04, 0.23, -0.03);
      add(box(0.52, 0.14, 0.52), primary, -0.03, 0.39, 0.03);
      add(new THREE.CylinderGeometry(0.09, 0.09, 0.44, 32), accent, 0, 0.68, 0);
      add(new THREE.SphereGeometry(0.1, 32, 24), accent, 0, 0.92, 0);
      for (const [x, z] of [[0.36, 0.36], [-0.36, 0.36], [0.36, -0.36], [-0.36, -0.36]]) {
        add(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 16), accent, x, 0.18, z);
      }
      break;
    }
    case 1: {
      // Receive applications: a tray with cards fanned as they arrive
      add(box(1.0, 0.09, 0.72), primary, 0, 0.045, 0);
      add(box(1.0, 0.24, 0.06), primary, 0, 0.19, -0.33);
      for (let i = 0; i < 4; i += 1) {
        const x = -0.24 + i * 0.16;
        const z = -0.14 + i * 0.1;
        add(box(0.46, 0.6, 0.025), primary, x, 0.39 + i * 0.02, z, [0.2, 0, 0]);
        add(box(0.3, 0.035, 0.012), accent, x, 0.58 + i * 0.02, z + 0.06, [0.2, 0, 0]);
      }
      break;
    }
    case 2: {
      // Review and decide: a balance, one pan holding the approved outcome
      add(new THREE.CylinderGeometry(0.2, 0.24, 0.05, 40), primary, 0, 0.025, 0);
      add(new THREE.CylinderGeometry(0.05, 0.07, 0.64, 24), primary, 0, 0.36, 0);
      add(box(1.04, 0.05, 0.07), primary, 0, 0.68, 0, [0, 0, 0.1]);
      add(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), primary, 0.46, 0.58, 0);
      add(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), primary, -0.46, 0.66, 0);
      add(new THREE.CylinderGeometry(0.19, 0.16, 0.035, 40), primary, 0.46, 0.46, 0);
      add(new THREE.CylinderGeometry(0.19, 0.16, 0.035, 40), primary, -0.46, 0.54, 0);
      add(new THREE.SphereGeometry(0.11, 32, 24), accent, 0.46, 0.59, 0);
      add(box(0.12, 0.12, 0.12), primary, -0.46, 0.62, 0);
      break;
    }
    case 3: {
      // Manage beneficiaries: people gathered around one shared record
      add(new THREE.CylinderGeometry(0.24, 0.26, 0.05, 48), accent, 0, 0.025, 0);
      add(new THREE.TorusGeometry(0.5, 0.014, 12, 96), accent, 0, 0.03, 0, [Math.PI / 2, 0, 0]);
      add(new THREE.CylinderGeometry(0.055, 0.055, 0.5, 24), accent, 0, 0.3, 0);
      add(new THREE.SphereGeometry(0.08, 32, 24), accent, 0, 0.58, 0);
      for (let i = 0; i < 5; i += 1) {
        const angle = (i / 5) * Math.PI * 2 + 0.3;
        const x = Math.cos(angle) * 0.48;
        const z = Math.sin(angle) * 0.48;
        add(new THREE.CapsuleGeometry(0.085, 0.2, 8, 24), primary, x, 0.24, z);
        add(new THREE.SphereGeometry(0.08, 32, 24), primary, x, 0.5, z);
      }
      break;
    }
    case 4: {
      // Deliver activities: a schedule board with attendance marks and legs
      add(box(1.06, 0.74, 0.05), accent, 0, 0.44, -0.11, [-0.12, 0, 0]);
      add(box(1.0, 0.68, 0.06), primary, 0, 0.44, -0.1, [-0.12, 0, 0]);
      for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 4; col += 1) {
          const done = row === 0 || (row === 1 && col < 3) || (row === 2 && col < 1);
          add(box(0.15, 0.13, 0.04), done ? accent : primary, -0.36 + col * 0.24, 0.66 - row * 0.2, -0.05 + (done ? 0.02 : 0), [-0.12, 0, 0]);
        }
      }
      add(box(0.14, 0.12, 0.34), primary, -0.38, 0.06, 0.03);
      add(box(0.14, 0.12, 0.34), primary, 0.38, 0.06, 0.03);
      break;
    }
    case 5: {
      // Measure outcomes: baseline bars beside endline bars on one plate
      add(box(1.1, 0.05, 0.5), primary, 0, 0.025, 0);
      const pairs = [[0.26, 0.5], [0.34, 0.76], [0.3, 0.6], [0.4, 0.98]];
      pairs.forEach(([baseline, endline], i) => {
        const x = -0.4 + i * 0.27;
        add(box(0.1, baseline, 0.14), primary, x - 0.06, 0.05 + baseline / 2, 0);
        add(box(0.1, endline, 0.14), accent, x + 0.06, 0.05 + endline / 2, 0);
      });
      break;
    }
    default: {
      // Report results: a document with pages behind it, a copper seal and a halo
      add(box(0.7, 0.9, 0.03), primary, 0.05, 0.47, -0.06, [-0.08, 0, 0]);
      add(box(0.72, 0.92, 0.04), primary, 0, 0.5, 0, [-0.08, 0, 0]);
      add(box(0.46, 0.045, 0.015), accent, 0, 0.82, 0.03, [-0.08, 0, 0]);
      add(box(0.46, 0.035, 0.015), accent, 0, 0.7, 0.03, [-0.08, 0, 0]);
      add(box(0.3, 0.035, 0.015), accent, -0.08, 0.59, 0.03, [-0.08, 0, 0]);
      add(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 48), accent, 0.18, 0.28, 0.05, [Math.PI / 2 - 0.08, 0, 0]);
      add(new THREE.TorusGeometry(0.55, 0.018, 16, 96), accent, 0, 1.16, 0, [Math.PI / 2, 0, 0]);
      break;
    }
  }
  return group;
}

/**
 * The hero scene: one application file travels a rising rail through the seven
 * stages of a program, each station lighting up as it is reached, then the
 * camera pulls back to show the whole path before the lap starts again.
 */
export function PlatformJourney3D({ locale }: { locale: Locale }) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const arabic = locale === 'ar';

  useEffect(() => {
    const currentHost = host.current;
    if (!currentHost) return;
    const element: HTMLDivElement = currentHost;
    let disposed = false;
    let frame = 0;
    let renderer: THREE.WebGLRenderer | undefined;
    let cleanup: (() => void) | undefined;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 120);
    const clock = new THREE.Clock();
    const mouse = new THREE.Vector2();
    const direction = arabic ? -1 : 1;
    const labels = stages[locale];

    async function start() {
      try {
        const [{ RoomEnvironment }, { EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }, { RoundedBoxGeometry }] = await Promise.all([
          import('three/examples/jsm/environments/RoomEnvironment.js'),
          import('three/examples/jsm/postprocessing/EffectComposer.js'),
          import('three/examples/jsm/postprocessing/RenderPass.js'),
          import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
          import('three/examples/jsm/postprocessing/OutputPass.js'),
          import('three/examples/jsm/geometries/RoundedBoxGeometry.js'),
        ]);
        // Labels are drawn with the page font, so wait for it before painting them
        const font = getComputedStyle(document.body).fontFamily || 'Arial, sans-serif';
        try { await document.fonts.load(`600 40px ${font}`); } catch { /* the fallback font is fine */ }
        if (disposed) return;

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
        const pixelRatio = Math.min(devicePixelRatio || 1, 2);
        renderer.setPixelRatio(pixelRatio);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        element.appendChild(renderer.domElement);
        const anisotropy = renderer.capabilities.getMaxAnisotropy();
        const box: BoxFactory = (width, height, depth) => new RoundedBoxGeometry(width, height, depth, 4, Math.min(0.035, Math.min(width, height, depth) * 0.3));

        scene.background = new THREE.Color(COLORS.background);
        scene.fog = new THREE.Fog(COLORS.background, 18, 44);
        const environment = new RoomEnvironment();
        const pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(environment, 0.04).texture;
        scene.environmentIntensity = 0.55;
        environment.dispose();
        pmrem.dispose();
        scene.add(new THREE.HemisphereLight(0xdde6f5, 0x0f161d, 0.8));
        const key = new THREE.DirectionalLight(0xffe2c4, 2.0);
        key.position.set(6, 12, 7);
        key.castShadow = true;
        key.shadow.mapSize.set(4096, 4096);
        key.shadow.camera.near = 2;
        key.shadow.camera.far = 40;
        key.shadow.camera.left = -11;
        key.shadow.camera.right = 11;
        key.shadow.camera.top = 11;
        key.shadow.camera.bottom = -11;
        key.shadow.bias = -0.0006;
        key.shadow.normalBias = 0.02;
        key.shadow.radius = 6;
        scene.add(key);
        const fill = new THREE.DirectionalLight(0x8fa8cc, 0.8);
        fill.position.set(-8, 5, -5);
        scene.add(fill);
        const rim = new THREE.DirectionalLight(0xe58a3c, 0.35);
        rim.position.set(direction * -4, 3, -9);
        scene.add(rim);

        // A dark matte floor that holds the shadows without throwing a highlight back at the camera
        const floor = new THREE.Mesh(new THREE.CircleGeometry(48, 96), new THREE.MeshStandardMaterial({ color: COLORS.floor, roughness: 0.82, metalness: 0.25, envMapIntensity: 0.08 }));
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.3;
        floor.receiveShadow = true;
        scene.add(floor);

        // The world: a rising path with one station per stage, spaced so no two discs touch on screen
        const world = new THREE.Group();
        world.rotation.y = direction * -0.12;
        scene.add(world);

        const count = labels.length;
        const anchors = labels.map((_, i) => {
          const u = i / (count - 1);
          // Starts close to the viewer and climbs away, so the end of the journey sits higher than its start
          return new THREE.Vector3(direction * (-4.5 + u * 9.0), i * 0.14, 1.3 - u * 2.6 + Math.sin(u * Math.PI * 2) * 0.45);
        });
        const curve = new THREE.CatmullRomCurve3(anchors, false, 'centripetal', 0.6);
        const tubular = 280;
        const radial = 16;
        const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, tubular, 0.045, radial, false), new THREE.MeshPhysicalMaterial({ color: COLORS.slateDim, roughness: 0.45, metalness: 0.6, clearcoat: 0.3 }));
        rail.castShadow = true;
        rail.receiveShadow = true;
        world.add(rail);
        const progressMaterial = new THREE.MeshPhysicalMaterial({ color: COLORS.copper, emissive: COLORS.copper, emissiveIntensity: 0.9, roughness: 0.28, metalness: 0.85, clearcoat: 0.5 });
        const progress = new THREE.Mesh(new THREE.TubeGeometry(curve, tubular, 0.064, radial, false), progressMaterial);
        progress.geometry.setDrawRange(0, 0);
        world.add(progress);

        // Find the arc length parameter of each anchor so stations sit on the rail
        const samples = curve.getSpacedPoints(900);
        const stationT = anchors.map((anchor) => {
          let best = 0;
          let bestDistance = Infinity;
          samples.forEach((point, i) => {
            const d = point.distanceToSquared(anchor);
            if (d < bestDistance) { bestDistance = d; best = i; }
          });
          return best / 900;
        });

        const stations: Station[] = anchors.map((anchor, i) => {
          const group = new THREE.Group();
          group.position.copy(anchor);
          const ring = new THREE.MeshPhysicalMaterial({ color: COLORS.slateDim, emissive: COLORS.copper, emissiveIntensity: 0, roughness: 0.28, metalness: 0.85, clearcoat: 0.5, clearcoatRoughness: 0.2 });
          const primary = new THREE.MeshPhysicalMaterial({ color: COLORS.ivoryDim, roughness: 0.48, metalness: 0.02, clearcoat: 0.12, clearcoatRoughness: 0.4 });
          const accent = new THREE.MeshPhysicalMaterial({ color: COLORS.copperDim, emissive: COLORS.copper, emissiveIntensity: 0, roughness: 0.24, metalness: 0.9, clearcoat: 0.6, clearcoatRoughness: 0.15 });
          const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.54, 0.14, 72), new THREE.MeshPhysicalMaterial({ color: COLORS.navy, roughness: 0.3, metalness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.2 }));
          disc.position.y = 0.07;
          disc.castShadow = true;
          disc.receiveShadow = true;
          group.add(disc);
          const halo = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.026, 16, 128), ring);
          halo.rotation.x = Math.PI / 2;
          halo.position.y = 0.14;
          group.add(halo);
          // A shock ring and a light column that fire the moment the traveller arrives
          const pulseMaterial = new THREE.MeshBasicMaterial({ color: COLORS.copperBright, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
          const pulse = new THREE.Mesh(new THREE.RingGeometry(0.58, 0.7, 96), pulseMaterial);
          pulse.rotation.x = -Math.PI / 2;
          pulse.position.y = 0.16;
          group.add(pulse);
          const columnMaterial = new THREE.MeshBasicMaterial({ color: COLORS.copperBright, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
          const column = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.56, 1, 48, 1, true), columnMaterial);
          column.position.y = 0.5;
          group.add(column);
          const sculpture = buildSculpture(i, primary, accent, box);
          sculpture.position.y = 0.14;
          sculpture.rotation.y = -world.rotation.y;
          sculpture.scale.setScalar(0.92);
          group.add(sculpture);
          const badge = makeBadge(labels[i][0], font, anisotropy);
          badge.sprite.position.y = 1.3;
          group.add(badge.sprite);
          const title = makeTitle(labels[i][1], font, arabic, anisotropy);
          title.sprite.position.y = 1.92;
          group.add(title.sprite);
          world.add(group);
          return {
            group, sculpture, pulse, column,
            materials: { ring, primary, accent, pulse: pulseMaterial, column: columnMaterial, badge: badge.material, title: title.material },
            base: anchor.clone(), t: stationT[i], pulseAge: 10, lit: false,
          };
        });

        // The traveller: one application file carried from the first stage to the last
        const traveller = new THREE.Group();
        const fileMaterial = new THREE.MeshPhysicalMaterial({ color: COLORS.ivory, emissive: COLORS.copperBright, emissiveIntensity: 0.3, roughness: 0.3, metalness: 0.1, clearcoat: 0.5, transparent: true });
        const file = new THREE.Mesh(box(0.34, 0.46, 0.07), fileMaterial);
        file.castShadow = true;
        traveller.add(file);
        const stripeMaterial = new THREE.MeshStandardMaterial({ color: COLORS.copperBright, emissive: COLORS.copperBright, emissiveIntensity: 2.2, transparent: true });
        const stripe = new THREE.Mesh(box(0.22, 0.06, 0.02), stripeMaterial);
        stripe.position.set(0, 0.12, 0.045);
        traveller.add(stripe);
        const glowMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.0, 0.42), transparent: true, opacity: 0.9 });
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 24), glowMaterial);
        glow.position.y = -0.36;
        traveller.add(glow);
        const lamp = new THREE.PointLight(COLORS.copperBright, 3.5, 4, 2);
        lamp.position.y = 0.1;
        traveller.add(lamp);
        world.add(traveller);

        // A comet trail of sparks behind the traveller
        const trailCount = 150;
        const trailPhase = Float32Array.from({ length: trailCount }, () => Math.random());
        const trailJitter = Float32Array.from({ length: trailCount * 2 }, () => (Math.random() - 0.5));
        const trailGeometry = new THREE.BufferGeometry();
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(trailCount * 3), 3));
        const trailMaterial = new THREE.PointsMaterial({ color: new THREE.Color(1.6, 0.95, 0.4), size: 0.07, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
        const trail = new THREE.Points(trailGeometry, trailMaterial);
        world.add(trail);

        // Slow drifting dust for depth
        const dustCount = 300;
        const dustPositions = new Float32Array(dustCount * 3);
        for (let i = 0; i < dustCount; i += 1) {
          dustPositions[i * 3] = (Math.random() - 0.5) * 20;
          dustPositions[i * 3 + 1] = Math.random() * 4.5 - 0.2;
          dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 10;
        }
        const dustGeometry = new THREE.BufferGeometry();
        const dustAttribute = new THREE.BufferAttribute(dustPositions, 3);
        dustGeometry.setAttribute('position', dustAttribute);
        const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: 0x9db3cc, size: 0.04, transparent: true, opacity: 0.32, depthWrite: false }));
        world.add(dust);

        // Bloom makes the copper glow read from across a room; the multisampled target keeps edges smooth
        const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
        const composer = new EffectComposer(renderer, target);
        composer.addPass(new RenderPass(scene, camera));
        composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.3, 0.3, 1.45));
        composer.addPass(new OutputPass());

        const centre = new THREE.Box3().setFromPoints(anchors).getCenter(new THREE.Vector3());
        const centreWorld = world.localToWorld(centre.clone());
        const baseDirection = new THREE.Vector3(direction * 0.14, 0.62, 0.78).normalize();
        const viewDirection = baseDirection.clone();
        const lookTarget = centreWorld.clone().add(new THREE.Vector3(0, 0.35, 0));
        const desiredTarget = new THREE.Vector3();
        const travellerWorld = new THREE.Vector3();
        const pathPoint = new THREE.Vector3();
        const tangent = new THREE.Vector3();
        const targetColour = new THREE.Color();
        const yAxis = new THREE.Vector3(0, 1, 0);
        let fitDistance = 18;
        let viewDistance = 18;
        camera.position.copy(lookTarget).add(baseDirection.clone().multiplyScalar(fitDistance));
        camera.lookAt(lookTarget);
        setReady(true);

        const resize = () => {
          if (!renderer) return;
          const width = Math.max(1, element.clientWidth);
          const height = Math.max(1, element.clientHeight);
          renderer.setSize(width, height, false);
          composer.setSize(width, height);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          // The distance at which the whole path, first station to last, fits the frame in both directions.
          // On a narrow screen the overview may crop the outer stations a little; a readable scene matters more there.
          const narrow = camera.aspect < 1;
          const halfVertical = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
          const halfHorizontal = halfVertical * camera.aspect;
          const byWidth = ((narrow ? 4.6 : 5.5) / halfHorizontal) * 1.04;
          const byHeight = (3.2 / halfVertical) * 1.04;
          fitDistance = THREE.MathUtils.clamp(Math.max(byWidth, byHeight), 12, 34);
        };
        const observer = new ResizeObserver(resize);
        observer.observe(element);
        resize();
        const move = (event: PointerEvent) => {
          const rect = element.getBoundingClientRect();
          mouse.set(((event.clientX - rect.left) / rect.width) * 2 - 1, ((event.clientY - rect.top) / rect.height) * 2 - 1);
        };
        const leave = () => mouse.set(0, 0);
        element.addEventListener('pointermove', move, { passive: true });
        element.addEventListener('pointerleave', leave);

        // Journey state
        let elapsed = 0;
        let phase: 'travel' | 'hold' | 'reset' = 'travel';
        let phaseStart = 0;
        let activeIndex = 0;
        let travelFrom = 0;
        let travelStart = 0;
        let travelT = 0;
        let arrivedAt = -1;
        let travellerOpacity = 1;

        const beginTravel = (from: number) => {
          travelFrom = from;
          travelStart = elapsed;
          arrivedAt = -1;
        };
        beginTravel(0);

        const render = () => {
          if (disposed || !renderer) return;
          frame = requestAnimationFrame(render);
          const delta = Math.min(clock.getDelta(), 0.05);
          elapsed += delta;

          const travelProgress = THREE.MathUtils.clamp((elapsed - travelStart) / TRAVEL_SECONDS, 0, 1);
          travelT = travelFrom + (stations[activeIndex].t - travelFrom) * easeInOut(travelProgress);
          const arrived = travelProgress >= 1;
          if (arrived && arrivedAt < 0) arrivedAt = elapsed;

          // Progression through the loop
          if (phase === 'travel' && arrived && elapsed - arrivedAt > DWELL_SECONDS) {
            if (activeIndex < count - 1) {
              activeIndex += 1;
              beginTravel(travelT);
            } else {
              phase = 'hold';
              phaseStart = elapsed;
            }
          } else if (phase === 'hold' && elapsed - phaseStart > HOLD_SECONDS) {
            phase = 'reset';
            phaseStart = elapsed;
          } else if (phase === 'reset') {
            const age = elapsed - phaseStart;
            if (age > RESET_SECONDS * 0.5 && activeIndex !== 0) {
              activeIndex = 0;
              travelT = 0;
              beginTravel(0);
              stations.forEach((station) => { station.lit = false; });
            }
            if (age > RESET_SECONDS) {
              phase = 'travel';
              phaseStart = elapsed;
            }
          }

          // Traveller: glides along the rail with a small hop between stations
          const hop = Math.sin(travelProgress * Math.PI) * 0.4;
          curve.getPointAt(THREE.MathUtils.clamp(travelT, 0, 1), pathPoint);
          curve.getTangentAt(THREE.MathUtils.clamp(travelT, 0, 1), tangent);
          traveller.position.copy(pathPoint);
          traveller.position.y += 0.82 + hop + Math.sin(elapsed * 2.4) * 0.04;
          traveller.rotation.y = Math.atan2(tangent.x, tangent.z) + Math.PI / 2;
          traveller.rotation.z = (arrived ? 0 : direction * -0.18) + Math.sin(elapsed * 1.7) * 0.03;
          const fade = phase === 'reset' ? 0 : 1;
          travellerOpacity += (fade - travellerOpacity) * (1 - Math.exp(-delta * 6));
          fileMaterial.opacity = travellerOpacity;
          stripeMaterial.opacity = travellerOpacity;
          glowMaterial.opacity = 0.9 * travellerOpacity;
          trailMaterial.opacity = 0.8 * travellerOpacity;
          lamp.intensity = 3.5 * travellerOpacity;
          glow.scale.setScalar(1 + Math.sin(elapsed * 5) * 0.15);
          const segments = Math.max(0, Math.min(tubular, Math.round(travelT * tubular)));
          progress.geometry.setDrawRange(0, segments * radial * 6);

          // Sparks trail behind the traveller and gather around it while it rests
          const trailPositions = trailGeometry.getAttribute('position') as THREE.BufferAttribute;
          for (let i = 0; i < trailCount; i += 1) {
            trailPhase[i] += delta * 0.9;
            if (trailPhase[i] > 1) trailPhase[i] -= 1;
            const back = trailPhase[i] * (arrived ? 0.012 : 0.07);
            curve.getPointAt(THREE.MathUtils.clamp(travelT - back, 0, 1), pathPoint);
            const spread = arrived ? 0.32 : 0.14;
            trailPositions.setXYZ(
              i,
              pathPoint.x + trailJitter[i * 2] * spread,
              pathPoint.y + 0.5 + hop * (1 - trailPhase[i]) + (1 - trailPhase[i]) * 0.3 + trailJitter[i * 2 + 1] * spread,
              pathPoint.z + trailJitter[i * 2 + 1] * spread,
            );
          }
          trailPositions.needsUpdate = true;

          // Dust drifts upward slowly
          for (let i = 0; i < dustCount; i += 1) {
            let y = dustAttribute.getY(i) + delta * 0.09;
            if (y > 4.3) y = -0.2;
            dustAttribute.setY(i, y);
          }
          dustAttribute.needsUpdate = true;

          // Stations light up as the traveller reaches them and fire a pulse on arrival
          stations.forEach((station, i) => {
            const reached = phase !== 'reset' && (i < activeIndex || (i === activeIndex && arrived));
            const isActive = i === activeIndex && reached;
            if (reached && !station.lit) {
              station.lit = true;
              station.pulseAge = 0;
            }
            if (!reached) station.lit = false;
            station.pulseAge += delta;
            const ease = 1 - Math.exp(-delta * 4.5);
            const { ring, primary, accent, pulse, column, badge, title } = station.materials;
            targetColour.setHex(reached ? COLORS.copper : COLORS.slateDim);
            ring.color.lerp(targetColour, ease);
            const ringGlow = isActive ? 1.5 + Math.sin(elapsed * 4) * 0.4 : reached ? 0.7 : 0;
            ring.emissiveIntensity += (ringGlow - ring.emissiveIntensity) * ease;
            targetColour.setHex(reached ? COLORS.ivory : COLORS.ivoryDim);
            primary.color.lerp(targetColour, ease);
            targetColour.setHex(reached ? COLORS.copper : COLORS.copperDim);
            accent.color.lerp(targetColour, ease);
            accent.emissiveIntensity += ((isActive ? 0.9 : reached ? 0.3 : 0) - accent.emissiveIntensity) * ease;
            badge.opacity += ((reached ? 1 : 0.5) - badge.opacity) * ease;
            title.opacity += ((isActive ? 1 : 0) - title.opacity) * ease * 1.6;

            // Arrival pulse: an expanding ring and a rising column of light
            const age = station.pulseAge;
            if (age < 1.4) {
              const p = age / 1.4;
              pulse.opacity = (1 - p) * 0.6;
              station.pulse.scale.setScalar(1 + p * 1.6);
              column.opacity = Math.sin(Math.min(1, p * 1.25) * Math.PI) * 0.22;
              station.column.scale.y = 0.4 + p * 3.6;
              station.column.position.y = station.column.scale.y / 2 + 0.14;
            } else {
              pulse.opacity = 0;
              column.opacity = 0;
            }

            // The active sculpture rises, pops in with a small bounce and slowly turns
            const lift = isActive ? 0.24 : 0;
            station.group.position.y += (station.base.y + lift - station.group.position.y) * ease;
            const bounce = age < 1.6 ? Math.exp(-age * 3.2) * Math.sin(age * 9) * 0.22 : 0;
            const targetScale = 0.92 * (isActive ? 1.12 : 1) * (reached ? 1 + bounce : 1);
            station.sculpture.scale.setScalar(station.sculpture.scale.x + (targetScale - station.sculpture.scale.x) * Math.min(1, ease * 2));
            if (isActive) station.sculpture.rotation.y += delta * 0.4;
          });

          // Camera: rides alongside the traveller, then pulls back to reveal the whole path at the end.
          // A lower aim point lifts the scene toward the middle of the canvas.
          traveller.getWorldPosition(travellerWorld);
          const overview = phase !== 'travel';
          if (overview) {
            desiredTarget.copy(centreWorld);
            desiredTarget.y += 0.35;
          } else {
            desiredTarget.copy(centreWorld).lerp(travellerWorld, 0.45);
            desiredTarget.y = centreWorld.y + 0.3 + (travellerWorld.y - centreWorld.y) * 0.3;
          }
          lookTarget.lerp(desiredTarget, 1 - Math.exp(-delta * 2.2));
          const wantedDistance = overview ? fitDistance : fitDistance * 0.86;
          viewDistance += (wantedDistance - viewDistance) * (1 - Math.exp(-delta * 1.6));
          const drift = Math.sin(elapsed * 0.14) * 0.1 + mouse.x * 0.1;
          viewDirection.copy(baseDirection).applyAxisAngle(yAxis, drift);
          viewDirection.y += -mouse.y * 0.06 + Math.sin(elapsed * 0.1) * 0.02;
          viewDirection.normalize();
          camera.position.copy(lookTarget).addScaledVector(viewDirection, viewDistance);
          camera.lookAt(lookTarget);
          composer.render();
        };
        render();
        cleanup = () => {
          observer.disconnect();
          element.removeEventListener('pointermove', move);
          element.removeEventListener('pointerleave', leave);
          composer.dispose();
          target.dispose();
        };
      } catch (error) {
        console.error('programos_scene', error);
        setFailed(true);
      }
    }

    void start();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cleanup?.();
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Sprite || object instanceof THREE.Points) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            if ('map' in material && material.map instanceof THREE.Texture) material.map.dispose();
            material.dispose();
          });
        }
      });
    };
  }, [locale, arabic]);

  return (
    <div className="real3d" role="img" aria-label={arabic ? 'رحلة برنامج داخل المنصة من الإعداد إلى التقرير النهائي' : 'A program journey inside the platform, from setup to the final report'}>
      <div ref={host} className="real3d-canvas">
        {!ready && !failed ? <div className="real3d-loader"><span />{arabic ? 'نجهز المشهد' : 'Preparing the experience'}</div> : null}
        {failed ? <div className="real3d-loader">{arabic ? 'تعذر تشغيل العرض ثلاثي الأبعاد على هذا الجهاز' : '3D view is unavailable on this device'}</div> : null}
        <div className="real3d-fade" />
      </div>
    </div>
  );
}
