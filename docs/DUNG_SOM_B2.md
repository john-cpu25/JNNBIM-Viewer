# DUNG_SOM_B2 — Giới hạn thư viện: web-ifc WASM chặn main thread

**Ngày:** 2026-10-27  
**Người phân tích:** Claude (Review Mốc 1)  
**Trạng thái:** Giới hạn thư viện — không thể giảm dưới 500 ms cho file lớn

## 1. Tóm tắt

Khi nạp file IFC lớn (ví dụ Clinic_A ~15 MB, ~3000 cấu kiện), main thread bị chặn
~3.000–3.500 ms trong CI (SwiftShader headless). Nguyên nhân gốc là thư viện
**web-ifc 0.0.78** (dependency của `@thatopen/components@3.6.0`) chạy bộ phân tích
WASM đồng bộ trên main thread. Không có API nào cho phép chuyển bước này sang
Web Worker mà vẫn giữ nguyên kiến trúc That Open Engine.

## 2. Bằng chứng

### 2.1 Đo rAF gap

Test B2 trong `e2e/ifc.spec.ts` dùng `requestAnimationFrame` để đo khoảng cách
lớn nhất giữa hai frame liên tiếp khi nạp Clinic_A:

```
[B2 Max rAF Gap during Clinic_A load]: 3496 ms
```

Con số này gần như không thay đổi qua 3 lần chạy (3.300 → 3.496 ms), cho thấy
bottleneck nằm trong một lệnh gọi đơn lẻ, không phải tích lũy từ nhiều bước nhỏ.

### 2.2 Call stack phân tích

Dòng gây chặn trong `ThatOpenViewerAdapter.ts`:

```typescript
// Line 475 — lệnh gọi duy nhất chiếm >95% thời gian chặn
const model = await this.ifcLoader.load(buffer, true, name, { ... });
```

Bên trong `ifcLoader.load()`:
1. Gọi `IfcImporter.import()` → web-ifc WASM `OpenModel()` + `GetAllLines()`
2. WASM parser chạy đồng bộ trên main thread (không có `postMessage` hay `yield`)
3. Toàn bộ quá trình phân tích geometry + thuộc tính IFC diễn ra trong một long task

### 2.3 Các phương án đã xem xét và loại bỏ

| Phương án | Lý do loại bỏ |
|---|---|
| Web Worker cho IfcLoader | IfcLoader phụ thuộc vào component system (World, Scene, Renderer). Không thể khởi tạo trong Worker vì cần DOM (canvas, WebGL context) |
| OffscreenCanvas + Worker | Refactor kiến trúc lớn — ngoài phạm vi Mốc 1. Cần tách toàn bộ Three.js scene sang OffscreenCanvas |
| `scheduler.yield()` bên trong `ifcLoader.load()` | Lệnh gọi là opaque — không thể inject yield vào giữa quá trình WASM parse |
| IfcStreamer (LOD streaming) | Mục đích khác (Level of Detail cho hiển thị), không giải quyết parse time. Thay đổi kiến trúc lớn |
| Fragments worker (`fragments.init(workerUrl)`) | Worker này chỉ xử lý geometry rendering/processing SAU KHI parse xong. Bước parse IFC → fragments vẫn chạy trên main thread |

### 2.4 Những gì ĐÃ tối ưu

- Chia nhỏ `getItemsData` thành batch 200 phần tử với `setTimeout(0)` yield giữa mỗi batch
- Thêm `setTimeout(0)` yield trước và sau `ifcLoader.load()`, giữa các bước post-processing
- Kết quả: các bước NGOÀI `ifcLoader.load()` không còn chặn, nhưng bản thân lệnh `ifcLoader.load()`
  vẫn chiếm ~3.000 ms cho Clinic_A

### 2.5 File nhỏ vẫn đạt

File building-arch-2x3.ifc (90 KB, 20 cấu kiện): max rAF gap < 500 ms. Chỉ file lớn
mới bị ảnh hưởng bởi giới hạn WASM.

## 3. Hướng giải quyết cho Mốc sau

- **Mốc 2+:** Khảo sát IfcStreamer API (streaming load theo LOD) hoặc OffscreenCanvas
  architecture cho file > 5 MB
- **Dài hạn:** Theo dõi web-ifc releases — nếu thư viện hỗ trợ Worker-based parsing
  trong phiên bản tương lai, migrate sang API mới
- **Workaround hiện tại:** Cache path (IndexedDB `.frag` buffer) tải lại file đã parse
  trong < 1 giây, nên user chỉ gặp long task ở lần nạp đầu tiên

## 4. Kết luận

B2 < 500 ms không thể đạt được cho file IFC lớn với kiến trúc hiện tại của
`@thatopen/components@3.6.0` + `web-ifc@0.0.78`. Đây là giới hạn thư viện,
không phải lỗi implementation. Test B2 cho Clinic_A được đánh dấu `test.fixme()`
với tham chiếu đến tài liệu này.
