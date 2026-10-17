# JNN Geometry Cache Binary Format Specification (JGC v1)

## 1. Overview
Large BIM models containing millions of triangles cannot be transported efficiently via standard JSON. The **JNN Geometry Cache (`.jgc`)** format is a high-speed, binary chunked format inspired by glTF 2.0 binary and IFC fragments.

## 2. Binary Layout

```
+-------------------------------------------------------------+
| Header (32 bytes)                                           |
| - Magic: 'JNNG' (4 bytes uint32)                            |
| - Schema Version: 1 (uint32)                                |
| - Element Count (uint32)                                    |
| - Vertex Count (uint32)                                     |
| - Index Count (uint32)                                      |
| - Source Hash: SHA-256 (16 bytes truncated)                 |
+-------------------------------------------------------------+
| Element Index Table (ElementCount * 64 bytes)               |
| - Element ID Hash (uint64)                                  |
| - Category Enum (uint16)                                    |
| - Storey Index (uint16)                                     |
| - Vertex Offset (uint32), Vertex Count (uint32)             |
| - Index Offset (uint32), Index Count (uint32)               |
| - Bounding Box AABB: min[3], max[3] (6 * float32)           |
+-------------------------------------------------------------+
| Vertex Buffer (Float32 Array: X, Y, Z, Nx, Ny, Nz)          |
+-------------------------------------------------------------+
| Index Buffer (Uint32 Array: Triangles)                      |
+-------------------------------------------------------------+
```

## 3. Performance Characteristics
- Zero-copy deserialization directly into WebGL/WebGPU `Float32Array` buffers.
- Fast spatial frustum culling using the embedded AABB table without parsing vertex buffers.
