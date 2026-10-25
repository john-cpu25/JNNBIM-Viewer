# M4 — IFC Adapter (`integrations/IfcOpenShell`, `services/Jnn.IfcWorker`, Python 3.12)

Python chỉ đóng vai adapter và orchestration. **Không truyền vertices qua JSON.**
IfcOpenShell theo giấy phép LGPL, nên chạy như process riêng.

---

### [ ] M4-01 · Đặc tả cache bundle v1 — **M** ☁ (làm đầu tiên, các task khác dựa vào đây)
- **Đọc trước:** `contracts/schemas/jnn-element.schema.json`, `docs/Architecture.md`
- **Làm:** `contracts/cache-format/README.md` + `manifest.schema.json`. Manifest gồm schemaVersion, sourceHash (sha256), adapterVersion, tessellation settings, transform, units, createdAt, validation status, danh sách chunk. Binary chunk: header magic + version, little-endian, positions float32, indices uint32, bảng range theo element id.
- **Xong khi:** có một fixture nhỏ dựng tay (2 element) nằm trong `contracts/cache-format/fixtures/`.

### [ ] M4-02 · Reader cache bundle trong web — **M** ☁ · phụ thuộc M4-01
- **Làm:** `apps/Jnn.Web/src/cache/readBundle.ts` (ArrayBuffer → mesh theo element), kiểm tra version và hash header. Adapter thêm đường `loadModel` dùng mesh thật bên cạnh box primitive.
- **Xong khi:** Vitest đọc fixture đúng. Hiển thị được qua drag-drop file `.jnnbundle`.

### [ ] M4-03 · Package Python + pin IfcOpenShell — **S** ☁
- **Làm:** `pyproject.toml` (python 3.12, pin `ifcopenshell` version đã xác minh cài được qua pip), CLI `jnn-ifc inspect <file>` in schema, số element và số storey; cấu hình pytest.
- **Xong khi:** `pip install -e . && pytest` đạt. Ghi version thật vào `docs/License-Inventory.md`.

### [ ] M4-04 · File IFC mẫu tham chiếu — **S** 🔑
- **Làm:** chọn 2–3 file IFC có license cho phép dùng (IFC2X3 và IFC4; ưu tiên file mẫu của IfcOpenShell hoặc buildingSMART, kiểm tra license), hoặc **bạn cung cấp file thật**. Lưu vào `tests/fixtures/ifc/` kèm README nêu nguồn và license.

### [ ] M4-05 · Trích xuất metadata → JNN contract — **M** ☁ · phụ thuộc M4-03, M4-04
- **Làm:** map IfcProduct sang element (GlobalId, category theo IFC class, type, material, storey qua `IfcRelContainedInSpatialStructure`, property sets). Output JSON được validate bằng Pydantic, khớp `jnn-element.schema.json`.
- **Xong khi:** pytest so sánh số element và các field mẫu với giá trị biết trước.

### [ ] M4-06 · Native quantities (Qto_*) — **S** ☁ · phụ thuộc M4-05
- **Làm:** đọc `IfcElementQuantity` thành quantities `origin: native`, chuẩn hóa đơn vị.

### [ ] M4-07 · Tessellation → binary chunks — **M** ☁ · phụ thuộc M4-01, M4-05
- **Làm:** `ifcopenshell.geom.iterator` (settings ghi vào manifest, cho phép chạy đa luồng), ghi chunk theo spec. Element lỗi thì gắn `geometryStatus` và importWarning, không làm dừng cả job.
- **Xong khi:** bundle đọc được bằng reader của M4-02 (test chéo Python → TS).

### [ ] M4-08 · Validation report — **S** ☁
- **Làm:** báo cáo JSON gồm số element thành công/lỗi, cảnh báo theo loại, thời gian từng giai đoạn. Hiển thị trong Properties (model summary).

### [ ] M4-09 · Jnn.IfcWorker job runner — **M** ☁ · phụ thuộc M4-07
- **Làm:** CLI `jnn-ifc convert in.ifc out_dir --progress jsonl`. Hỗ trợ cancel qua tín hiệu hoặc file, exit code rõ ràng. Đây là nền cho M2-08 và B-05.

### [ ] M4-10 · Nối bundle → geometry core — **S** ☁ · phụ thuộc M3-08, M4-07
- **Làm:** C# đọc bundle, dựng BVH native, chạy broad-phase trên model IFC thật. Ghi số đo vào docs.
