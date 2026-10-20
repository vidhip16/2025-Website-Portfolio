// Dot-stage shaders (blueprint §5.2, §5.3), GLSL ES 3.00 for WebGL2. components/dots/gl.ts compiles
// them exactly as written: each source carries its own #version line (it must be the first line)
// and precision.
//
// Every point j reads its target in shape s from one RGBA32F texture (lib/dots/types.ts): texel
// s·n + j = (x, y, z, colour index) in centred box space. uRects[s] places shape s on screen
// (CSS px, y down; uProjection is the camera (0, vw, 0, vh, −1000, 1000)). Everything else is
// stateless per frame: the CPU only moves uniforms.
//
// Output is premultiplied (blend One, OneMinusSrcAlpha). Writing alpha a gives normal blending;
// writing alpha 0 with the same colour gives additive. uNight slides body dots from one to the
// other, so "normal on paper → additive in the room" has no pop. Pupils always blend normally,
// so they stay readable on paper and on night.

/** Texture width (lib/dots/types.ts TEX_WIDTH); the shader indexes with a shift. */
export const SHADER_TEX_WIDTH = 1024;

export const vertexShader = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

#define TEXW_SHIFT 10
#define TEXW_MASK 1023
#define DEPTH_PX 44.0
#define PI 3.14159265
#define PUPILS_PER_EYE 120
#define RING_FROM 73
#define PUPIL_SIZE 1.8
// Additive light per dot on night: icons are packed into thin masks (12k points), so each dot
// adds less or they burn out to white; Ping's sampled colours are sparser.
#define GAIN_PING 0.9
#define GAIN_ICON 0.55

// CSS px (y down) → clip space: gl.ts cssCamera(vw, vh). The view and model transforms are the
// identity (camera at the origin, points untransformed), so this is the whole transform.
uniform mat4 uProjection;

uniform sampler2D uTargets;   // RGBA32F: x, y, z (centred box space) + colour index
uniform sampler2D uRanks;     // R32F: density rank 0..1 (glow ramp)
uniform sampler2D uPing;      // the Ping still: Ping shapes take its colour (sampledRGB)
uniform int uN;               // points per shape
uniform int uPupilStart;      // n − 240
uniform vec4 uRects[6];       // per shape: centre x, centre y, width, height (CSS px)
uniform float uScales[6];     // per shape scale baked into x/y (ping-seat .6)
uniform float uShape;         // 0..5, fractional while morphing
uniform float uDisperse;      // curl-noise amount
uniform float uTime;          // seconds
uniform float uShimmer;       // idle shimmer, px
uniform vec2 uMouse;          // cursor, CSS px
uniform float uHoleR;         // cursor hole radius, px (0 = closed)
uniform vec4 uRipple;         // touch ripple: x, y, radius, amplitude (px)
uniform vec2 uPupil;          // pupil offset in shapes 1..5, px
uniform vec2 uPupil0;         // pupil offset in shape 0 (the still's own travel), px
uniform float uSize;          // dot size, CSS px
uniform float uCover;         // hand-off size for shape 0, CSS px
uniform float uDpr;
uniform float uOpacity;
uniform float uGlow;
uniform float uNight;         // 0 paper .. 1 night (colours and additive blending)
uniform float uStreamT;       // seconds since contact:success (< 0: off)
uniform float uReformT;       // seconds since the reform began (>= 50: formed)
uniform vec2 uView;           // viewport, CSS px
uniform vec3 uBody[2];        // icon body colour: paper, night
uniform vec3 uHigh[2];        // icon rim highlight: paper, night
uniform vec3 uEye[2];         // pupil core: paper (ink), night (glow)
uniform vec3 uRamp[3];        // glow ramp: lilac, bubblegum, glow

in vec3 position;             // x: point index j, y and z: per-point randoms in [0, 1)

out vec3 vColor;
out float vAlpha;
out float vPupil;

ivec2 texelOf(int i) { return ivec2(i & TEXW_MASK, i >> TEXW_SHIFT); }

float cubicInOut(float t) {
  return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) * 0.5;
}

// Value noise (hash without sine) and its 2D curl, by central differences.
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), u.x),
        mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),
    mix(mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), u.x),
        mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), u.x), u.y),
    u.z);
}
vec2 curl(vec3 q) {
  const float e = 0.08;
  float a = vnoise(q + vec3(0.0, e, 0.0)) - vnoise(q - vec3(0.0, e, 0.0));
  float b = vnoise(q + vec3(e, 0.0, 0.0)) - vnoise(q - vec3(e, 0.0, 0.0));
  return vec2(a, -b) / (2.0 * e);
}

// Pupils must read on paper and on night. Ping's sit inside her own white eye domes, so they stay
// ink. The icons have no domes: an ink core on paper that turns to glow on night, inside a ring of
// the body colour that frames it either way.
vec3 colourOf(int s, vec4 t, bool pupil, bool ring) {
  vec3 body = mix(uBody[0], uBody[1], uNight);
  if (pupil) return s <= 1 ? uEye[0] : ring ? body : mix(uEye[0], uEye[1], uNight);
  if (s <= 1) return textureLod(uPing, t.xy / uScales[s] + 0.5, 0.0).rgb;
  return t.w > 0.5 ? mix(uHigh[0], uHigh[1], uNight) : body;
}

float gainOf(int s) { return s <= 1 ? GAIN_PING : GAIN_ICON; }

void main() {
  int j = int(position.x + 0.5);
  float rnd = position.y;
  float rnd2 = position.z;

  float sh = clamp(uShape, 0.0, 5.0);
  int s0 = min(int(floor(sh)), 5);
  int s1 = min(s0 + 1, 5);
  float f = s0 == 5 ? 0.0 : sh - float(s0);

  vec4 t0 = texelFetch(uTargets, texelOf(s0 * uN + j), 0);
  vec4 t1 = texelFetch(uTargets, texelOf(s1 * uN + j), 0);
  bool pupil = j >= uPupilStart;
  bool ring = pupil && (j - uPupilStart) % PUPILS_PER_EYE >= RING_FROM;

  // Per-particle progress. Out of shape 0 the delay follows height, so the ears go first.
  float delay = s0 == 0 ? clamp(t0.y / uScales[0] + 0.5, 0.0, 1.0) : rnd;
  float k = cubicInOut(smoothstep(delay * 0.35, delay * 0.35 + 0.65, f));

  vec2 p0 = uRects[s0].xy + t0.xy * uRects[s0].zw;
  vec2 p1 = uRects[s1].xy + t1.xy * uRects[s1].zw;
  if (pupil) {
    p0 += s0 == 0 ? uPupil0 : uPupil;
    p1 += uPupil;
  }
  vec2 p = mix(p0, p1, k);
  float z = mix(t0.z, t1.z, k) * DEPTH_PX;

  // Curl noise, only mid-morph (sin(πk) is 0 at either end).
  float swirl = uDisperse * sin(PI * k);
  if (swirl > 0.001) p += curl(vec3(p / 150.0, z * 0.02 + uTime * 0.18)) * 1.4 * 24.0 * swirl;

  // Idle shimmer.
  p += uShimmer * vec2(sin(uTime * 2.3 + rnd * 61.0), cos(uTime * 1.9 + rnd2 * 47.0));

  float alpha = uOpacity;

  // Contact success: the envelope streams right (delay 0–.4 s, 900 ms ease-in)…
  if (uStreamT >= 0.0) {
    float u = clamp((uStreamT - rnd * 0.4) / 0.9, 0.0, 1.0);
    p.x += u * u * u * uView.x * 1.15;
    alpha *= 1.0 - smoothstep(0.75, 1.0, u);
  }
  // …then reforms out of a loose cloud.
  if (uReformT < 50.0) {
    float v = clamp((uReformT - rnd2 * 0.4) / 0.9, 0.0, 1.0);
    float spread = pow(1.0 - v, 3.0);
    float a = fract(sin(float(j) * 12.9898) * 43758.5453) * 2.0 * PI;
    float d = (0.35 + 0.65 * rnd) * min(uView.x, uView.y) * 0.45;
    p += vec2(cos(a), sin(a)) * d * spread;
    alpha *= 1.0 - 0.85 * spread;
  }

  // Cursor hole (stateless): dots inside R sit on its rim. Pupils keep watching.
  if (!pupil && uHoleR > 0.5) {
    vec2 d = p - uMouse;
    float l = length(d);
    if (l < uHoleR) p = uMouse + (l > 0.001 ? d / l : vec2(1.0, 0.0)) * uHoleR;
  }

  // Touch ripple ring.
  if (uRipple.w > 0.0) {
    vec2 d = p - uRipple.xy;
    float l = length(d);
    float band = (l - uRipple.z) / 28.0;
    p += (l > 0.001 ? d / l : vec2(0.0)) * uRipple.w * exp(-band * band);
  }

  vec3 c = mix(colourOf(s0, t0, pupil, ring), colourOf(s1, t1, pupil, ring), k);
  if (!pupil) {
    if (uGlow > 0.0) {
      float rank = mix(texelFetch(uRanks, texelOf(s0 * uN + j), 0).r, texelFetch(uRanks, texelOf(s1 * uN + j), 0).r, k);
      vec3 g = rank < 0.5 ? mix(uRamp[0], uRamp[1], rank * 2.0) : mix(uRamp[1], uRamp[2], rank * 2.0 - 1.0);
      c = mix(c, g, uGlow);
    }
    c *= mix(1.0, mix(gainOf(s0), gainOf(s1), k), uNight);
  }

  vColor = c;
  vAlpha = alpha;
  vPupil = pupil ? 1.0 : 0.0;

  // Leaving shape 0 the dots shrink from the hand-off cover size to their own size. Pupil dots are
  // larger, so each eye reads as one solid disc.
  float size = pupil ? uSize * PUPIL_SIZE : uSize;
  float cover = s0 == 0 ? 1.0 - k : 0.0;
  gl_PointSize = mix(size, max(size, uCover), cover) * uDpr;
  gl_Position = uProjection * vec4(p, z, 1.0);
}
`;

export const fragmentShader = /* glsl */ `#version 300 es
precision highp float;

uniform float uNight;

in vec3 vColor;
in float vAlpha;
in float vPupil;

out vec4 outColor;

void main() {
  // Round soft dot: the blueprint's smoothstep(.5, .3, d), written with ordered edges (GLSL leaves
  // smoothstep undefined when edge0 >= edge1).
  float a = (1.0 - smoothstep(0.3, 0.5, length(gl_PointCoord - 0.5))) * vAlpha;
  if (a < 0.004) discard;
  outColor = vec4(vColor * a, a * (1.0 - uNight * (1.0 - vPupil)));
}
`;
