const express = require("express");
const app = express();

app.use(express.json());

// ✅ التوكن لازم يكون نفسه في Meta
const VERIFY_TOKEN = "my_verify_token";

// 🧠 تخزين مؤقت لمصدر الزبون (الإعلان)
let users = {};

// 🔗 التحقق من Webhook (مهم جداً)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    return res.status(200).send(challenge);
  } else {
    console.log("❌ Verification failed");
    return res.sendStatus(403);
  }
});

// 📩 استقبال الرسائل من Messenger
app.post("/webhook", (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    body.entry.forEach((entry) => {
      entry.messaging.forEach((event) => {
        const sender = event.sender.id;

        // 🔥 حفظ مصدر الإعلان (الفيديو/الحملة)
        if (event.referral) {
          users[sender] = {
            source: event.referral.ref || "اعلان",
            ad_id: event.referral.ad_id || "غير معروف",
          };

          console.log("🎯 زبون جاء من إعلان:", users[sender]);
        }

        // 🔥 عند كتابة "تم الحجز"
        if (event.message && event.message.text?.includes("تم الحجز")) {
          const userData = users[sender];

          console.log("🔥 تم الحجز من:", userData);
        }
      });
    });

    return res.sendStatus(200);
  }

  res.sendStatus(404);
});

// 🚀 تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});
