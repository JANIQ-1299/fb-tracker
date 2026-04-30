const express = require("express");
const app = express();

app.use(express.json());

const VERIFY_TOKEN = "123";

let users = {}; // تخزين مصدر الزبون

// تحقق Webhook
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// استقبال الرسائل
app.post("/webhook", (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    body.entry.forEach(entry => {
      entry.messaging?.forEach(event => {

        const sender = event.sender?.id;

        // 🔥 حفظ مصدر الإعلان
        if (event.referral) {
          users[sender] = {
            source: event.referral.ref || "اعلان",
            ad_id: event.referral.ad_id || "غير معروف"
          };

          console.log("📥 زبون جديد من اعلان:", users[sender]);
        }

        // 🔥 عند تم الحجز
        if (event.message?.text?.includes("تم الحجز")) {
          const userData = users[sender];

          console.log("🔥 تم الحجز من:", userData);
        }

      });
    });

    return res.sendStatus(200);
  }

  res.sendStatus(404);
});

// عرض النتائج
app.get("/results", (req, res) => {
  res.json(users);
});

app.listen(3000, () => {
  console.log("Server running...");
});