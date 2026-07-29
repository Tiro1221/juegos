// ============================================================================
// Custom shader materials: opaque voxel material (with fake AO/vertex color),
// wind-swayed foliage (leaves/crops), animated water with simple reflections
// and dust motes handled elsewhere.
// ============================================================================
import * as THREE from 'three';

const windUniforms = () => ({
  uTime: { value: 0 },
  uWindStrength: { value: 0.18 },
});

export function createOpaqueMaterial(atlasTexture) {
  const mat = new THREE.MeshLambertMaterial({
    map: atlasTexture,
    vertexColors: true,
    fog: true,
  });
  return mat;
}

export function createTransparentMaterial(atlasTexture) {
  const uniforms = windUniforms();
  const mat = new THREE.MeshLambertMaterial({
    map: atlasTexture,
    vertexColors: true,
    transparent: true,
    alphaTest: 0.1,
    side: THREE.DoubleSide,
    fog: true,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWindStrength = uniforms.uWindStrength;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      uniform float uTime;
      uniform float uWindStrength;`
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float windPhase = position.x * 0.6 + position.z * 0.6 + position.y * 0.3;
      float sway = sin(uTime * 1.6 + windPhase) * uWindStrength;
      float heightFactor = clamp(position.y - floor(position.y), 0.0, 1.0);
      transformed.x += sway * heightFactor * 0.3;
      transformed.z += cos(uTime * 1.3 + windPhase) * uWindStrength * heightFactor * 0.2;`
    );
  };
  mat.userData.windUniforms = uniforms;
  mat.customProgramCacheKey = () => 'wind-transparent';
  return mat;
}

export function createCrossMaterial(atlasTexture) {
  const uniforms = windUniforms();
  const mat = new THREE.MeshLambertMaterial({
    map: atlasTexture,
    vertexColors: true,
    transparent: true,
    alphaTest: 0.2,
    side: THREE.DoubleSide,
    fog: true,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWindStrength = uniforms.uWindStrength;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      uniform float uTime;
      uniform float uWindStrength;`
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float windPhase2 = position.x * 1.1 + position.z * 1.1;
      float sway2 = sin(uTime * 2.2 + windPhase2) * uWindStrength * 1.6;
      float h2 = clamp(position.y - floor(position.y), 0.0, 1.0);
      transformed.x += sway2 * h2;
      transformed.z += sway2 * h2 * 0.6;`
    );
  };
  mat.userData.windUniforms = uniforms;
  mat.customProgramCacheKey = () => 'wind-cross';
  return mat;
}

export function createWaterMaterial(atlasTexture, envColorHex = 0x2f8fae) {
  const uniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(envColorHex) },
    uSunDir: { value: new THREE.Vector3(0.5, 1, 0.3) },
    uOpacity: { value: 0.78 },
  };
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, uniforms]),
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vWave;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec3 pos = position;
        float wave = sin(pos.x * 0.9 + uTime * 1.4) * 0.06 + cos(pos.z * 0.7 + uTime * 1.1) * 0.06;
        pos.y += wave;
        vWave = wave;
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uTime;
      varying vec2 vUv;
      varying float vWave;
      #include <fog_pars_fragment>
      void main() {
        float sparkle = pow(max(0.0, sin(vUv.x * 40.0 + uTime * 2.0) * cos(vUv.y * 40.0 - uTime * 1.7)), 6.0);
        vec3 col = uColor + vWave * 0.6 + sparkle * 0.35;
        gl_FragColor = vec4(col, uOpacity);
        #include <fog_fragment>
      }
    `,
  });
  mat.userData.windUniforms = uniforms;
  return mat;
}
