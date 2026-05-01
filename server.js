const express = require("express");
const app = express();

app.use(express.json());

const VERIFY_TOKEN = "my_verify_token";
const users = {};

app.get("/", (req, res) => {
  res.status(200).send("FB Tracker is running");
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
  const body = req.body;

  if (body.object === "page") {
    body.entry?.forEach((entry) => {
      entry.messaging?.forEach((event) => {
        const sender = event.sender?.id || event.recipient?.id;
        if (!sender) return;

        if (event.referral) {
          users[sender] = {
            ref: event.referral.ref || "unknown",
            ad_id: event.referral.ad_id || "unknown",
            time: new Date().toISOString()
          };

          console.log("SOURCE:", users[sender]);
        }

        const text = event.message?.text || "";

        if (text.includes("تم الحجز")) {
          console.log("BOOKING:", {
            sender,
            source: users[sender] || null,
            text,
            time: new Date().toISOString()
          });
        }
      });
    });

    return res.status(200).send("EVENT_RECEIVED");
  }

  return res.sendStatus(404);
});

app.get("/results", (req, res) => {
  res.json(users);
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});
