const axios = require('axios');
const cloudinary = require('cloudinary').v2;
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

function generateTransactionRef() {
  return `CONNECT_${Date.now()}_${uuidv4()}`;
}

async function createFlutterwavePayment({
  amount,
  email,
  name,
  tx_ref,
  redirect_url
}) {
  const response = await axios.post(
    'https://api.flutterwave.com/v3/payments',
    {
      tx_ref,
      amount,
      currency: 'GBP',
      redirect_url,
      customer: {
        email,
        name
      },
      customizations: {
        title: 'CONNECT Payment',
        description: 'Subscription/Wallet Payment'
      }
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`
      }
    }
  );

  return response.data;
}

async function verifyFlutterwaveTransaction(transactionId) {
  const response = await axios.get(
    `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
    {
      headers: {
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`
      }
    }
  );

  return response.data;
}

async function createTransfer(data) {
  const response = await axios.post(
    'https://api.flutterwave.com/v3/transfers',
    data,
    {
      headers: {
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`
      }
    }
  );

  return response.data;
}

function generateMysteryReward() {
  const rewards = [10, 5, 2, 1, 0.5, 0.3];

  const randomIndex = Math.floor(Math.random() * rewards.length);

  return rewards[randomIndex];
}

module.exports = {
  cloudinary,
  generateTransactionRef,
  createFlutterwavePayment,
  verifyFlutterwaveTransaction,
  createTransfer,
  generateMysteryReward
};