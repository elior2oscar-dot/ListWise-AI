# מדריך Deploy — ListWise AI

מדריך זה מניח שסיימת את השלבים ב-[SETUP_GUIDE.md](SETUP_GUIDE.md) (חשבון Shopify Partner, מפתח OpenAI).

## שלב 1: חבר את האפליקציה לחשבון Partner שלך

בתוך תיקיית `listwise-ai`:

```shell
npm run config:link
```

זה ייצור client_id אמיתי בקובץ `shopify.app.toml` ויקשר את הפרויקט לאפליקציה בחשבון Partner שלך (אם אין אפליקציה, ה-CLI ייצור אחת).

## שלב 2: בדיקה מקומית מול חנות פיתוח

```shell
npm run dev
```

לחץ `p` בטרמינל כדי לפתוח את האפליקציה בדפדפן ולהתקין אותה על חנות הפיתוח שלך. בדוק שהיצירה (Generate) עובדת (דורש `OPENAI_API_KEY` בקובץ `.env`).

## שלב 3: יצירת Repository ב-GitHub

```shell
git init
git add .
git commit -m "Initial commit: ListWise AI"
```

צור repository חדש (ריק) ב-GitHub, ואז:

```shell
git remote add origin https://github.com/<your-username>/listwise-ai.git
git branch -M main
git push -u origin main
```

## שלב 4: Deploy ל-Render (מומלץ, יש קובץ render.yaml מוכן)

1. היכנס ל-https://render.com והתחבר עם GitHub
2. New > Blueprint > בחר את ה-repository `listwise-ai`
3. Render יזהה את `render.yaml` ויציע ליצור אוטומטית: Web Service + PostgreSQL database
4. לפני ה-deploy, מלא את משתני הסביבה המסומנים כ-`sync: false`:
   - `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET` (מ-`shopify.app.toml` / Partner Dashboard)
   - `SHOPIFY_APP_URL` (כתובת ה-URL הציבורית שRender ייתן לשירות, לדוגמה `https://listwise-ai.onrender.com` - אפשר למלא אחרי ה-deploy הראשון ולעשות deploy שוב)
   - `OPENAI_API_KEY`
5. לחץ Apply — Render יבנה את ה-Docker image, יריץ `npm run docker-start` (שמכין את מסד הנתונים ב-PostgreSQL אוטומטית ומריץ את השרת)

## שלב 5: עדכון כתובת האפליקציה ב-Shopify

לאחר קבלת כתובת ה-URL הציבורית מ-Render:

```shell
# עדכן SHOPIFY_APP_URL בקובץ .env ובמשתני הסביבה ב-Render
npm run deploy
```

זה מעדכן את הגדרות האפליקציה (redirect URLs, webhooks) בצד Shopify כך שיתאימו לכתובת החדשה.

## שלב 6: הגשה ל-Shopify App Store

1. ב-Partner Dashboard, פתח את האפליקציה > "Distribution" > "Shopify App Store"
2. מלא את פרטי הרישום לפי הטיוטה ב-[`../marketing/app-store-listing.md`](../marketing/app-store-listing.md)
3. הוסף צילומי מסך (לפי הרשימה במסמך) ופרטי תמיכה
4. הגש לבדיקה (review) - התהליך אצל Shopify יכול לקחת כמה ימים עד שבועות

## אלטרנטיבה: Railway

זהה בעקרון ל-Render: חבר GitHub repo, הוסף PostgreSQL plugin, הגדר את אותם משתני סביבה, ו-Railway יבנה אוטומטית מה-`Dockerfile`.
