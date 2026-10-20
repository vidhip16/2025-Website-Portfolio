// Unit tests for the dot stage's WebGL2 layer (components/dots/gl.ts): the pure maths that
// replaced three's OrthographicCamera and WebGLRenderer.setPixelRatio/setSize. Project "unit":
// Node only, no GL context. The expected values are three 0.186.1's (Matrix4.makeOrthographic,
// WebGL clip space; canvas size floored, viewport rounded), written out so the test does not
// depend on three.
import { expect, test } from "@playwright/test";
import { CAMERA_DEPTH, cssCamera, drawingBufferSize, orthographic } from "../../components/dots/gl";
import { fragmentShader, vertexShader } from "../../components/dots/shaders";

/** clip = M · (x, y, z, 1), M column-major. */
function project(m: Float32Array, x: number, y: number, z = 0): [number, number, number, number] {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
    m[3] * x + m[7] * y + m[11] * z + m[15],
  ];
}

/** -0 → 0, so element lists compare by value. */
const plain = (m: Float32Array) => Array.from(m, (v) => v + 0);

test.describe("dots gl: CSS-px orthographic camera", () => {
  test("matches three's OrthographicCamera(0, vw, 0, vh, -1000, 1000) element for element", () => {
    const vw = 1280;
    const vh = 800;
    const f = Math.fround;
    // makeOrthographic: x = 2/(r−l), y = 2/(t−b), a = −(r+l)/(r−l), b = −(t+b)/(t−b),
    // c = −2/(f−n), d = −(f+n)/(f−n); te[0]=x te[5]=y te[10]=c te[12]=a te[13]=b te[14]=d te[15]=1.
    expect(plain(cssCamera(vw, vh))).toEqual([
      f(2 / vw), 0, 0, 0,
      0, f(-2 / vh), 0, 0,
      0, 0, f(-2 / 2000), 0,
      -1, 1, 0, 1,
    ]);
    expect(CAMERA_DEPTH).toBe(1000);
  });

  test("maps the viewport's corners and centre to clip space, y down", () => {
    const vw = 1440;
    const vh = 900;
    const m = cssCamera(vw, vh);
    const close = (got: number[], want: number[]) => got.forEach((v, i) => expect(v).toBeCloseTo(want[i], 6));
    close(project(m, 0, 0), [-1, 1, 0, 1]); // top left
    close(project(m, vw, 0), [1, 1, 0, 1]); // top right
    close(project(m, 0, vh), [-1, -1, 0, 1]); // bottom left
    close(project(m, vw, vh), [1, -1, 0, 1]); // bottom right
    close(project(m, vw / 2, vh / 2), [0, 0, 0, 1]);
    // Further down the page is lower in clip space.
    expect(project(m, 10, 500)[1]).toBeLessThan(project(m, 10, 100)[1]);
  });

  test("keeps the dots' depth (±22 px) well inside the clip volume, w = 1", () => {
    const m = cssCamera(800, 600);
    for (const z of [-22, 0, 22]) {
      const [, , cz, w] = project(m, 400, 300, z);
      expect(cz).toBeCloseTo(-z / 1000, 6);
      expect(Math.abs(cz)).toBeLessThan(1);
      expect(w).toBe(1);
    }
  });

  test("a general box: left → −1, right → 1, top → 1, bottom → −1, near → −1, far → 1", () => {
    const m = orthographic(-50, 150, 20, -80, 0.5, 10);
    const close = (got: number, want: number) => expect(got).toBeCloseTo(want, 5);
    close(project(m, -50, 0)[0], -1);
    close(project(m, 150, 0)[0], 1);
    close(project(m, 0, 20)[1], 1);
    close(project(m, 0, -80)[1], -1);
    // three's cameras look down −z: view z = −near is the near plane.
    close(project(m, 0, 0, -0.5)[2], -1);
    close(project(m, 0, 0, -10)[2], 1);
  });

  test("writes into the matrix it is given (no allocation per resize)", () => {
    const out = new Float32Array(16).fill(7);
    expect(cssCamera(320, 640, out)).toBe(out);
    expect(out[0]).toBeCloseTo(2 / 320, 7);
    expect(out[5]).toBeCloseTo(-2 / 640, 7);
    expect(out[15]).toBe(1);
    expect(out[3]).toBe(0);
    expect(out[7]).toBe(0);
  });

  test("updates in place when the viewport changes", () => {
    const out = cssCamera(1000, 1000);
    cssCamera(500, 250, out);
    expect(project(out, 500, 250)[0]).toBeCloseTo(1, 6);
    expect(project(out, 500, 250)[1]).toBeCloseTo(-1, 6);
  });
});

test.describe("dots gl: drawing buffer size", () => {
  test("the backing store floors and the viewport rounds (three's setSize)", () => {
    expect(drawingBufferSize(1001, 667, 1.75)).toEqual({ width: 1751, height: 1167, viewportW: 1752, viewportH: 1167 });
    expect(drawingBufferSize(1280, 800, 1.5)).toEqual({ width: 1920, height: 1200, viewportW: 1920, viewportH: 1200 });
    expect(drawingBufferSize(390, 844, 1)).toEqual({ width: 390, height: 844, viewportW: 390, viewportH: 844 });
  });
});

test.describe("dots gl: shader sources", () => {
  test("each starts with its #version line (three used to prepend it)", () => {
    expect(vertexShader.startsWith("#version 300 es\n")).toBe(true);
    expect(fragmentShader.startsWith("#version 300 es\n")).toBe(true);
  });

  test("no three built-ins are left for gl.ts to supply", () => {
    for (const src of [vertexShader, fragmentShader]) {
      expect(src).not.toMatch(/\bprojectionMatrix\b|\bmodelViewMatrix\b|\bmodelMatrix\b|\bviewMatrix\b|\bcameraPosition\b/);
    }
    expect(vertexShader).toMatch(/uniform mat4 uProjection;/);
  });
});
