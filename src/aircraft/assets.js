import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import decoderWasm from 'three/examples/jsm/libs/draco/gltf/draco_decoder.wasm?url';
import decoderWrapper from 'three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js?url';
import { createAircraft } from '../world.js';

const manager = new THREE.LoadingManager();
manager.setURLModifier(url => url.endsWith('draco_decoder.wasm') ? decoderWasm : url.endsWith('draco_wasm_wrapper.js') ? decoderWrapper : url);
const decoder = new DRACOLoader(manager).setDecoderConfig({ type: 'wasm' }).setWorkerLimit(1);
const loader = new GLTFLoader().setDRACOLoader(decoder);

export function disposeAircraft(mesh) {
  mesh.removeFromParent();
  const geometries = new Set(), materials = new Set(), textures = new Set();
  mesh.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of object.material ? [].concat(object.material) : []) {
      materials.add(material);
      Object.values(material).forEach(value => { if (value?.isTexture) textures.add(value); });
    }
    object.skeleton?.dispose();
  });
  geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose());
  textures.forEach(item => { item.source?.data?.close?.(); item.dispose(); });
}

export async function loadAircraft(definition) {
  const mesh = new THREE.Group();
  mesh.name = definition.name;
  let status = 'procedural', normalization = null;
  if (definition.type === 'gltf') {
    let model;
    try {
      const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}${definition.path}`);
      model = gltf.scene;
      for (const name of definition.visual.hiddenNodes) {
        const node = model.getObjectByName(name);
        if (node) node.visible = false;
      }
      // Preserve original hierarchy/skinning. Correct export axes on an outer group.
      const correction = new THREE.Group(); correction.add(model);
      correction.rotation.fromArray(definition.visual.rotation);
      correction.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(correction);
      const size = bounds.getSize(new THREE.Vector3());
      if (!Number.isFinite(size.z) || size.z <= 0) throw new Error('Model has invalid bounds');
      const scale = definition.visual.length / size.z;
      const center = bounds.getCenter(new THREE.Vector3());
      correction.scale.setScalar(scale);
      correction.position.copy(center).multiplyScalar(-scale).add(new THREE.Vector3().fromArray(definition.visual.offset));
      mesh.add(correction);
      normalization = { scale, size: size.multiplyScalar(scale).toArray(), offset: correction.position.toArray() };
      status = 'loaded';
    } catch (error) {
      if (model) disposeAircraft(model);
      console.error(`GALM 2: failed to load ${definition.path}; using visible procedural fallback.`, error);
      mesh.add(createAircraft(THREE)); status = 'fallback';
    }
  } else mesh.add(createAircraft(THREE));
  return { mesh, definition, assetStatus: status, normalization };
}
