const express = require("express");
const axios = require("axios");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();
app.use(cors());
app.use(express.json());

// ================= FIREBASE =================
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ================= CONFIG =================
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

// ================= ROTA TESTE =================
app.get("/", (req, res) => {
  res.send("Servidor rodando");
});

// ================= CRIAR PIX =================
app.post("/pix", async (req, res) => {
  const { userId, email, plan } = req.body;

  let amount = 10;

  if (plan === "yearly") {
    amount = 100;
  }

  try {
    const payment = await axios.post(
      "https://api.mercadopago.com/v1/payments",
      {
        transaction_amount: amount,
        description: `FutMax ${plan}`,
        payment_method_id: "pix",
        payer: {
          email: email
        },
        metadata: {
          user_id: userId,
          plan: plan
        },
        notification_url: "https://futmax-backend.onrender.com/webhook"
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.ACCESS_TOKEN}`
        }
      }
    );

    const data = payment.data;

    res.json({
      ticket_url:
        data.point_of_interaction.transaction_data.ticket_url
    });

  } catch (err) {
    console.log(err.response?.data || err);
    res.status(500).send("Erro ao criar PIX");
  }
});

// ================= WEBHOOK =================
app.post("/webhook", async (req, res) => {
  try {
    const paymentId = req.body.data?.id;

    if (!paymentId) return res.sendStatus(200);

    const response = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.ACCESS_TOKEN}`
        }
      }
    );

    const payment = response.data;

    if (payment.status === "approved") {
      const userId = payment.metadata.user_id;
      const plan = payment.metadata.plan;

      await db.collection("subscriptions").doc(userId).set({
        status: "active",
        plan: plan,
        updatedAt: new Date()
      });

      console.log("✅ Premium liberado:", userId, plan);
    }

    res.sendStatus(200);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});
// ================= INICIAR SERVIDOR =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor rodando na porta", PORT);
});
