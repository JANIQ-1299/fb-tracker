const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = "my_verify_token";

const PAGE_TOKEN = "EAAjDyjJrkvYBReRjj3KTZCOeyGT7ZADe6y81WXdlpMlBfLTUqGuupZCh052OmQCpqvY2wpseLLgOOBaNLUhRZBPwlYZAx2bOA2IvFmaxviFAC3wtWsyOxDdpc4RiqL1BYrZBdigk9Ev2hHqqEgeIg0ZAx9yO4HJNB24NN2QfgNnrVPiXhypev2zga0G3mvVlJ3IYbuZB6AZDZD";

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

app.get("/", (req, res) => {
  res.send("FB Tracker is running");
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.status(403).send("Forbidden");
});

app.post("/webhook", (req, res) => {
  const db = loadDB();
  const body = req.body;

  if (body.object === "page") {
    body.entry?.forEach((entry) => {
      entry.messaging?.forEach((event) => {
        const sender = event.sender?.id;
        if (!sender) return;

        if (event.referral) {
          db.users[sender] = {
            ref: event.referral.ref || "unknown",
            ad_id: event.referral.ad_id || "unknown",
            time: new Date().toISOString()
          };

          saveDB(db);
          console.log("SOURCE SAVED:", db.users[sender]);
        }
      });
    });

    return res.status(200).send("EVENT_RECEIVED");
  }

  return res.sendStatus(404);
});

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

          const userId = msg.from?.id;
          const userData = userId ? db.users[userId] : null;

          const adId = userData?.ad_id || "unknown";
          const source = userData?.ref || adId || "unknown";

          const booking = {
            message_id: msg.id,
            conversation_id: convo.id,
            text,
            from: msg.from?.name || "unknown",
            user_id: userId || "unknown",
            time: msg.created_time,
            ad_id: adId,
            source
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

app.get("/results", (req, res) => {
  const db = loadDB();

  const summary = {};

  db.bookings.forEach((b) => {
    const date = b.time ? new Date(b.time).toISOString().split("T")[0] : "unknown";
    const ad = b.ad_id || "unknown";

    if (!summary[date]) summary[date] = {};
    if (!summary[date][ad]) summary[date][ad] = 0;

    summary[date][ad]++;
  });

  let summaryRows = "";

  Object.keys(summary).sort().reverse().forEach((date) => {
    Object.keys(summary[date]).forEach((ad) => {
      summaryRows += `
        <tr>
          <td>${date}</td>
          <td>${ad}</td>
          <td>${summary[date][ad]}</td>
        </tr>
      `;
    });
  });

  let rows = db.bookings.slice().reverse().map((b, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${b.time || ""}</td>
      <td>${b.from || ""}</td>
      <td>${b.text || ""}</td>
      <td>${b.ad_id || "unknown"}</td>
      <td>${b.source || "unknown"}</td>
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
        h1, h2, h3 { margin: 10px 0; }
        table { width:100%; border-collapse: collapse; margin-top:20px; margin-bottom:35px; }
        th, td { border:1px solid #444; padding:10px; text-align:center; }
        th { background:#222; }
        a { background:#0d6efd; color:#fff; padding:10px 15px; text-decoration:none; border-radius:6px; display:inline-block; }
      </style>
    </head>
    <body>
      <h1>📊 نتائج الحجوزات</h1>
      <a href="/check">تحديث النتائج</a>
      <h3>عدد الحجوزات: ${db.bookings.length}</h3>

      <h2>📈 إحصائيات يومية حسب الإعلان</h2>
      <table>
        <tr>
          <th>التاريخ</th>
          <th>Ad ID</th>
          <th>عدد الحجوزات</th>
        </tr>
        ${summaryRows}
      </table>

      <h2>📩 جميع الحجوزات</h2>
      <table>
        <tr>
          <th>#</th>
          <th>الوقت</th>
          <th>المرسل</th>
          <th>النص</th>
          <th>Ad ID</th>
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
