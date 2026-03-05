# Deploy AyaLearning: Vercel + Render

## Chuẩn Bị Trước Khi Deploy

### 1. Tài Khoản & API Keys
- [ ] Vercel account (vercel.com)
- [ ] Render account (render.com)
- [ ] Google Cloud Console project với OAuth 2.0 Client ID (Web application)
- [ ] Gemini API key (nếu dùng voice/chat AI)

### 2. Git Repository
- [ ] Push code lên GitHub repo
  ```bash
  git add .
  git commit -m "Ready for production deploy"
  git push origin main
  ```

---

## Bước 1: Deploy Backend + Services trên Render (Blueprint)

### 1.1 Render Blueprint Deploy

1. Vào [https://dashboard.render.com/](https://dashboard.render.com/)
2. Click **+ New** → **Blueprint**
3. Chọn repo chứa project
4. Render sẽ phát hiện `render.yaml` ở root
5. Click **Create**
6. Chọn **Custom name** cho blueprint instance (ví dụ: `aya-learning-prod`)
7. Click **Deploy**

> **Lưu ý**: Blueprint sẽ tạo:
> - PostgreSQL instance (`aya-postgres`)
> - Backend Web Service (`aya-backend`)
> - Voicevox Private Service (`voicevox`)
> - ASR Private Service (`asr-service`)

### 1.2 Sau Khi Deploy Xong

1. Vào **aya-backend** service → **Settings**
2. Copy domain (ví dụ: `https://aya-backend-abc123.onrender.com`)
3. Vào **Environment** → tìm `GOOGLE_CALENDAR_REDIRECT_URI`
4. Sửa giá trị thành `https://aya-backend-<your-id>.onrender.com/api/assistant/calendar/oauth/callback`
5. Click **Save** → Backend tự redeploy

### 1.3 Set Secret Environment Variables

1. Vào **aya-backend** service → **Environment**
2. Click **Add Environment Variable**
3. Thêm từng biến:

| Key | Value |
|-----|-------|
| `GOOGLE_CLIENT_ID` | `<your-google-oauth-client-id>` |
| `GOOGLE_CLIENT_SECRET` | `<your-google-oauth-secret>` |
| `GOOGLE_ALLOWED_CLIENT_IDS` | `<your-google-oauth-client-id>` |
| `GEMINI_API_KEY` | `<your-gemini-key>` (nếu dùng) |
| `OPENROUTER_API_KEY` | `<your-openrouter-key>` (nếu dùng) |
| `FRONTEND_URL` | `https://your-frontend.vercel.app` (sau khi deploy Vercel) |

4. Mỗi lần thêm → backend tự redeploy

### 1.4 Chạy Schema Database (One-off Job)

1. Vào **aya-backend** → **Settings** → **One-off Comands**
2. Click **+ Run Command**
3. Nhập: `node runSqlFile.js schema.base.sql`
4. Click **Start**
5. Chờ xong (trong logs sẽ thấy "Schema initialized")

---

## Bước 2: Deploy Frontend trên Vercel

### 2.1 Import Project Vercel

1. Vào [https://vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository**
3. Chọn repo chứa project
4. Click **Import**

### 2.2 Configure Vercel Deployment

1. **Project Name**: `aya-learning` (hay tên khác tùy thích)
2. **Framework Preset**: React
3. **Root Directory**: `frontend`
4. **Build Command**: `npm run build`
5. **Output Directory**: `build`
6. Click **Environment Variables**

### 2.3 Thêm Environment Variables Vercel

| Key | Value |
|-----|-------|
| `REACT_APP_BACKEND_URL` | `https://aya-backend-<your-id>.onrender.com` |
| `REACT_APP_GOOGLE_CLIENT_ID` | `<your-google-oauth-client-id>` |

7. Click **Deploy**

> Chờ ~2-3 phút deploy xong. Copy frontend domain (ví dụ: `https://aya-learning.vercel.app`)

### 2.4 Update Backend FRONTEND_URL

1. Vào Render → **aya-backend** → **Environment**
2. Tìm `FRONTEND_URL` → sửa thành frontend domain Vercel
3. **Save** → backend redeploy

---

## Bước 3: Cấu Hình Google OAuth Console

1. Vào [Google Cloud Console](https://console.cloud.google.com/)
2. Vào project → **APIs & Services** → **Credentials**
3. Tìm OAuth 2.0 Client (Web application)
4. Click **Edit**

### 3.1 Authorized JavaScript Origins

Thêm:
```
https://aya-learning.vercel.app
https://aya-learning-<your-project>.vercel.app  (nếu có preview domain khác)
```

### 3.2 Authorized Redirect URIs

Thêm:
```
https://aya-backend-<your-id>.onrender.com/auth/google/callback
https://aya-backend-<your-id>.onrender.com/api/assistant/calendar/oauth/callback
```

5. Click **Save**

---

## Bước 4: Test Deploy

### 4.1 Test Frontend
- Vào `https://aya-learning.vercel.app`
- Nên thấy login page
- Thử click "Sign in with Google" (check console nếu có lỗi CORS)

### 4.2 Test Backend
- Terminal: `curl https://aya-backend-<your-id>.onrender.com/api/kaiwa/voice-status`
- Nên trả JSON với status Voicevox, ASR

### 4.3 Test Database
- Vào Render → **aya-postgres** → **Connect** → **Browser** 
- Hoặc từ terminal (psql):
  ```bash
  psql postgresql://aya_user:PASSWORD@host:5432/japanese_learning
  SELECT * FROM users LIMIT 1;
  ```

---

## Troubleshooting

### Frontend Login Lỗi "Invalid Client ID"
- Check `REACT_APP_GOOGLE_CLIENT_ID` đúng không
- Check Google Cloud: Authorized origin có chứa frontend domain không

### Backend Lỗi "CORS Error"
- Check `FRONTEND_URL` trong Render backend env đúng không
- Check [backend/server.js](../backend/server.js#L22) `FRONTEND_URL` biến này dùng cho CORS

### Voicevox/ASR Không Hoạt động
- Vào Render → tìm service (voicevox / asr-service)
- Check **Logs** → có lỗi gì không
- Nếu image không tìm thấy: quay lại [Bước 1.1](step-1-1) xem có redeploy lỗi gì

### Deploy Render Lỗi "Image Pull Failed"
- Voicevox image: kiểm tra Docker Hub có `voicevox/voicevox_engine:latest` không
- ASR service: kiểm tra [backend/asr-service/Dockerfile](../asr-service/Dockerfile) có đúng không, hoặc thử dùng pre-built image từ GitHub Packages

---

## File quan trọng

- [render.yaml](../render.yaml) - Blueprint để deploy toàn bộ backend stack
- [frontend/.env.example](../frontend/.env.example) - Mẫu env frontend
- [backend/.env.example](../backend/.env.example) - Mẫu env backend (nếu có)

---

## Cleanup / Rollback

Nếu muốn xóa:

1. Render: **Dashboard** → Service → **Settings** → **Delete Service** (danger zone)
2. Vercel: **Settings** → **Delete Project** (danger zone)

---

**Done!** 🎉 Aya Learning giờ đã live trên Vercel + Render.
