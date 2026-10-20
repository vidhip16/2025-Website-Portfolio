// The dot stage's WebGL2 layer (blueprint §5.2, §8). Exactly what engine.ts used three.js for, and
// nothing else: one program compiled from its own GLSL ES 3.00 sources, one POINTS draw from a
// vertex array, float data textures (NEAREST, CLAMP_TO_EDGE, read with texelFetch) plus the Ping
// still as an RGBA8 texture, one blend state and the CSS-px orthographic camera. Every call here
// reproduces what three 0.186.1 did for the stage's RawShaderMaterial / Points / DataTexture /
// OrthographicCamera, so the frames are the same without shipping three's renderer.
//
// Importing this module touches no DOM or GL (tests/unit run the pure maths in Node).

const DEV = process.env.NODE_ENV !== "production";

/** KHR_parallel_shader_compile's COMPLETION_STATUS_KHR. */
const COMPLETION_STATUS_KHR = 0x91b1;

export type GL = WebGL2RenderingContext;

/** The context engine.ts asked for (and passed on to three's WebGLRenderer). */
export const CONTEXT_ATTRIBUTES: WebGLContextAttributes = {
  alpha: true,
  antialias: false,
  depth: false,
  stencil: false,
  premultipliedAlpha: true,
  powerPreference: "high-performance",
};

export function createContext(canvas: HTMLCanvasElement): GL | null {
  return canvas.getContext("webgl2", CONTEXT_ATTRIBUTES);
}

/**
 * Blend and depth state, set once: the context has nothing else drawing into it. The stage's
 * material was three CustomBlending with AddEquation and One / OneMinusSrcAlpha for colour and
 * alpha, depthTest and depthWrite off; the canvas clears to transparent black.
 */
export function initState(gl: GL): void {
  gl.disable(gl.DEPTH_TEST);
  gl.depthMask(false);
  blendPremultiplied(gl);
  gl.clearColor(0, 0, 0, 0);
}

/**
 * The engine's one blend state. The shaders write premultiplied colour, so ONE / ONE_MINUS_SRC_ALPHA
 * is "normal" (over) for a fragment with alpha a and "additive" for the same colour written with
 * alpha 0. Both looks share these factors: the fragment shader slides between them with uNight, so
 * paper → night never changes GL state (and never pops).
 */
export function blendPremultiplied(gl: GL): void {
  gl.enable(gl.BLEND);
  gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
  gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
}

/** renderer.clear() / the autoClear before every render: transparent black, colour only (no depth buffer). */
export function clear(gl: GL): void {
  gl.clear(gl.COLOR_BUFFER_BIT);
}

// ── Camera and viewport (pure) ───────────────────────────────────────────────

/**
 * Matrix4.makeOrthographic(left, right, top, bottom, near, far) for WebGL clip space, as three's
 * OrthographicCamera (zoom 1, no view offset) produced it. Column-major, as uniformMatrix4fv
 * (transpose false) takes it. Writes into `out` and returns it.
 */
export function orthographic(
  left: number,
  right: number,
  top: number,
  bottom: number,
  near: number,
  far: number,
  out: Float32Array = new Float32Array(16),
): Float32Array {
  const x = 2 / (right - left);
  const y = 2 / (top - bottom);
  const a = -(right + left) / (right - left);
  const b = -(top + bottom) / (top - bottom);
  const c = -2 / (far - near);
  const d = -(far + near) / (far - near);
  out[0] = x;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = y;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = c;
  out[11] = 0;
  out[12] = a;
  out[13] = b;
  out[14] = d;
  out[15] = 1;
  return out;
}

/** Near / far of the stage camera: z (±22 px of depth) never comes close. */
export const CAMERA_DEPTH = 1000;

/**
 * The stage camera, CSS px with y down: OrthographicCamera(0, vw, 0, vh, −1000, 1000). three's
 * modelViewMatrix was the identity (camera at the origin, unrotated; the Points untransformed),
 * so this one matrix takes a dot's (x, y, z) straight to clip space.
 */
export function cssCamera(vw: number, vh: number, out?: Float32Array): Float32Array {
  return orthographic(0, vw, 0, vh, -CAMERA_DEPTH, CAMERA_DEPTH, out);
}

/**
 * Backing store and viewport for a CSS size at a pixel ratio, as three's setPixelRatio(dpr) +
 * setSize(w, h, false) set them: the canvas floors, the viewport rounds.
 */
export function drawingBufferSize(
  cssW: number,
  cssH: number,
  dpr: number,
): { width: number; height: number; viewportW: number; viewportH: number } {
  return {
    width: Math.floor(cssW * dpr),
    height: Math.floor(cssH * dpr),
    viewportW: Math.round(cssW * dpr),
    viewportH: Math.round(cssH * dpr),
  };
}

/** Resize the drawing buffer (always assigned, as three did, which also clears it) and the viewport. */
export function resize(gl: GL, cssW: number, cssH: number, dpr: number): void {
  const s = drawingBufferSize(cssW, cssH, dpr);
  gl.canvas.width = s.width;
  gl.canvas.height = s.height;
  gl.viewport(0, 0, s.viewportW, s.viewportH);
}

// ── Program and uniforms ─────────────────────────────────────────────────────

type Slot = {
  loc: WebGLUniformLocation;
  type: number;
  size: number;
  /** Last scalar sent (float, int, sampler unit). */
  n?: number;
  /** Last vector / array / matrix sent. */
  v?: Float32Array;
};

export type Program = {
  /** Non-blocking: has the driver finished compiling and linking? (Always true without KHR_parallel_shader_compile.) */
  ready(): boolean;
  /**
   * Check the link and read the active uniforms, once (this waits for the driver if it is still
   * compiling). False while the context is lost; throws when the program does not link.
   */
  link(): boolean;
  use(): void;
  /** `float`. Cached: the call is skipped while the value is unchanged. Unknown (compiled-out) names are ignored. */
  setFloat(name: string, value: number): void;
  /** `int`, `bool` or a sampler's texture unit. Cached like setFloat. */
  setInt(name: string, value: number): void;
  /** vec2 / vec3 / vec4 / mat4, or an array of float / vecN (the whole array in one call). Cached like setFloat. */
  setVector(name: string, value: Float32Array): void;
  dispose(): void;
};

function compile(gl: GL, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("dots/gl: could not create a shader (context lost?)");
  gl.shaderSource(shader, source);
  gl.compileShader(shader); // status is read in link(), so the driver may compile in parallel
  return shader;
}

/** A shader's info log with the source lines it points at, numbered (dev only). */
function shaderReport(gl: GL, shader: WebGLShader, label: string, source: string): string {
  const log = (gl.getShaderInfoLog(shader) ?? "").trim();
  if (!log) return "";
  const lines = source.split("\n");
  const marked = new Set<number>();
  for (const m of log.matchAll(/ERROR:\s*\d+:(\d+)/g)) marked.add(Number(m[1]));
  const excerpt: string[] = [];
  for (const line of [...marked].sort((p, q) => p - q)) {
    for (let l = Math.max(1, line - 2); l <= Math.min(lines.length, line + 2); l++) {
      excerpt.push(`${l === line ? ">" : " "} ${String(l).padStart(4)} | ${lines[l - 1]}`);
    }
    excerpt.push("");
  }
  return `\n-- ${label} shader --\n${log}\n${excerpt.join("\n")}`;
}

function readUniforms(gl: GL, program: WebGLProgram): Map<string, Slot> {
  const slots = new Map<string, Slot>();
  const count = Number(gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS)) || 0;
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    if (!info) continue;
    const loc = gl.getUniformLocation(program, info.name);
    if (!loc) continue;
    // Arrays report as "name[0]"; the whole array is set through the first element's location.
    slots.set(info.name.replace(/\[0\]$/, ""), { loc, type: info.type, size: info.size });
  }
  return slots;
}

const sameValues = (a: Float32Array, b: Float32Array) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

/**
 * Compile and link a program. Nothing blocks here: the link status (and the uniform locations)
 * are read on the first link() call. `attribs` binds attribute names to fixed locations before the
 * link (three bound `position` to 0 the same way), so vertex arrays can be built before it.
 */
export function createProgram(gl: GL, vertexSource: string, fragmentSource: string, attribs: Record<string, number>): Program {
  const parallel = gl.getExtension("KHR_parallel_shader_compile"); // enabled before compiling, as three did
  const vs = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  for (const [name, location] of Object.entries(attribs)) gl.bindAttribLocation(program, location, name);
  gl.linkProgram(program);

  let shaders: WebGLShader[] | null = [vs, fs];
  let slots: Map<string, Slot> | null = null;
  let deleted = false;

  const dropShaders = () => {
    // The linked program keeps its own copy; three deleted its shaders after the first use too.
    for (const s of shaders ?? []) gl.deleteShader(s);
    shaders = null;
  };

  const mismatch = (name: string, slot: Slot, wanted: string) =>
    new Error(`dots/gl: uniform ${name} is GL type 0x${slot.type.toString(16)} (size ${slot.size}), set as ${wanted}`);

  return {
    ready() {
      if (slots) return true;
      if (deleted) return false;
      if (!parallel) return true;
      return gl.getProgramParameter(program, COMPLETION_STATUS_KHR) === true;
    },
    link() {
      if (slots) return true;
      if (deleted || gl.isContextLost()) return false;
      if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) {
        if (gl.isContextLost()) return false;
        let message = "dots/gl: the dot-stage program did not link";
        if (DEV) {
          const programLog = (gl.getProgramInfoLog(program) ?? "").trim();
          message +=
            (programLog ? `\n-- program --\n${programLog}` : "") +
            shaderReport(gl, vs, "vertex", vertexSource) +
            shaderReport(gl, fs, "fragment", fragmentSource);
        }
        throw new Error(message);
      }
      dropShaders();
      slots = readUniforms(gl, program);
      return true;
    },
    use() {
      gl.useProgram(program);
    },
    setFloat(name, value) {
      const s = slots?.get(name);
      if (!s) return;
      if (DEV && (s.type !== gl.FLOAT || s.size !== 1)) throw mismatch(name, s, "float");
      if (s.n === value) return;
      s.n = value;
      gl.uniform1f(s.loc, value);
    },
    setInt(name, value) {
      const s = slots?.get(name);
      if (!s) return;
      if (DEV && ((s.type !== gl.INT && s.type !== gl.BOOL && s.type !== gl.SAMPLER_2D) || s.size !== 1)) {
        throw mismatch(name, s, "int");
      }
      if (s.n === value) return;
      s.n = value;
      gl.uniform1i(s.loc, value);
    },
    setVector(name, value) {
      const s = slots?.get(name);
      if (!s) return;
      if (s.v && sameValues(s.v, value)) return;
      if (s.v && s.v.length === value.length) s.v.set(value);
      else s.v = new Float32Array(value);
      switch (s.type) {
        case gl.FLOAT:
          gl.uniform1fv(s.loc, value);
          break;
        case gl.FLOAT_VEC2:
          gl.uniform2fv(s.loc, value);
          break;
        case gl.FLOAT_VEC3:
          gl.uniform3fv(s.loc, value);
          break;
        case gl.FLOAT_VEC4:
          gl.uniform4fv(s.loc, value);
          break;
        case gl.FLOAT_MAT4:
          gl.uniformMatrix4fv(s.loc, false, value);
          break;
        default:
          if (DEV) throw mismatch(name, s, "a float vector");
      }
    },
    dispose() {
      if (deleted) return;
      deleted = true;
      dropShaders();
      gl.deleteProgram(program);
      slots = null;
    },
  };
}

// ── Vertex data ──────────────────────────────────────────────────────────────

/** One vertex attribute in its own buffer, behind a vertex array: the stage's BufferGeometry. */
export type PointBuffer = { vao: WebGLVertexArrayObject; buffer: WebGLBuffer; count: number };

/** Upload `data` (`size` floats per point) as attribute `location`, STATIC_DRAW like a BufferAttribute. */
export function createPoints(gl: GL, location: number, data: Float32Array, size: number): PointBuffer {
  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  return { vao, buffer, count: Math.floor(data.length / size) };
}

export function deletePoints(gl: GL, p: PointBuffer): void {
  gl.deleteVertexArray(p.vao);
  gl.deleteBuffer(p.buffer);
}

/** The Points draw: every point, once. */
export function drawPoints(gl: GL, p: PointBuffer): void {
  gl.bindVertexArray(p.vao);
  gl.drawArrays(gl.POINTS, 0, p.count);
  gl.bindVertexArray(null);
}

// ── Textures ─────────────────────────────────────────────────────────────────

/** RGBA32F (four floats per texel) or R32F (one). */
export type FloatFormat = "rgba32f" | "r32f";

/** NEAREST both ways, one level, CLAMP_TO_EDGE: the stage's textures (minFilter / magFilter NearestFilter, no mipmaps). */
function sampling(gl: GL): void {
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

/** Unpack state three set before each upload: no flip, no premultiply, no colour-space conversion (NoColorSpace). */
function unpack(gl: GL, alignment: number): void {
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, alignment);
}

/** A float DataTexture: `data` is width × height texels, row-major, uploaded as they are. */
export function createFloatTexture(gl: GL, data: Float32Array, width: number, height: number, format: FloatFormat): WebGLTexture {
  const rgba = format === "rgba32f";
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  sampling(gl);
  unpack(gl, 1);
  gl.texStorage2D(gl.TEXTURE_2D, 1, rgba ? gl.RGBA32F : gl.R32F, width, height);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, rgba ? gl.RGBA : gl.RED, gl.FLOAT, data);
  return tex;
}

/** A decoded image as RGBA8, top row first (flipY false), straight alpha, no colour management. */
export function createImageTexture(gl: GL, img: HTMLImageElement): WebGLTexture {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  sampling(gl);
  unpack(gl, 4);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, img.naturalWidth || img.width, img.naturalHeight || img.height);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, img);
  return tex;
}

export function bindTexture(gl: GL, unit: number, tex: WebGLTexture | null): void {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
}

// ── Teardown ─────────────────────────────────────────────────────────────────

/** Final teardown only: hand the context back now instead of when the canvas is collected. */
export function loseContext(gl: GL): void {
  if (gl.isContextLost()) return;
  gl.getExtension("WEBGL_lose_context")?.loseContext();
}
