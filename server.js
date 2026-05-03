const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = "my_verify_token";

// 🔴 ضع توكن الصفحة هنا
const PAGE_TOKEN = "EAAjDyjJrkvYBReRjj3KTZCOeyGT7ZADe6y81WXdlpMlBfLTUqGuupZCh052OmQCpqvY2wpseLLgOOBaNLUhRZBPwlYZAx2bOA2IvFmaxviFAC3wtWsyOxDdpc4RiqL1BYrZBdigk9Ev2hHqqEgeIg0ZAx9yO4HJNB24NN2QfgNnrVPiXhypev2zga0G3mvVlJ3IYbuZB6AZDZD";

// 🔴 ضع توكن الإعلانات هنا
const ADS_TOKEN = "EAAjDyjJrkvYBRVZAYAtdIudfMh7hDZBJVRHTv8GK9c8NPPpoYxSFNFZBE5rFzemN3XwyrBIIXvQ6kWH7fw1m6iE0i9rwxLyZCTkm8jFwN3O25HhKzYxqhd75ABlEEWkgQ8ZATPXa8wsnMLfHeg3rUHwLK3ReYqggOrZBTvyZC4oHDvgfJjsTCFEov1w29aJ1wZDZD";

// 🔴 حسابك الإعلاني
const AD_ACCOUNT_ID = "act_1639079020410757";

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

// استقبال webhook
app.post("/webhook", (req, res) => {
  const db = loadDB();
  const body = req.body;

  if (body.object === "page") {
    body.entry?.forEach(entry => {
      entry.messaging?.forEach(event => {
        const sender = event.sender?.id;

        if (!sender) return;

        if (event.referral) {
          db.users[sender] = {
            ad_id: event.referral.ad_id || "unknown"
          };
          saveDB(db);
        }
      });
    });

    return res.status(200).send("OK");
  }

  res.sendStatus(404);
});

// فحص الرسائل
app.get("/check", async (req, res) => {
  try {
    const db = loadDB();

    const convRes = await axios.get(
      `https://graph.facebook.com/v18.0/me/conversations?fields=id&access_token=${PAGE_TOKEN}`
    );

    for (const convo of convRes.data.data || []) {
      const msgRes = await axios.get(
        `https://graph.facebook.com/v18.0/${convo.id}/messages?fields=message,from,created_time,id&limit=20&access_token=${PAGE_TOKEN}`
      );

      for (const msg of msgRes.data.data || []) {
        if ((msg.message || "").includes("تم الحجز")) {

          if (db.bookings.find(b => b.message_id === msg.id)) continue;

          const userId = msg.from?.id;
          const userData = db.users[userId] || {};

          db.bookings.push({
            message_id: msg.id,
            time: msg.created_time,
            ad_id: userData.ad_id || "unknown"
          });

          saveDB(db);
        }
      }
    }

    res.redirect("/report");

  } catch (err) {
    console.log(err.message);
    res.send("Error");
  }
});

// تقرير احترافي
app.get("/report", async (req, res) => {
  try {
    const db = loadDB();

    const adsRes = await axios.get(
      `https://graph.facebook.com/v18.0/${AD_ACCOUNT_ID}/insights?fields=ad_id,ad_name,campaign_name,spend&access_token=${ADS_TOKEN}`
    );

    const stats = {};

    db.bookings.forEach(b => {
      if (!stats[b.ad_id]) stats[b.ad_id] = { bookings: 0 };
      stats[b.ad_id].bookings++;
    });

    (adsRes.data.data || []).forEach(ad => {
      if (!stats[ad.ad_id]) stats[ad.ad_id] = { bookings: 0 };

      stats[ad.ad_id].name = ad.ad_name;
      stats[ad.ad_id].campaign = ad.campaign_name;
      stats[ad.ad_id].spend = parseFloat(ad.spend || 0);
    });

    let rows = "";

    for (const ad in stats) {
      const s = stats[ad];
      const cpa = s.bookings ? (s.spend / s.bookings).toFixed(2) : 0;

      rows += `
        <tr>
          <td>${ad}</td>
          <td>${s.name || "unknown"}</td>
          <td>${s.campaign || "unknown"}</td>
          <td>${s.bookings}</td>
          <td>${s.spend || 0}</td>
          <td>${cpa}</td>
        </tr>
      `;
    }

    res.send(`
      <html dir="rtl">
      <body style="background:#111;color:#fff;font-family:Arial;padding:20px;">
        <h2>📊 تقرير الإعلانات</h2>
        <table border="1" style="width:100%;text-align:center;">
          <tr>
            <th>Ad ID</th>
            <th>اسم الإعلان</th>
            <th>الحملة</th>
            <th>الحجوزات</th>
            <th>الصرف</th>
            <th>CPA</th>
          </tr>
          ${rows}
        </table>
      </body>
      </html>
    `);

  } catch (err) {
    console.log(err.message);
    res.send("Error");
  }
});

app.listen(8080, () => console.log("Server running"));
