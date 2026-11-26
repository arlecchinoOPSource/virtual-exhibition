import { Mesh, MeshStandardMaterial, ShaderChunk } from 'three';
import type { Object3D } from 'three';

// Keep the torch's point light intact while screening the entrance from
// the gallery's directional, hemisphere and artwork lights.
const entranceLights = ShaderChunk.lights_fragment_begin
  .replace(
    'getSpotLightInfo( spotLight, geometryPosition, directLight );',
    '$&\n directLight.color *= gallerySpill;',
  )
  .replace(
    'getDirectionalLightInfo( directionalLight, directLight );',
    '$&\n directLight.color *= gallerySpill;',
  )
  .replace(
    'getAmbientLightIrradiance( ambientLightColor )',
    'getAmbientLightIrradiance( ambientLightColor ) * gallerySpill',
  )
  .replace(
    'getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );',
    'getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal ) * gallerySpill;',
  );

export function shadeEntrance(root: Object3D) {
  root.traverse((node) => {
    if (!(node instanceof Mesh) || !node.visible) return;
    for (const material of [node.material].flat()) {
      if (!(material instanceof MeshStandardMaterial)) continue;
      material.onBeforeCompile = (shader) => {
        shader.vertexShader =
          'varying vec3 vEntrancePosition;\n' +
          shader.vertexShader.replace(
            '#include <worldpos_vertex>',
            '$&\n vEntrancePosition = (modelMatrix * vec4(transformed, 1.0)).xyz;',
          );
        shader.fragmentShader =
          'varying vec3 vEntrancePosition;\n' +
          shader.fragmentShader.replace(
            '#include <lights_fragment_begin>',
            `
              // The rear landing spans x = 4–10 and z = -2–2.
              float alongLanding = smoothstep(4.0, 9.3, vEntrancePosition.x);
              float acrossLanding = 1.0 - smoothstep(2.0, 2.18, abs(vEntrancePosition.z));
              float beforeCellar = 1.0 - smoothstep(12.0, 13.0, vEntrancePosition.x);
              float gallerySpill = 1.0 - alongLanding * acrossLanding * beforeCellar;
              ${entranceLights}
            `,
          );
      };
    }
  });
}
