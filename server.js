const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = "my_verify_token";

// ✅ التوكن جاهز (لا تشاركه مرة ثانية)
const PAGE_TOKEN = "EAAjDyjJrkvYBRWvOcB2WcAIesLpqax8nHHcVqHSL90KINZAXB1dDReszCtfROM3xPa5lye45BXfsvzqDincYvNRhnRwrVJ7ZBMHJAeN2NqBMU407Vn493pkyctGDZBmEUgUM2TqOrTq5Y8vTsAgRu4o77qFr0AJyifmhVydbEJj3VZC4dFqD5f8b7ZCtrKZAiZAvJ4EXwZDZD";

const DB_FILE = "./db.json";

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: {}, bookings: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// الصفحة الرئيسية
app.get("/", (req, res) => {
  res.send("FB Tracker is running");
});

// التحقق من webhook
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.status(403).send("Forbidden");
});

// استقبال الأحداث من فيسبوك
app.post("/webhook", (req, res) => {
  const db = loadDB();
  const body = req.body;

  if (body.object === "page") {
    body.entry?.forEach((entry) => {
      entry.messaging?.forEach((event) => {
        const sender = event.sender?.id;
        if (!sender) return;

        // حفظ مصدر الإعلان
        if (event.referral) {
          db.users[sender] = {
            ref: event.referral.ref || "unknown",
            ad_id: event.referral.ad_id || "unknown",
            time: new Date().toISOString()
          };
          saveDB(db);
        }
      });
    });

    return res.status(200).send("EVENT_RECEIVED");
  }

  return res.sendStatus(404);
});

// 🔥 فحص الرسائل (حتى رسائلك أنت)
app.get("/check", async (req, res) => {
  try {
    const db = loadDB();

    const convRes = await axios.get(
      `https://graph.facebook.com/v18.0/me/conversations?fields=id,participants&access_token=${PAGE_TOKEN}`
    );

    const conversations = convRes.data.data || [];

    for (const convo of conversations) {
      const msgRes = await axios.get(
        `https://graph.facebook.com/v18.0/${convo.id}/messages?fields=message,from,created_time,id&limit=10&access_token=${PAGE_TOKEN}`
      );

      const messages = msgRes.data.data || [];

      for (const msg of messages) {
        const text = msg.message || "";

        if (text.includes("تم الحجز")) {
          const exists = db.bookings.find((b) => b.message_id === msg.id);
          if (exists) continue;

          const booking = {
            message_id: msg.id,
            conversation_id: convo.id,
            text,
            from: msg.from?.name || "unknown",
            time: msg.created_time,
            source: "غير معروف"
          };

          db.bookings.push(booking);
          saveDB(db);

          console.log("🔥 NEW BOOKING:", booking);
        }
      }
    }

    res.redirect("/results");
  } catch (err) {
    console.log(err.response?.data || err.message);
    res.send("Error checking messages");
  }
});

// صفحة عرض النتائج
app.get("/results", (req, res) => {
  const db = loadDB();

  let rows = db.bookings.map((b, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${b.time || ""}</td>
      <td>${b.from || ""}</td>
      <td>${b.text || ""}</td>
      <td>${b.source || "غير معروف"}</td>
      <td>${b.conversation_id || ""}</td>
    </tr>
  `).join("");

  res.send(`
    <html dir="rtl">
    <head>
      <meta charset="UTF-8" />
      <title>نتائج الحجوزات</title>
      <style>
        body { font-family: Arial; background:#111; color:#fff; padding:30px; }
        table { width:100%; border-collapse: collapse; margin-top:20px; }
        th, td { border:1px solid #444; padding:10px; }
        th { background:#222; }
        a { background:#0d6efd; color:#fff; padding:10px 15px; text-decoration:none; border-radius:6px; }
      </style>
    </head>
    <body>
      <h1>📊 نتائج الحجوزات</h1>
      <a href="/check">تحديث النتائج</a>
      <h3>عدد الحجوزات: ${db.bookings.length}</h3>
      <table>
        <tr>
          <th>#</th>
          <th>الوقت</th>
          <th>المرسل</th>
          <th>النص</th>
          <th>المصدر / الفيديو</th>
          <th>المحادثة</th>
        </tr>
        ${rows}
      </table>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});
