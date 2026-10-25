# B — Backend (`services/Jnn.Api`, `services/Jnn.Worker`, PostgreSQL)

Geometry **không** lưu trong DB quan hệ; DB chỉ chứa metadata và tham chiếu file.

---

### [ ] B-01 · Khung ASP.NET Core .NET 10 — **S** ☁
- **Làm:** minimal API, `/health`, OpenAPI, cấu hình qua options, structured logging. `docker-compose.yml` gồm Postgres (pin image tag).
- **Xong khi:** chạy được `dotnet run` và có test `/health`. *(Cần cài .NET 10 SDK trong container. Nếu không cài được thì ghi rõ và chuyển sang 🪟.)*

### [ ] B-02 · EF Core model + migrations — **M** ☁ · phụ thuộc B-01
- **Làm:** các bảng Project, Model, Revision, StoredFile, ImportJob. Migration đầu tiên, seed dữ liệu dev.

### [ ] B-03 · Xác thực + phân quyền — **M** ☁
- **Làm:** JWT/OIDC (chọn provider ở đầu task, mặc định là JWT phát hành nội bộ cho dev); role theo project.

### [ ] B-04 · File storage abstraction — **S** ☁
- **Làm:** interface `IFileStore` với bản Local làm trước; S3/Azure để sau. Signed URL có hạn dùng.

### [ ] B-05 · Upload + import job + SignalR progress — **M** ☁ · phụ thuộc B-02, B-04, M4-09
- **Làm:** upload IFC, đưa job vào queue, worker gọi `jnn-ifc convert`, progress đi qua SignalR, hủy được job.

### [ ] B-06 · Project Home UI — **M** ☁ · phụ thuộc B-02
- **Làm:** màn hình danh sách project/model/revision gọi API thật (không dùng mock), mở model vào viewer.

### [ ] B-07 · Integration tests `tests/Jnn.Api.Tests` — **S** ☁ · phụ thuộc B-02
- **Làm:** WebApplicationFactory với Postgres thật qua Testcontainers (nếu container có Docker) hoặc service CI.

### [ ] B-08 · Import screen UI — **S** ☁ · phụ thuộc B-05
- **Làm:** kéo thả file, thanh tiến trình, hiển thị cảnh báo import.
