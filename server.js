const express = require("express");
const app = express();

app.use(express.json());

const VERIFY_TOKEN = "my_verify_token";
const users = {};

app.get("/", (req, res) => {
  res.send("FB Tracker is running");
});

// ✅ تحقق webhook
app.get("/webhook", (req, res) => {
  try {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
  } catch (err) {
    console.error("Webhook GET Error:", err);
    return res.sendStatus(500);
  }
});

// ✅ استقبال الرسائل
app.post("/webhook", (req, res) => {
  try {
    const body = req.body;

    if (body.object === "page") {
      body.entry?.forEach((entry) => {
        entry.messaging?.forEach((event) => {
          const sender = event.sender?.id;

          if (!sender) return;

          if (event.referral) {
            users[sender] = {
              ref: event.referral.ref || "unknown",
              ad_id: event.referral.ad_id || "unknown",
              time: new Date().toISOString()
            };

            console.log("🔥 مصدر:", users[sender]);
          }

          const text = event.message?.text || "";

          if (text.includes("تم الحجز")) {
            console.log("💰 تم حجز من:", {
              sender,
              source: users[sender] || null
            });
          }
        });
      });

      return res.sendStatus(200);
    }

    return res.sendStatus(404);
  } catch (err) {
    console.error("Webhook POST Error:", err);
    return res.sendStatus(500);
  }
});

// 👇 مهم جداً
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port", PORT);
});
