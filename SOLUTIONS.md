# حلول المشاكل المتكررة

## 1. الصفحة الحاجبة لمفتاح API — مشكلة وحلها النهائي

### المشكلة
المستخدمين القدامى (سجلوا من قبل + أدخلوا مفتاح) يشوفون صفحة المفتاح الحاجبة عند تسجيل الدخول مجدداً.

### السبب الجذري
`finalyze_clients` (المصدر الوحيد لتحديد "مستخدم مسجل") كان يُكتب في `handleLogin` مبكراً قبل إدخال المفتاح، مما سبب ارتباكاً في المنطق. كما أن session restoration لم يكن يمسح `needsApiKey` للمستخدمين بلا مفتاح.

### الحل النهائي (3 قواعد فقط)

#### أ. شرط العرض (render guard)
```
user && user.email && !hasApiKey && !isDeveloperSession() &&
  !JSON.parse(localStorage.getItem('finalyze_clients') || '[]')
    .some((c: any) => c.email === user.email)
```
- `user.email`: يمنع المستخدم المجهول (anon) من تشغيل الشرط
- `!hasApiKey`: عنده مفتاح → لا تظهر
- `!isDeveloperSession()`: مطور → لا تظهر
- `!finalyze_clients.some(...)`: إميله مسجل في `finalyze_clients` → لا تظهر
  - **`finalyze_clients` لا يُكتب إلا عند إدخال المفتاح** في `onSaved`، وليس في `handleLogin`

#### ب. `finalyze_clients` يُكتب فقط في `onSaved` (عند إدخال المفتاح)
- تُحذف كل كتابات `finalyze_clients` من `handleLogin`:
  - مسار pending: لا يُكتب (يُكتب لاحقاً في onSaved)
  - مسار catch inner: لا يُكتب
  - مسار catch outer: لا يُكتب
- `onSaved` في `ApiKeyModal` هو الوحيد الذي يكتب في `finalyze_clients` (localStorage + Firestore)
- `fetchClients()` يُستدعى بعد الحفظ لتحديث `clients` state

#### ج. `handleLogin` يحفظ فقط في Firestore (وليس localStorage)
```
addDoc/updateDoc(collection(db, 'clients'), { email, uid, status: 'pending', ... })
```
هذا يخلي Client Monitor (الذي يجمع Firestore + localStorage) يرى كل المستخدمين، لكن `finalyze_clients` يبقى فارغاً للمستخدم الجديد.

### التدفق الصحيح
```
مستخدم جديد ← Google login ← handleLogin ← يظهر له overlay المفتاح
                            ↓ يدخل المفتاح
                     onSaved: يكتب finalyze_clients + Firestore
                            ↓
                     session restoration: finalyze_clients فيه الإميل
                            ↓
                     شرط العرض: !finalyze_clients.some = false ← لا تظهر
```

### طريقة التطبيق السريع
```bash
# 1. شرط العرض
sed -i 's/{user && !hasApiKey && needsApiKey && !isDeveloperSession()/{user \&\& user.email \&\& !hasApiKey \&\& !isDeveloperSession() \&\& !JSON.parse(localStorage.getItem("finalyze_clients") || "[]").some((c: any) => c.email === user.email)/' src/App.tsx

# 2. حذف كل saves إلى finalyze_clients من handleLogin (اترك Firestore فقط)
# pending path: احذف pendingClient object و existingLocal.push/setItem
# catch inner: احذف allClients save
# catch outer: احذف allClients save

# 3. onSaved في ApiKeyModal يكتب finalyze_clients (موجود بالفعل في الكود الأصلي)
```

---

## 2. فشل نشر Vercel من PowerShell

### المشكلة
`npm exec vercel deploy -- --prod --yes` يتطلب تفاعل أو يعطي أخطاء.

### الحل
```bash
cmd /c "npm exec vercel deploy -- --prod --yes"
```
يجب لف الأمر بـ `cmd /c "..."` لتجنب مشاكل PowerShell مع `--`.

---

## 3. Firebase rules تمنع الكتابة في `clients`

### المشكلة
`addDoc(collection(db, 'clients'), ...)` يفشل بسبب rules.

### الحل
نشر rules في Firebase Console:
```
match /clients/{clientId} {
  allow read, create, update, delete: if auth != null;
}
```
أو استخدام service account في API backend إذا كان الحذف من المطور فقط.
