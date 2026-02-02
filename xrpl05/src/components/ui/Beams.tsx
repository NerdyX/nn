// src/components/Beams.tsx
import { component$, useSignal, useTask$ } from "@builder.io/qwik";
import * as THREE from "three";
import "./Beams.css"; // Assuming you have the CSS file

// Helper: hexToNormalizedRGB (unchanged)
const hexToNormalizedRGB = (hex: string): [number, number, number] => {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r / 255, g / 255, b / 255];
};

// Noise GLSL string (unchanged)
const noise = `
float random (in vec2 st) {
    return fract(sin(dot(st.xy,
                         vec2(12.9898,78.233)))*
        43758.5453123);
}
float noise (in vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) +
           (c - a)* u.y * (1.0 - u.x) +
           (d - b) * u.x * u.y;
}
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
vec3 fade(vec3 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}
float cnoise(vec3 P){
  vec3 Pi0 = floor(P);
  vec3 Pi1 = Pi0 + vec3(1.0);
  Pi0 = mod(Pi0, 289.0);
  Pi1 = mod(Pi1, 289.0);
  vec3 Pf0 = fract(P);
  vec3 Pf1 = Pf0 - vec3(1.0);
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;
  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);
  vec4 gx0 = ixy0 / 7.0;
  vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);
  vec4 gx1 = ixy1 / 7.0;
  vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);
  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);
  vec4 norm0 = taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));
  g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));
  g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;
  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x,Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x,Pf1.y,Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy,Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy,Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x,Pf0.y,Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x,Pf1.yz));
  float n111 = dot(g111, Pf1);
  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000,n100,n010,n110),vec4(n001,n101,n011,n111),fade_xyz.z);
  vec2 n_yz = mix(n_z.xy,n_z.zw,fade_xyz.y);
  float n_xyz = mix(n_yz.x,n_yz.y,fade_xyz.x);
  return 2.2 * n_xyz;
}
`;

// Ported extendMaterial to create ShaderMaterial directly
function createBeamMaterial(
  speed: number,
  noiseIntensity: number,
  scale: number,
) {
  const physical = THREE.ShaderLib.physical as THREE.ShaderLibShader & {
    defines?: Record<string, any>;
  };
  const uniforms = THREE.UniformsUtils.clone(physical.uniforms);

  uniforms.diffuse.value = new THREE.Color(...hexToNormalizedRGB("#000000"));
  uniforms.roughness.value = 0.3;
  uniforms.metalness.value = 0.3;
  uniforms.envMapIntensity.value = 10;

  uniforms.time = { value: 0 };
  uniforms.uSpeed = { value: speed };
  uniforms.uNoiseIntensity = { value: noiseIntensity };
  uniforms.uScale = { value: scale };

  const header = `
    varying vec3 vEye;
    varying float vNoise;
    varying vec2 vUv;
    varying vec3 vPosition;
    uniform float time;
    uniform float uSpeed;
    uniform float uNoiseIntensity;
    uniform float uScale;
    ${noise}
  `;

  const vertexHeader = `
    float getPos(vec3 pos) {
      vec3 noisePos = vec3(pos.x * 0., pos.y - uv.y, pos.z + time * uSpeed * 3.) * uScale;
      return cnoise(noisePos);
    }
    vec3 getCurrentPos(vec3 pos) {
      vec3 newpos = pos;
      newpos.z += getPos(pos);
      return newpos;
    }
    vec3 getNormal(vec3 pos) {
      vec3 curpos = getCurrentPos(pos);
      vec3 nextposX = getCurrentPos(pos + vec3(0.01, 0.0, 0.0));
      vec3 nextposZ = getCurrentPos(pos + vec3(0.0, -0.01, 0.0));
      vec3 tangentX = normalize(nextposX - curpos);
      vec3 tangentZ = normalize(nextposZ - curpos);
      return normalize(cross(tangentZ, tangentX));
    }
  `;

  let vertexShader = `${header}\n${vertexHeader}\n${physical.vertexShader}`;
  vertexShader = vertexShader.replace(
    "#include <begin_vertex>",
    "transformed.z += getPos(transformed.xyz);",
  );
  vertexShader = vertexShader.replace(
    "#include <beginnormal_vertex>",
    "objectNormal = getNormal(position.xyz);",
  );

  let fragmentShader = `${header}\n${physical.fragmentShader}`;
  fragmentShader = fragmentShader.replace(
    "#include <dithering_fragment>",
    `
    float randomNoise = noise(gl_FragCoord.xy);
    gl_FragColor.rgb -= randomNoise / 15. * uNoiseIntensity;
  `,
  );

  const material = new THREE.ShaderMaterial({
    defines: physical.defines,
    uniforms,
    vertexShader,
    fragmentShader,
    lights: true,
    fog: true,
    side: THREE.DoubleSide, // Assuming double-sided for planes
  });

  return material;
}

// Ported createStackedPlanesBufferGeometry (unchanged, pure Three.js)
function createStackedPlanesBufferGeometry(
  n: number,
  width: number,
  height: number,
  spacing: number,
  heightSegments: number,
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const numVertices = n * (heightSegments + 1) * 2;
  const numFaces = n * heightSegments * 2;
  const positions = new Float32Array(numVertices * 3);
  const indices = new Uint32Array(numFaces * 3);
  const uvs = new Float32Array(numVertices * 2);

  let vertexOffset = 0;
  let indexOffset = 0;
  let uvOffset = 0;
  const totalWidth = n * width + (n - 1) * spacing;
  const xOffsetBase = -totalWidth / 2;

  for (let i = 0; i < n; i++) {
    const xOffset = xOffsetBase + i * (width + spacing);
    const uvXOffset = Math.random() * 300;
    const uvYOffset = Math.random() * 300;

    for (let j = 0; j <= heightSegments; j++) {
      const y = height * (j / heightSegments - 0.5);
      const v0 = [xOffset, y, 0];
      const v1 = [xOffset + width, y, 0];
      positions.set([...v0, ...v1], vertexOffset * 3);

      const uvY = j / heightSegments;
      uvs.set(
        [uvXOffset, uvY + uvYOffset, uvXOffset + 1, uvY + uvYOffset],
        uvOffset,
      );

      if (j < heightSegments) {
        const a = vertexOffset,
          b = vertexOffset + 1,
          c = vertexOffset + 2,
          d = vertexOffset + 3;
        indices.set([a, b, c, c, b, d], indexOffset);
        indexOffset += 6;
      }
      vertexOffset += 2;
      uvOffset += 4;
    }
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

interface BeamsProps {
  beamWidth?: number;
  beamHeight?: number;
  beamNumber?: number;
  lightColor?: string;
  speed?: number;
  noiseIntensity?: number;
  scale?: number;
  rotation?: number;
}

export const Beams = component$<BeamsProps>((props) => {
  const {
    beamWidth = 2,
    beamHeight = 15,
    beamNumber = 12,
    lightColor = "#ffffff",
    speed = 2,
    noiseIntensity = 1.75,
    scale = 0.2,
    rotation = 0,
  } = props;

  const containerRef = useSignal<HTMLDivElement>();

  // useVisibleTask$ for client-side Three.js setup when component is visible
  useTask$(({ track, cleanup }) => {
    track(() => containerRef.value);

    const container = containerRef.value;
    if (!container) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#000000");
    scene.fog = new THREE.Fog("#000000", 10, 50); // Assuming fog based on material

    const camera = new THREE.PerspectiveCamera(
      30,
      container.clientWidth / container.clientHeight,
      0.1,
      1000,
    );
    camera.position.set(0, 0, 20);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Group with rotation
    const group = new THREE.Group();
    group.rotation.z = THREE.MathUtils.degToRad(rotation);
    scene.add(group);

    // Material
    const material = createBeamMaterial(speed, noiseIntensity, scale);

    // Geometry
    const geometry = createStackedPlanesBufferGeometry(
      beamNumber,
      beamWidth,
      beamHeight,
      0,
      100,
    );

    // Mesh
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);

    // Lights
    const dirLight = new THREE.DirectionalLight(lightColor, 1);
    dirLight.position.set(0, 3, 10);
    dirLight.castShadow = true; // Assuming from original shadow setup
    dirLight.shadow.camera.top = 24;
    dirLight.shadow.camera.bottom = -24;
    dirLight.shadow.camera.left = -24;
    dirLight.shadow.camera.right = 24;
    dirLight.shadow.camera.far = 64;
    dirLight.shadow.bias = -0.004;
    group.add(dirLight);

    const ambientLight = new THREE.AmbientLight("#ffffff", 1);
    scene.add(ambientLight);

    // Animation loop
    let animationId: number;
    const animate = () => {
      material.uniforms.time.value += 0.1 * (1 / 60); // Approximate delta assuming 60fps
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };
    animate();

    // Resize handler
    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", onResize);

    // Cleanup
    cleanup(() => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      container.removeChild(renderer.domElement);
    });
  }); // Start when visible in viewport

  return (
    <div
      ref={containerRef}
      class="beams-container"
      style={{ width: "100%", height: "100%" }}
    />
  );
});
