import { Vector3 } from 'three';

export function hardpointWorld(aircraft, name, result = new Vector3()) {
  const local = aircraft.definition.hardpoints[name];
  if (!local) throw new Error(`Missing ${name} hardpoint on ${aircraft.definition.id}`);
  aircraft.mesh.updateWorldMatrix(true, false);
  return aircraft.mesh.localToWorld(result.fromArray(local));
}

export function aircraftForward(mesh, result = new Vector3()) {
  return result.set(0, 0, -1).applyQuaternion(mesh.quaternion).normalize();
}
