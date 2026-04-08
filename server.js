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
  try {
    const { userId, email } = req.body;

    if (!userId || !email) {
      return res.status(400).json({ error: "userId e email obrigatórios" });
    }

    const pagamento = await axios.post(
      "https://api.mercadopago.com/v1/payments",
      {
        transaction_amount: 10,
        description: "FutMax Premium",
        payment_method_id: "pix",
        payer: {
          email: email
        },
        metadata: {
          userId: userId
        }
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "X-Idempotency-Key": Date.now().toString()
        }
      }
    );

    const data = pagamento.data;

    res.json({
      qr_code: data.point_of_interaction.transaction_data.qr_code,
      qr_code_base64:
        data.point_of_interaction.transaction_data.qr_code_base64,
      payment_id: data.id
    });

  } catch (err) {
    console.log(err.response?.data || err.message);
    res.status(500).json({ error: "Erro ao criar Pix" });
  }
});

// ================= WEBHOOK =================
app.post("/webhook", async (req, res) => {
  try {
    const payment = req.body;

    if (payment.type === "payment") {
      const paymentId = payment.data.id;

      const result = await axios.get(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: {
            Authorization: `Bearer ${ACCESS_TOKEN}`
          }
        }
      );

      const pagamento = result.data;

      if (pagamento.status === "approved") {
        const userId = pagamento.metadata.userId;

        await db.collection("users").doc(userId).set(
          {
            premium: true,
            plan: "premium",
            expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
          },
          { merge: true }
        );

        console.log("✅ Usuário liberado:", userId);
      }
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
