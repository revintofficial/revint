# 3D assets (GLB models)

This folder is reserved for GLB/GLTF models used by `ThreeStage`-powered
scenes. It is intentionally empty on first checkout.

## Current status

`primitives/ProductModel.tsx` ships with a proxy model built from R3F
primitives (rounded boxes, cylinders, emissive planes). The scenes that
use it (AppleShowcase, 05-mockup-flip, 07-pipeline if upgraded) render
correctly without any files here.

## Adding a real model

1. Export or download a `.glb` (embedded textures) at a reasonable poly
   count (< 50k tris). Target sizes:
   - `phone.glb`     — phone body with separable child meshes for:
                      `Body`, `Screen`, `CameraModule`, `Chip`
   - `audit-card.glb` — glassy card with a `Score` child mesh
2. Drop it in this folder.
3. In `primitives/ProductModel.tsx`, swap the proxy for:

   ```tsx
   const { scene } = useGLTF('/models/phone.glb')
   // then animate mesh positions via scene.getObjectByName('Screen').position.lerp(...)
   ```

   The `exploded: 0..1` API stays identical so scene code does not change.

## Remotion + publicDir caveat

`remotion.config.ts` sets `publicDir` to `../captures`. To expose GLBs to
`useGLTF` via `staticFile()`, the recommended path is:

```
captures/
  models/
    phone.glb
    audit-card.glb
```

Then load with `staticFile('models/phone.glb')`. Alternatively, add a
second static folder by placing the models under `../captures/models/`
and keeping this directory for source files.
