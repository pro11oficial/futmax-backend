const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// TESTE
app.get("/", (req, res) => {
  res.send("Backend FutMax rodando");
});

// CRIAR PIX (Mercado Pago)
app.post("/pix", async (req, res) => {
  try {
    const response = await axios.post(
      "https://api.mercadopago.com/v1/payments",
      {
        transaction_amount: 10,
        description: "FutMax Premium",
        payment_method_id: "pix",
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

    res.json(response.data);
  } catch (err) {
    res.status(400).json(err.response?.data || err.message);
  }
});

// WEBHOOK
app.post("/webhook", async (req, res) => {
  console.log("WEBHOOK RECEBIDO:", req.body);
  res.sendStatus(200);
});

app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
});