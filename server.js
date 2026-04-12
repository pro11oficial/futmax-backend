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
  const { userId, email } = req.body;

  try {
    const payment = await axios.post(
      "https://api.mercadopago.com/v1/payments",
      {
        transaction_amount: 1,
        description: "FutMax Premium",
        payment_method_id: "pix",
        payer: {
          email: email
        },
        metadata: {
          userId: userId
        },
        notification_url: "https://futmax-backend.onrender.com/webhook",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
          "X-Idempotency-Key": Date.now().toString()
        }
      }
    );

    const data = payment.data;

    res.json({
      qr_code_base64:
        data.point_of_interaction.transaction_data.qr_code_base64,
      qr_code:
        data.point_of_interaction.transaction_data.qr_code,
      ticket_url:
        data.point_of_interaction.transaction_data.ticket_url
    });

  } catch (error) {
    console.log("ERRO PIX:", error.response?.data || error.message);
    res.status(500).json({ error: "Erro ao criar Pix" });
  }
});

app.get("/comprar", async (req, res) => {
  const userId = req.query.userId || "teste123";

  const pagamento = await axios.post(
    "https://api.mercadopago.com/v1/payments",
    {
      transaction_amount: 10,
      description: "FutMax Premium",
      payment_method_id: "pix",
      payer: {
        email: "teste@email.com"
      },
      metadata: {
        userId: userId
      }
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
        "X-Idempotency-Key": Date.now().toString()
      }
    }
  );

  const data = pagamento.data;

  const qr = data.point_of_interaction.transaction_data.qr_code_base64;

  res.send(`
    <h1>Pague com Pix</h1>
    <img src="data:image/png;base64,${qr}" />
    <p>Após pagar, volte para o app.</p>
  `);
});

// ================= WEBHOOK =================
app.post("/webhook", async (req, res) => {
  try {
    console.log("WEBHOOK:", req.body);

    const paymentId =
      req.body?.data?.id ||
      req.body?.id ||
      req.body?.resource;

    if (!paymentId) {
      console.log("❌ paymentId não encontrado");
      return res.sendStatus(200);
    }

    const response = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.ACCESS_TOKEN}`
        }
      }
    );

    const data = response.data;

    console.log("METADATA:", data.metadata);

    if (data.status === "approved") {
      const userId = data.metadata?.userId;

      if (!userId) {
        console.log("❌ userId não encontrado");
        return res.sendStatus(200);
      }

      await db.collection("users").doc(userId).set({
        premium: true
      });

      console.log("✅ Premium liberado:", userId);
    }

    res.sendStatus(200);

  } catch (error) {
    console.log("ERRO WEBHOOK:", error.message);
    res.sendStatus(500);
  }
});
// ================= INICIAR SERVIDOR =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor rodando na porta", PORT);
});
