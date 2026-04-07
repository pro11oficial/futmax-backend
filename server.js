const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();

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

  users[user_id] = {
   status: "pending"
  };
  try {
    const response = await axios.post(
      "https://api.mercadopago.com/v1/payments",
      {
        transaction_amount: 10,
        description: "FutMax Premium",
        payment_method_id: "pix",
        payer: {
          email: "rodrigoscherner9.com"
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
    res.status(400).json(err.response?.data || err.message);
  }
});

// WEBHOOK
app.post("/webhook", async (req, res) => {
  console.log("WEBHOOK RECEBIDO:", req.body);
  res.sendStatus(200);
});

fetch("https://seu-backend.onrender.com/pix", {
  method: "POST"
});

app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
});
