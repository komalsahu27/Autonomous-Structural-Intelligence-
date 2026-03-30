import { useEffect, useRef } from "react";
import * as THREE from "three";

interface Viewer3DProps {
  heightMapData: number[][] | null;
  projectId?: string;
}

export function Viewer3D({ heightMapData }: Viewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const previousMouseRef = useRef({ x: 0, y: 0 });
  const animationIdRef = useRef<number | null>(null);

  // Detect rooms from height map
  const detectRooms = (data: number[][]) => {
    const rooms = [];
    const rows = data.length;
    const cols = data[0]?.length || 0;
    const visited = Array(rows).fill(null).map(() => Array(cols).fill(false));
    const threshold = 0.2;

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        if (!visited[i][j] && data[i][j] > threshold) {
          let minR = i, maxR = i, minC = j, maxC = j;
          let totalH = 0, count = 0;
          const queue: [number, number][] = [[i, j]];

          while (queue.length > 0) {
            const [r, c] = queue.shift()!;
            if (r < 0 || r >= rows || c < 0 || c >= cols || visited[r][c]) continue;
            if (data[r][c] <= threshold) continue;

            visited[r][c] = true;
            minR = Math.min(minR, r);
            maxR = Math.max(maxR, r);
            minC = Math.min(minC, c);
            maxC = Math.max(maxC, c);
            totalH += data[r][c];
            count++;

            queue.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]);
          }

          if (count > 20) {
            const x = ((minC + maxC) / 2 / cols) * 50 - 25;
            const z = ((minR + maxR) / 2 / rows) * 50 - 25;
            const w = ((maxC - minC + 1) / cols) * 50;
            const h = ((maxR - minR + 1) / rows) * 50;
            const avgHeight = totalH / count;
            rooms.push({ x, z, w, h, height: avgHeight, id: rooms.length });
          }
        }
      }
    }

    return rooms;
  };

  useEffect(() => {
    if (!heightMapData || heightMapData.length === 0 || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    if (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    try {
      const width = container.clientWidth || 800;
      const height = container.clientHeight || 500;

      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xffffff);
      scene.fog = new THREE.Fog(0xffffff, 200, 400);

      // Camera - top-down isometric view
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.set(45, 50, 45);
      camera.lookAt(0, 0, 0);

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      container.appendChild(renderer.domElement);

      // Ground
      const groundGeom = new THREE.PlaneGeometry(100, 100);
      const groundMat = new THREE.MeshStandardMaterial({
        color: 0xbdbdbd,
        roughness: 0.9,
      });
      const ground = new THREE.Mesh(groundGeom, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.01;
      ground.receiveShadow = true;
      scene.add(ground);

      // Detect rooms
      const rooms = detectRooms(heightMapData);

      // Room type assignment
      const roomTypes = ["bedroom", "bathroom", "kitchen", "living", "bedroom", "office"];
      const roomColors: { [key: string]: number } = {
        bedroom: 0xfffacd,
        bathroom: 0xe0f7fa,
        kitchen: 0xfff8dc,
        living: 0xffe4b5,
        office: 0xf0fff0,
      };

      // Create rooms
      rooms.forEach((room, idx) => {
        const wallHeight = 2.8;
        const wallThickness = 0.2;
        const roomType = roomTypes[idx % roomTypes.length];
        const floorColor = roomColors[roomType] || 0xfafafa;

        // Room floor - simple solid color, very bright
        const floorGeom = new THREE.PlaneGeometry(room.w - wallThickness * 2, room.h - wallThickness * 2);
        const floorMat = new THREE.MeshStandardMaterial({
          color: floorColor,
          roughness: 0.8,
        });
        const floor = new THREE.Mesh(floorGeom, floorMat);
        floor.position.set(room.x, 0.02, room.z);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        // Wall material - very distinct from floor
        const wallMat = new THREE.MeshStandardMaterial({
          color: 0x3d3d3d,
          roughness: 0.9,
        });

        const doorMat = new THREE.MeshStandardMaterial({
          color: 0x8b4513,
          roughness: 0.6,
        });

        // All walls
        const walls = [
          {
            pos: [room.x, wallHeight / 2, room.z - room.h / 2],
            size: [room.w, wallHeight, wallThickness],
            hasDoor: true,
            doorPos: [room.x - room.w / 4, wallHeight / 2, room.z - room.h / 2 - wallThickness / 2],
          },
          {
            pos: [room.x, wallHeight / 2, room.z + room.h / 2],
            size: [room.w, wallHeight, wallThickness],
            hasDoor: false,
          },
          {
            pos: [room.x - room.w / 2, wallHeight / 2, room.z],
            size: [wallThickness, wallHeight, room.h],
            hasDoor: true,
            doorPos: [room.x - room.w / 2 - wallThickness / 2, wallHeight / 2, room.z + room.h / 4],
          },
          {
            pos: [room.x + room.w / 2, wallHeight / 2, room.z],
            size: [wallThickness, wallHeight, room.h],
            hasDoor: false,
          },
        ];

        walls.forEach((wall) => {
          const wallGeom = new THREE.BoxGeometry(...(wall.size as [number, number, number]));
          const wallMesh = new THREE.Mesh(wallGeom, wallMat);
          wallMesh.position.set(...(wall.pos as [number, number, number]));
          wallMesh.castShadow = true;
          wallMesh.receiveShadow = true;
          scene.add(wallMesh);

          // Add doors
          if (wall.hasDoor && wall.doorPos) {
            const doorGeom = new THREE.BoxGeometry(0.9, 2.0, 0.08);
            const doorMesh = new THREE.Mesh(doorGeom, doorMat);
            doorMesh.position.set(...(wall.doorPos as [number, number, number]));
            doorMesh.castShadow = true;
            doorMesh.receiveShadow = true;
            scene.add(doorMesh);

            // Door handle
            const handleGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.1, 16);
            const handleMat = new THREE.MeshStandardMaterial({ color: 0xffd700 });
            const handle = new THREE.Mesh(handleGeom, handleMat);
            handle.rotation.z = Math.PI / 2;
            handle.position.set(
              (wall.doorPos[0] as number) + 0.35,
              (wall.doorPos[1] as number) - 0.3,
              (wall.doorPos[2] as number) + 0.1
            );
            handle.castShadow = true;
            scene.add(handle);
          }
        });

        // Windows on front wall
        if (room.w > 3) {
          const windowGeom = new THREE.BoxGeometry(0.8, 0.8, 0.12);
          const windowMat = new THREE.MeshStandardMaterial({
            color: 0x1e88e5,
            roughness: 0.2,
            metalness: 0.8,
          });

          const window1 = new THREE.Mesh(windowGeom, windowMat);
          window1.position.set(room.x - room.w / 3, 1.8, room.z - room.h / 2 - wallThickness / 2 - 0.06);
          window1.castShadow = true;
          scene.add(window1);

          const window2 = new THREE.Mesh(windowGeom, windowMat);
          window2.position.set(room.x + room.w / 3, 1.8, room.z - room.h / 2 - wallThickness / 2 - 0.06);
          window2.castShadow = true;
          scene.add(window2);
        }

        // Ceiling
        const ceilingGeom = new THREE.PlaneGeometry(room.w - wallThickness * 2, room.h - wallThickness * 2);
        const ceilingMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.8,
        });
        const ceiling = new THREE.Mesh(ceilingGeom, ceilingMat);
        ceiling.position.set(room.x, wallHeight - 0.02, room.z);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.receiveShadow = true;
        scene.add(ceiling);

        // Add furniture based on room type
        if (roomType === "bedroom") {
          const bedGeom = new THREE.BoxGeometry(1.4, 0.5, 2.0);
          const bedMat = new THREE.MeshStandardMaterial({ 
            color: 0xff6b6b,
            roughness: 0.5,
          });
          const bed = new THREE.Mesh(bedGeom, bedMat);
          bed.position.set(room.x - room.w / 4, 0.25, room.z);
          bed.castShadow = true;
          scene.add(bed);

          const tableGeom = new THREE.BoxGeometry(0.5, 0.6, 0.5);
          const tableMat = new THREE.MeshStandardMaterial({ 
            color: 0xb8860b,
            roughness: 0.6,
          });
          const table = new THREE.Mesh(tableGeom, tableMat);
          table.position.set(room.x - room.w / 2.5, 0.3, room.z - 1.0);
          table.castShadow = true;
          scene.add(table);
        } else if (roomType === "kitchen") {
          const counterGeom = new THREE.BoxGeometry(room.w * 0.35, 0.9, 0.6);
          const counterMat = new THREE.MeshStandardMaterial({ 
            color: 0xff9800,
            roughness: 0.5,
          });
          const counter = new THREE.Mesh(counterGeom, counterMat);
          counter.position.set(room.x + room.w / 3, 0.45, room.z - room.h / 3);
          counter.castShadow = true;
          scene.add(counter);

          const sinkGeom = new THREE.BoxGeometry(0.8, 0.2, 0.4);
          const sinkMat = new THREE.MeshStandardMaterial({ 
            color: 0x64b5f6,
            roughness: 0.3,
          });
          const sink = new THREE.Mesh(sinkGeom, sinkMat);
          sink.position.set(room.x + room.w / 3.5, 0.95, room.z - room.h / 2.5);
          sink.castShadow = true;
          scene.add(sink);
        } else if (roomType === "bathroom") {
          const tubGeom = new THREE.BoxGeometry(1.2, 0.5, 2.2);
          const tubMat = new THREE.MeshStandardMaterial({ 
            color: 0x4caf50,
            roughness: 0.5,
          });
          const tub = new THREE.Mesh(tubGeom, tubMat);
          tub.position.set(room.x - room.w / 3, 0.25, room.z);
          tub.castShadow = true;
          scene.add(tub);

          const toiletGeom = new THREE.BoxGeometry(0.4, 0.7, 0.6);
          const toiletMat = new THREE.MeshStandardMaterial({ 
            color: 0x9c27b0,
            roughness: 0.5,
          });
          const toilet = new THREE.Mesh(toiletGeom, toiletMat);
          toilet.position.set(room.x + room.w / 3, 0.35, room.z);
          toilet.castShadow = true;
          scene.add(toilet);

          const sinkGeom = new THREE.BoxGeometry(0.5, 0.8, 0.5);
          const sinkMat = new THREE.MeshStandardMaterial({ 
            color: 0x64b5f6,
            roughness: 0.3,
          });
          const sink = new THREE.Mesh(sinkGeom, sinkMat);
          sink.position.set(room.x, 0.4, room.z + room.h / 3);
          sink.castShadow = true;
          scene.add(sink);
        } else if (roomType === "living") {
          const sofaGeom = new THREE.BoxGeometry(2.5, 0.8, 1.0);
          const sofaMat = new THREE.MeshStandardMaterial({ 
            color: 0xf44336,
            roughness: 0.6,
          });
          const sofa = new THREE.Mesh(sofaGeom, sofaMat);
          sofa.position.set(room.x - room.w / 5, 0.4, room.z + room.h / 4);
          sofa.castShadow = true;
          scene.add(sofa);

          const tableGeom = new THREE.BoxGeometry(1.2, 0.4, 0.8);
          const tableMat = new THREE.MeshStandardMaterial({ 
            color: 0xb8860b,
            roughness: 0.6,
          });
          const table = new THREE.Mesh(tableGeom, tableMat);
          table.position.set(room.x, 0.2, room.z);
          table.castShadow = true;
          scene.add(table);
        } else if (roomType === "office") {
          const deskGeom = new THREE.BoxGeometry(1.6, 0.75, 0.8);
          const deskMat = new THREE.MeshStandardMaterial({ 
            color: 0x8b4513,
            roughness: 0.6,
          });
          const desk = new THREE.Mesh(deskGeom, deskMat);
          desk.position.set(room.x - room.w / 4, 0.375, room.z);
          desk.castShadow = true;
          scene.add(desk);

          const chairGeom = new THREE.BoxGeometry(0.5, 0.8, 0.5);
          const chairMat = new THREE.MeshStandardMaterial({ 
            color: 0x1976d2,
            roughness: 0.5,
          });
          const chair = new THREE.Mesh(chairGeom, chairMat);
          chair.position.set(room.x + room.w / 4, 0.4, room.z);
          chair.castShadow = true;
          scene.add(chair);
        }
      });

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.95);
      directionalLight.position.set(50, 70, 50);
      directionalLight.castShadow = true;
      directionalLight.shadow.camera.left = -100;
      directionalLight.shadow.camera.right = 100;
      directionalLight.shadow.camera.top = 100;
      directionalLight.shadow.camera.bottom = -100;
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      scene.add(directionalLight);

      // Rim light for clarity
      const rimLight = new THREE.DirectionalLight(0xd0dfff, 0.4);
      rimLight.position.set(-60, 50, -60);
      scene.add(rimLight);

      // Mouse controls
      const onMouseDown = (e: MouseEvent) => {
        isDraggingRef.current = true;
        previousMouseRef.current = { x: e.clientX, y: e.clientY };
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!isDraggingRef.current) return;
        const deltaX = e.clientX - previousMouseRef.current.x;
        const deltaY = e.clientY - previousMouseRef.current.y;
        camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), deltaX * 0.01);
        camera.position.y = Math.max(15, Math.min(80, camera.position.y + deltaY * 0.1));
        previousMouseRef.current = { x: e.clientX, y: e.clientY };
      };

      const onMouseUp = () => {
        isDraggingRef.current = false;
      };

      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const radius = Math.sqrt(camera.position.x ** 2 + camera.position.y ** 2 + camera.position.z ** 2);
        const newRadius = Math.max(30, Math.min(150, radius + e.deltaY * 0.05));
        if (radius > 0) {
          camera.position.multiplyScalar(newRadius / radius);
        }
      };

      renderer.domElement.addEventListener("mousedown", onMouseDown);
      renderer.domElement.addEventListener("mousemove", onMouseMove);
      renderer.domElement.addEventListener("mouseup", onMouseUp);
      renderer.domElement.addEventListener("mouseleave", onMouseUp);
      renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

      // Animation
      const animate = () => {
        animationIdRef.current = requestAnimationFrame(animate);
        renderer.render(scene, camera);
      };
      animate();

      // Resize
      const onResize = () => {
        if (!containerRef.current) return;
        const w = containerRef.current.clientWidth || 800;
        const h = containerRef.current.clientHeight || 500;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", onResize);

      return () => {
        window.removeEventListener("resize", onResize);
        renderer.domElement.removeEventListener("mousedown", onMouseDown);
        renderer.domElement.removeEventListener("mousemove", onMouseMove);
        renderer.domElement.removeEventListener("mouseup", onMouseUp);
        renderer.domElement.removeEventListener("mouseleave", onMouseUp);
        renderer.domElement.removeEventListener("wheel", onWheel);

        if (animationIdRef.current) {
          cancelAnimationFrame(animationIdRef.current);
        }

        try {
          if (container.firstChild) container.removeChild(container.firstChild);
        } catch (e) {
          console.warn("Cleanup error");
        }

        renderer.dispose();
      };
    } catch (error) {
      console.error("3D viewer error:", error);
    }
  }, [heightMapData]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "500px",
        borderRadius: "8px",
        border: "2px solid #d0d0d0",
        backgroundColor: "#fafafa",
        overflow: "hidden",
      }}
    />
  );
}
