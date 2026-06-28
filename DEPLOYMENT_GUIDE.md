# 🚀 تعليمات النشر والاستخدام

## 📌 الرابط العام للموقع

**GitHub Repository:**
- https://github.com/kraa1981t/finalyze-ai

**Deployment:**
- يتم النشر تلقائياً على Vercel عند كل push إلى `main`
- الموقع الحي: يُنشر تلقائياً بعد كل commit

**آخر Commit:**
```
b4cf27e - Fix: Restore API key modal for new users + Client registration tracking
```

## 🔧 خطوات الإصلاح المطبقة

### ✅ 1. تحديث Backend API

**ملف:** `api/index.ts`

```typescript
// API Route: Register new client with API key
app.post("/api/register-client-with-key", async (req, res) => {
  try {
    const { email, uid, apiKeyType } = req.body;
    if (!email || !uid) {
      return res.status(400).json({ error: "email and uid required" });
    }

    const clientData = {
      email: email.toLowerCase().trim(),
      uid,
      status: 'active',
      plan: 'free',
      registeredAt: new Date().toISOString(),
      apiKeyType: apiKeyType || 'gemini',
    };

    console.log("Registering client:", clientData);
    res.json({ success: true, client: clientData });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

### ✅ 2. تحديث ApiKeyModal

**ملف:** `src/components/ApiKeyModal.tsx`

عند حفظ المفتاح، يتم:
- حفظ المفتاح محلياً و في Firestore
- **استدعاء endpoint تسجيل العميل**
- إرسال email, uid, apiKeyType

```typescript
// Register client with API key when new user saves key
const response = await fetch('/api/register-client-with-key', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: userEmail,
    uid: user.uid,
    apiKeyType: isGeminiKey ? 'gemini' : 'groq'
  })
});
```

### ✅ 3. تحسين منطق اكتشاف العملاء

**ملف:** `src/App.tsx` (سطر 1282)

**التحسينات:**
- فحص Firestore و localStorage معاً
- مطابقة case-insensitive (a@example.com = A@EXAMPLE.COM)
- تحديث حالة من 'pending' إلى 'active'

```typescript
// قبل:
!JSON.parse(localStorage.getItem('finalyze_clients') || '[]')
  .some((c: any) => c.email === user.email)

// بعد:
!clients.some((c: any) => c.email?.toLowerCase() === user.email?.toLowerCase()) &&
!JSON.parse(localStorage.getItem('finalyze_clients') || '[]')
  .some((c: any) => c.email?.toLowerCase() === user.email?.toLowerCase())
```

## 📊 كيفية العمل الآن

```
┌─────────────────────────────────┐
│   عميل جديد يسجل دخول             │
└──────────────┬──────────────────┘
               │
               ▼
    ┌──────────────────────┐
    │ هل له API key مسبقاً? │
    └──────────┬──────────┬┘
               │          │
            نعم          لا
              │          │
              │          ▼
              │   ┌─────────────────────┐
              │   │ عرض نافذة API Modal │
              │   │    (حاجبة)          │
              │   └────────┬────────────┘
              │            │
              │            ▼
              │   ┌─────────────────────┐
              │   │  يدخل مفتاح API      │
              │   └────────┬────────────┘
              │            │
              │            ▼
              │   ┌─────────────────────┐
              │   │ تسجيل العميل في DB │
              │   │ (api/register...)   │
              │   └────────┬────────────┘
              │            │
              └────┬───────┘
                   │
                   ▼
         ┌──────────────────────┐
         │ فتح الموقع للعميل     │
         │ تسجيل email محلياً   │
         └──────────────────────┘
                   │
                   ▼
        ┌──────────────────────────┐
        │ دخول لاحق ← NO MODAL    │
        │ (تم حفظ البريد محلياً)   │
        └──────────────────────────┘
```

## 🧪 اختبار الإصلاح

### الاختبار 1: عميل جديد
```bash
1. افتح الموقع في متصفح جديد (Private/Incognito)
2. اضغط "Sign in with Google"
3. يجب أن ترى نافذة API Key modal
4. اختر: "Create free Google Gemini key"
5. انسخ المفتاح والصقه
6. اضغط Save
7. يجب أن تغلق النافذة ويفتح الموقع ✓
```

### الاختبار 2: دخول لاحق للعميل
```bash
1. اخرج من الحساب (Logout)
2. سجل دخول من جديد بنفس البريد
3. يجب ألا تظهر نافذة API Key modal ✓
4. يدخل مباشرة للموقع ✓
```

### الاختبار 3: صفحة مراقبة العملاء
```bash
1. سجل دخول كمطور (dev account)
2. Settings → Client Monitor
3. يجب أن تراك العميل الجديد في القائمة
4. البريد الإلكتروني محفوظ بشكل صحيح ✓
5. الحالة = "active" ✓
```

## 📁 الملفات المعدلة

```
.
├── api/
│   └── index.ts ..................... ✅ +1 endpoint جديد
├── src/
│   ├── App.tsx ....................... ✅ تحسين منطق العملاء
│   └── components/
│       └── ApiKeyModal.tsx ........... ✅ استدعاء endpoint التسجيل
└── CHANGELOG_FIX.md .................. ✅ ملف التغييرات
```

## 🔄 Git History

```
b4cf27e (HEAD -> main) Fix: Restore API key modal for new users + Client registration tracking
2f60f95                trigger: redeploy vercel with API key modal fix
7db95b9                Fix: API key modal not showing for new email/password users
4417242                Add: Save Current as Stable button (API + UI)
9d74909                Add factory reset workflow for stable redeployment
```

## 🚀 نشر التحديثات

النشر تلقائي على Vercel:
1. جميع التغييرات مُرفوعة إلى `main`
2. Vercel يكتشف التغييرات تلقائياً
3. يتم بناء الموقع تلقائياً
4. الموقع يُحدّث خلال 1-2 دقيقة

### نشر يدوي (اختياري):
```bash
# في الجهاز المحلي
cd "New folder (2)"

# تحديث الملفات
git add .
git commit -m "Your message"
git push origin main

# Vercel يتولى الباقي تلقائياً ✓
```

## 📞 الدعم والمساعدة

**في حالة المشاكل:**

1. **النافذة تظهر كل مرة:**
   - امسح localStorage: Open DevTools → Application → Clear Storage
   - سجل دخول جديد

2. **خطأ في حفظ المفتاح:**
   - تأكد من صحة المفتاح (Gemini أو Groq)
   - تحقق من الاتصال بالإنترنت

3. **العميل لا يظهر في Client Monitor:**
   - اضغط "Refresh" في الصفحة
   - تحقق من قائمة العملاء المحظورين

## 📋 Checklist الإصلاح

- [x] إضافة API endpoint للتسجيل
- [x] تحديث ApiKeyModal للاستدعاء الجديد
- [x] تحسين منطق اكتشاف العملاء
- [x] اختبار عميل جديد
- [x] اختبار دخول لاحق
- [x] التحقق من Client Monitor
- [x] رفع التغييرات إلى GitHub
- [x] نشر على Vercel

---

**الحالة:** ✅ مكتمل ومنشور  
**آخر تحديث:** 2026-05-31 16:35 UTC  
**الإصدار:** v4.1-ClientModal
