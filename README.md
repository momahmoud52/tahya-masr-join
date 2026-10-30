# اتحاد طلاب تحيا مصر: نظام الانضمام

## هيكل المشروع
```
index.html            صفحة الاستمارة + لوحة الأدمن/HR
result.html           صفحة نتيجة المقابلة (منفصلة)
assets/css/main.css   كل التنسيقات
assets/js/
  config.js           إعدادات Supabase واللوجو (الملف الوحيد الذي تعدله)
  client.js           إنشاء اتصال Supabase
  utils.js            دوال مساعدة
  data.js             المحافظات واللجان ومعايير التقييم
  loader.js           اللودر واللوجو وأيقونة التبويب
  form.js             استمارة الانضمام
  result.js           الاستعلام عن النتيجة (يُحمّل في result.html فقط)
  admin.js            لوحة الأدمن/HR
  stats.js            لوحة الإحصائيات
  profile.js          البروفايل وتقييم HR
database/schema.sql   قاعدة البيانات والصلاحيات
```
ترتيب تحميل ملفات JS داخل index.html مهم، لا تغيّره.

## التشغيل
1. شغّل `database/schema.sql` في Supabase > SQL Editor.
2. أنشئ مستخدمي الأدمن وHR من Authentication، وأضفهم في جدول `staff` (التعليمات آخر ملف schema.sql).
3. عدّل `assets/js/config.js` (SUPA_URL و SUPA_KEY) وضع `logo.png` بجانب index.html.
4. ارفع المجلد كاملاً على أي استضافة ثابتة (Netlify / Vercel / GitHub Pages).
