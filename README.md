# Class Management System

Hệ thống quản lý lớp học dành cho gia sư và các lớp học nhỏ.

## Công nghệ sử dụng

- Frontend: React, TypeScript, Vite
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL
- ORM: Prisma

## Yêu cầu môi trường

Cài đặt trước:

- Node.js (LTS)
- npm
- Docker Desktop (nếu chạy PostgreSQL bằng Docker)

## Cài đặt và khởi chạy

### 1. Clone repository

```bash
git clone <repository-url>
cd class-management-system
```

### 2. Cài đặt dependencies

Chạy tại thư mục gốc dự án:

```bash
npm install
```

### 3. Cấu hình môi trường

Tạo file `.env` dựa trên `.env.example`:

```bash
cp .env.example .env
```

Cập nhật các biến môi trường trong `.env`, đặc biệt là `DATABASE_URL` và các biến xác thực.

### 4. Khởi chạy PostgreSQL

Nếu dự án sử dụng Docker Compose:

```bash
docker compose up -d
```

### 5. Khởi tạo database

Chạy migration Prisma:

```bash
npm run db:migrate
```

Nếu dự án có dữ liệu mẫu:

```bash
npm run db:seed
```

### 6. Chạy ứng dụng

Mở terminal tại thư mục gốc và chạy frontend:

```bash
npm run dev:web
```

Mở một terminal khác để chạy backend:

```bash
npm run dev:api
```

Frontend và backend sẽ chạy tại các địa chỉ được cấu hình trong terminal hoặc file cấu hình môi trường.

## Các lệnh thường dùng

| Lệnh | Mô tả |
|---|---|
| `npm install` | Cài đặt dependencies |
| `npm run dev:web` | Chạy frontend |
| `npm run dev:api` | Chạy backend |
| `npm run build` | Build các workspace |
| `npm run db:migrate` | Chạy database migrations |
| `npm run db:seed` | Nạp dữ liệu mẫu |
| `npm run db:studio` | Mở Prisma Studio |

## Ghi chú

- Chạy các lệnh npm ở thư mục gốc, trừ khi có hướng dẫn khác.
- Không commit file `.env` hoặc thông tin bí mật lên Git.
- Các lệnh trên phụ thuộc vào scripts được khai báo trong `package.json`. Nếu cấu trúc hoặc scripts của dự án thay đổi, hãy cập nhật README tương ứng.
