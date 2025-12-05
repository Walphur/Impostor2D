export function initScene3D(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050712);

  const camera = new THREE.PerspectiveCamera(
    55,
    container.clientWidth / container.clientHeight,
    0.1,
    80
  );
  camera.position.set(0, 10, 13);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio || 1.5);
  container.appendChild(renderer.domElement);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.2, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 8;
  controls.maxDistance = 20;
  controls.minPolarAngle = 0.6;
  controls.maxPolarAngle = 1.4;

  // Luces
  const hemi = new THREE.HemisphereLight(0xffffff, 0x202030, 0.8);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 0.7);
  dir.position.set(5, 10, 7);
  dir.castShadow = true;
  scene.add(dir);

  // Piso
  const floorGeo = new THREE.CircleGeometry(10, 48);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x101326,
    roughness: 0.95,
    metalness: 0.05,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Mesa
  const tableGeo = new THREE.CylinderGeometry(3.2, 3.2, 0.5, 40);
  const tableMat = new THREE.MeshStandardMaterial({
    color: 0x23284a,
    roughness: 0.4,
    metalness: 0.5,
  });
  const table = new THREE.Mesh(tableGeo, tableMat);
  table.position.y = 1;
  table.castShadow = true;
  table.receiveShadow = true;
  scene.add(table);

  // Aura de la mesa
  const ringGeo = new THREE.RingGeometry(3.4, 3.8, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x5e7bff,
    opacity: 0.28,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 1.26;
  scene.add(ring);

  const chairsGroup = new THREE.Group();
  scene.add(chairsGroup);

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    table.rotation.y = t * 0.08;
    ring.material.opacity = 0.24 + Math.sin(t * 1.5) * 0.06;
    chairsGroup.children.forEach((child) => {
      child.position.y = 0.6 + Math.sin(t * 1.4 + child.userData.phase) * 0.06;
    });
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  return { scene, camera, renderer, controls, chairsGroup, container };
}

export function updatePlayersInScene(api, players, turnPlayerId) {
  if (!api) return;
  const { chairsGroup } = api;
  while (chairsGroup.children.length > 0) {
    chairsGroup.remove(chairsGroup.children[0]);
  }
  if (!players || players.length === 0) return;

  const radius = 6.5;
  const baseAngle = -Math.PI / 2;
  const step = (Math.PI * 2) / players.length;

  players.forEach((p, index) => {
    const angle = baseAngle + index * step;
    const geo = new THREE.SphereGeometry(0.6, 28, 24);
    const isTurn = p.id === turnPlayerId;
    const color = isTurn ? 0xffd866 : 0x46b7ff;
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: isTurn ? 0x664000 : 0x00334a,
      metalness: 0.4,
      roughness: 0.3,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    const px = Math.cos(angle) * radius;
    const pz = Math.sin(angle) * radius;
    mesh.position.set(px, 0.6, pz);
    mesh.userData.playerId = p.id;
    mesh.userData.phase = Math.random() * Math.PI * 2;
    chairsGroup.add(mesh);
  });
}

export function handleResize(api) {
  if (!api) return;
  const { camera, renderer, container } = api;
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
