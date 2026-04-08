const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();
const admin = require("firebase-admin");

const app = express();
app.use(express.json());

const serviceAccount = require("./firebase-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

app.use(cors());
app.use(express.json());
let users = {};

// TESTE
app.get("/", (req, res) => {
  res.send("Backend FutMax rodando");
});

// CRIAR PIX (Mercado Pago)
app.get("/pix", async (req, res) => {
  const user_id = Date.now();

  // 👉 AQUI SALVA NO FIREBASE
  await db.collection("users").doc(user_id.toString()).set({
    status: "pending",
    created_at: new Date()
  });

  try {
    const response = await axios.post(
      "https://api.mercadopago.com/v1/payments",
      {
        transaction_amount: 10,
        description: "FutMax Premium",
        payment_method_id: "pix",
        external_reference: user_id.toString(),
        payer: {
          email: "test@test.com"
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": Date.now().toString()
        }
      }
    );

    res.json({
      user_id,
      ...response.data
    });

  } catch (err) {
    res.status(500).json(err.response?.data || err.message);
  }
});

// WEBHOOK
app.post("/webhook", async (req, res) => {
  try {
    const paymentId = req.body.data.id;

    const response = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`
        }
      }
    );

    const payment = response.data;
    const user_id = payment.external_reference;

    if (payment.status === "approved") {

      // 👉 AQUI ATUALIZA NO FIREBASE
      await db.collection("users").doc(user_id).update({
        status: "approved",
        approved_at: new Date()
      });

      console.log("USUÁRIO LIBERADO:", user_id);
    }

  } catch (err) {
    console.log(err.response?.data || err.message);
  }

  res.sendStatus(200);
});

app.get("/status/:user_id", async (req, res) => {
  const doc = await db.collection("users").doc(req.params.user_id).get();

  if (!doc.exists) {
    return res.json({ status: "not_found" });
  }

  res.json(doc.data());
});

app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
});
