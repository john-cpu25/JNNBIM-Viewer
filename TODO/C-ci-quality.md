# C — CI & chất lượng

### [ ] C-01 · GitHub Actions cho web — **S** ☁
- **Làm:** `.github/workflows/web.yml` chạy `npm ci`, typecheck, vitest, build, playwright (chromium); upload trace khi fail.

### [ ] C-02 · CI native — **S** ☁ · phụ thuộc M3-01
- **Làm:** matrix ubuntu (gcc/clang) và windows (MSVC), chạy ctest, upload artifact DLL.

### [ ] C-03 · CI .NET — **S** ☁ · phụ thuộc M2-03 hoặc B-01
- **Làm:** `dotnet test` trên ubuntu; build WPF trên windows-latest.

### [ ] C-04 · ESLint + Prettier cho web — **S** ☁
- **Làm:** pin version, cấu hình tối thiểu (react-hooks, typescript-eslint), sửa toàn bộ cảnh báo.

### [ ] C-05 · Theo dõi benchmark — **S** ☁ · phụ thuộc M3-06
- **Làm:** lưu JSON benchmark thành artifact; cảnh báo khi kết quả chậm hơn >20% so với baseline.
