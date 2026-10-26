# Bộ file IFC mẫu kiểm thử (Sample Files)

Tài liệu quản lý danh mục file IFC mẫu phục vụ kiểm thử tính năng đọc IFC, hiển thị đa mô hình (federated) và kiểm tra xung đột (clash detection).

## 1. Nguyên tắc bản quyền & License
- File mẫu nhỏ phân phối trực tiếp kèm bản web (`building-arch-2x3.ifc`, `building-struct-2x3.ifc`, `building-hvac-2x3.ifc`) thuộc bản quyền buildingSMART International trong bộ Simple-Scene, phát hành theo giấy phép Creative Commons Attribution 4.0 International (CC BY 4.0). Yêu cầu ghi nhận công trạng tác giả (attribution) rõ ràng trong ứng dụng.
- File mẫu `school-str.ifc` (8.20 MB) được phân phối trong thư mục `resources/ifc/` của kho `ThatOpen/engine_components`, thuộc bản quyền That Open Company theo giấy phép MIT License (đã kiểm tra trực tiếp file `LICENSE` tại thư mục gốc của repository `ThatOpen/engine_components`).
- Các file mẫu tải từ kho `ibpsa/project1-wp-2-2-bim` (`fzk-haus-ifc4.ifc`, `clinic-arch.ifc`, `clinic-struct.ifc`, `schependomlaan.ifc`): Repository gốc không có file LICENSE và README không đề cập điều khoản phân phối. Do đó, toàn bộ các file này được xếp vào diện: **Không rõ license — chỉ dùng để test nội bộ trong `samples-local/`, không commit, không phân phối**.
- Tuyệt đối không commit bất kỳ file mẫu nào > 10 MB vào Git repository. Các file kiểm thử cục bộ được lưu trong `samples-local/` (đã khai báo trong `.gitignore`).

## 2. Bảng danh mục file mẫu

| Tên file | Kích thước | Schema | Bộ môn | Phân nhóm | License | Nguồn tải | Ghi chú |
|---|---|---|---|---|---|---|---|
| `building-arch-2x3.ifc` | 90.4 KB | IFC2X3 | Architecture (Kiến trúc) | Nhỏ (< 5 MB) | Creative Commons Attribution 4.0 International (CC BY 4.0) | [Link](https://raw.githubusercontent.com/buildingSMART/Certification-datasets/main/IFC%202.3.0.1%20(IFC%202x3%20TC1)/Simple-Scene/Building-Architecture.ifc) | Mô hình kiến trúc tòa nhà đơn giản trong bộ dataset chuẩn buildingSMART Simple-Scene; cùng hệ tọa độ với building-struct-2x3. Ghi công tác giả: buildingSMART International. |
| `building-struct-2x3.ifc` | 106.5 KB | IFC2X3 | Structural (Kết cấu) | Nhỏ (< 5 MB) | Creative Commons Attribution 4.0 International (CC BY 4.0) | [Link](https://raw.githubusercontent.com/buildingSMART/Certification-datasets/main/IFC%202.3.0.1%20(IFC%202x3%20TC1)/Simple-Scene/Building-Structural.ifc) | Mô hình kết cấu cùng hệ tọa độ với building-arch-2x3, hoàn hảo để kiểm thử federated multi-model và clash detection. Ghi công tác giả: buildingSMART International. |
| `building-hvac-2x3.ifc` | 68.3 KB | IFC2X3 | MEP / HVAC (Cơ điện) | Nhỏ (< 5 MB) | Creative Commons Attribution 4.0 International (CC BY 4.0) | [Link](https://raw.githubusercontent.com/buildingSMART/Certification-datasets/main/IFC%202.3.0.1%20(IFC%202x3%20TC1)/Simple-Scene/Building-Hvac.ifc) | Hệ thống đường ống HVAC cùng công trình Simple-Scene, kiểm tra clash với dầm/cột kết cấu. Ghi công tác giả: buildingSMART International. |
| `fzk-haus-ifc4.ifc` | 2.41 MB | IFC4 | Architecture (Kiến trúc) | Nhỏ (< 5 MB) | Không rõ license — chỉ dùng để test nội bộ trong `samples-local/`, không commit, không phân phối | [Link](https://raw.githubusercontent.com/ibpsa/project1-wp-2-2-bim/master/IFC_Files/MISC/AC20-FZK-Haus.ifc) | Mẫu nhà chuẩn FZK-Haus xuất từ ArchiCAD sang IFC4, dùng kiểm thử độ tương thích schema IFC4. |
| `school-str.ifc` | 8.20 MB | IFC2X3 | Structural (Kết cấu) | Vừa (8.6 MB) | MIT (That Open Company - repo ThatOpen/engine_components, đã đối chiếu file LICENSE tại root repo) | [Link](https://raw.githubusercontent.com/ThatOpen/engine_components/main/resources/ifc/school_str.ifc) | Mô hình kết cấu trường học dùng trong tutorial chính thức của That Open Engine (OBC.IfcLoader). |
| `clinic-arch.ifc` | 12.60 MB | IFC2X3 | Architecture (Kiến trúc) | Vừa (13.2 MB) | Không rõ license — chỉ dùng để test nội bộ trong `samples-local/`, không commit, không phân phối | [Link](https://raw.githubusercontent.com/ibpsa/project1-wp-2-2-bim/master/IFC_Files/MISC/2011-09-14-Clinic-IFC/Clinic_A_20110906_optimized.ifc) | Mô hình kiến trúc bệnh viện đa tầng (IBPSA Project 1), bộ dữ liệu chuẩn kiểm thử hiệu năng. |
| `clinic-struct.ifc` | 18.48 MB | IFC2X3 | Structural (Kết cấu) | Vừa (19.4 MB) | Không rõ license — chỉ dùng để test nội bộ trong `samples-local/`, không commit, không phân phối | [Link](https://raw.githubusercontent.com/ibpsa/project1-wp-2-2-bim/master/IFC_Files/MISC/2011-09-14-Clinic-IFC/Clinic_S_20110715_optimized.ifc) | Mô hình kết cấu bệnh viện ghép cặp với clinic-arch, kiểm tra clash trên công trình quy mô thực tế. |
| `schependomlaan.ifc` | 62.06 MB | IFC2X3 | Architecture (Kiến trúc) | Lớn (65.1 MB) | Không rõ license — chỉ dùng để test nội bộ trong `samples-local/`, không commit, không phân phối | [Link](https://raw.githubusercontent.com/ibpsa/project1-wp-2-2-bim/master/IFC_Files/MISC/Schependomlaan.ifc) | Dự án khu dân cư Schependomlaan nổi tiếng của Hà Lan, model chuẩn để benchmark hiệu năng và bộ nhớ. |

## 3. Bảng mã băm kiểm chứng (SHA-256)

| Tên file | Kích thước (bytes) | SHA-256 Checksum |
|---|---|---|
| `building-arch-2x3.ifc` | 92542 | `c4db65ba847f6b369a95d6c54fa11f4750cbe6d59f021934e8923d8d578e5885` |
| `building-struct-2x3.ifc` | 109012 | `25c09f1ea35dbf51e88b8829c423b9ce13a8264e69c620e932859772937aa25b` |
| `building-hvac-2x3.ifc` | 69893 | `f39478ce12ae2029eed8b565551412a3a4b518d10a8b501bc5e9c2a8a6d78bdb` |
| `fzk-haus-ifc4.ifc` | 2526544 | `ea6f04eaf92fac4d7ad0038bc3d2dfea4c094dd3f516ecc33c50bf1835ca108d` |
| `school-str.ifc` | 8593426 | `82c3406c11cdf83a7ad00e2155bdcfdef50877e491e780623824161d8955b340` |
| `clinic-arch.ifc` | 13208096 | `b90fe57b8aa9329d762a564770e697d4f7357677484e3a78ede4ab6d2163c0c0` |
| `clinic-struct.ifc` | 19375987 | `3351ee3bd19aea39167ba466237fe06de64ea391b0a31b0aacc017c84311e14d` |
| `schependomlaan.ifc` | 65078748 | `57fafa59f03b18c05be211a456e346bdd0445d5c35d66522e598d339e81dfcf4` |

## 4. Các cặp mô hình kiểm tra xung đột (Clash Detection)
1. **Bộ nhỏ chuẩn (Fast tests & CI/E2E):**
   - Tập A: `building-arch-2x3.ifc` (Kiến trúc)
   - Tập B: `building-struct-2x3.ifc` (Kết cấu)
   - Đặc điểm: Cùng xuất xứ dataset `Simple-Scene` của buildingSMART, cùng gốc tọa độ, thời gian nạp dưới 1 giây.
2. **Bộ vừa thực tế (Realistic Benchmark):**
   - Tập A: `clinic-arch.ifc` (Kiến trúc bệnh viện đa tầng)
   - Tập B: `clinic-struct.ifc` (Kết cấu bệnh viện)
   - Đặc điểm: Công trình nhiều tầng phức tạp, dầm, cột, sàn, tường giao cắt thực tế.

## 5. Hướng dẫn tải lại dữ liệu mẫu
Chạy lệnh sau từ thư mục `apps/Jnn.Web`:
```bash
node scripts/fetch-samples.mjs
```
