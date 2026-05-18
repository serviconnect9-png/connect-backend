const express = require("express");
const cors = require("cors");
const axios = require("axios");
const admin = require("firebase-admin");

const app = express();

app.use(cors());
app.use(express.json());



// ============================
// FIREBASE ADMIN INIT
// ============================

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();



// ============================
// ROOT ROUTE
// ============================

app.get("/", (req, res) => {

  res.json({
    success: true,
    message: "CONNECT Backend Running 🚀"
  });

});



// ============================
// TEST ROUTES
// ============================

app.get("/withdraw", (req, res) => {

  res.json({
    success: true,
    message: "Withdraw API Working"
  });

});

app.get("/deposit", (req, res) => {

  res.json({
    success: true,
    message: "Deposit API Working"
  });

});



// ============================
// CREATE USER
// ============================

app.post("/create-user", async (req, res) => {

  try {

    const {
      uid,
      name,
      email,
      photo
    } = req.body;

    await db.collection("users")
    .doc(uid)
    .set({

      uid,
      name,
      email,
      photo,

      role: "user",

      wallet: 0,
      loyaltyPoints: 0,
      referrals: 0,

      freeJobPosts: 2,

      createdAt: new Date(),

    }, { merge: true });

    res.json({
      success: true,
      message: "User created"
    });

  } catch(err){

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});



// ============================
// GET USER
// ============================

app.get("/user/:uid", async (req, res) => {

  try {

    const uid = req.params.uid;

    const doc = await db
    .collection("users")
    .doc(uid)
    .get();

    if(!doc.exists){

      return res.status(404).json({
        success: false,
        message: "User not found"
      });

    }

    res.json({
      success: true,
      user: doc.data()
    });

  } catch(err){

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});



// ============================
// DEPOSIT
// ============================

app.post("/deposit", async (req, res) => {

  try {

    const {
      uid,
      amount,
      tx_ref
    } = req.body;

    if(!uid || !amount){

      return res.status(400).json({
        success: false,
        message: "Missing fields"
      });

    }

    await db.collection("transactions")
    .add({

      uid,
      amount,
      tx_ref,

      type: "deposit",

      status: "pending",

      createdAt: new Date()

    });

    res.json({
      success: true,
      message: "Deposit initialized"
    });

  } catch(err){

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});



// ============================
// FLUTTERWAVE WEBHOOK
// ============================

app.post("/flutterwave-webhook", async (req, res) => {

  try {

    const secretHash = process.env.FLW_SECRET_HASH;

    const signature =
      req.headers["verif-hash"];

    if(signature !== secretHash){

      return res.status(401).send("Invalid hash");

    }

    const payload = req.body;

    if(payload.status === "successful"){

      const uid = payload.meta.uid;

      const amount = Number(payload.amount);

      const userRef =
        db.collection("users").doc(uid);

      await db.runTransaction(async (t) => {

        const doc = await t.get(userRef);

        const currentWallet =
          doc.data().wallet || 0;

        t.update(userRef, {
          wallet: currentWallet + amount
        });

      });

      await db.collection("transactions")
      .add({

        uid,
        amount,

        type: "deposit",

        status: "successful",

        createdAt: new Date()

      });

    }

    res.sendStatus(200);

  } catch(err){

    console.log(err);

    res.sendStatus(500);

  }

});



// ============================
// WITHDRAW
// ============================

app.post("/withdraw", async (req, res) => {

  try {

    const {
      uid,
      amount,
      bankCode,
      accountNumber,
      accountName
    } = req.body;

    if(!uid || !amount){

      return res.status(400).json({
        success: false,
        message: "Missing fields"
      });

    }

    const userRef =
      db.collection("users").doc(uid);

    const userDoc = await userRef.get();

    if(!userDoc.exists){

      return res.status(404).json({
        success: false,
        message: "User not found"
      });

    }

    const user = userDoc.data();

    if(user.wallet < amount){

      return res.status(400).json({
        success: false,
        message: "Insufficient balance"
      });

    }



    // ============================
    // FLUTTERWAVE TRANSFER
    // ============================

    const transfer = await axios.post(

      "https://api.flutterwave.com/v3/transfers",

      {

        account_bank: bankCode,

        account_number: accountNumber,

        amount: amount,

        narration: "CONNECT Withdrawal",

        currency: "NGN",

        reference:
        "CONNECT-" + Date.now(),

        callback_url:
        "https://yourdomain.com/callback",

        debit_currency: "NGN"

      },

      {

        headers: {

          Authorization:
          `Bearer ${process.env.FLW_SECRET_KEY}`,

          "Content-Type":
          "application/json"

        }

      }

    );



    // ============================
    // UPDATE WALLET
    // ============================

    await userRef.update({

      wallet:
      user.wallet - Number(amount)

    });



    // ============================
    // SAVE TRANSACTION
    // ============================

    await db.collection("transactions")
    .add({

      uid,

      amount,

      bankCode,
      accountNumber,
      accountName,

      type: "withdraw",

      status: "successful",

      flutterwaveResponse:
      transfer.data,

      createdAt: new Date()

    });



    res.json({

      success: true,

      message:
      "Withdrawal successful",

      data: transfer.data

    });

  } catch(err){

    console.log(err.response?.data || err.message);

    res.status(500).json({

      success: false,

      error:
      err.response?.data || err.message

    });

  }

});



// ============================
// CREATE PRODUCT
// ============================

app.post("/create-product", async (req, res) => {

  try {

    const product = req.body;

    product.createdAt = new Date();

    await db.collection("products")
    .add(product);

    res.json({
      success: true,
      message: "Product created"
    });

  } catch(err){

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});



// ============================
// GET PRODUCTS
// ============================

app.get("/products", async (req, res) => {

  try {

    const snapshot =
      await db.collection("products").get();

    const products = [];

    snapshot.forEach(doc => {

      products.push({
        id: doc.id,
        ...doc.data()
      });

    });

    res.json({
      success: true,
      products
    });

  } catch(err){

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});



// ============================
// CREATE JOB
// ============================

app.post("/create-job", async (req, res) => {

  try {

    const job = req.body;

    job.createdAt = new Date();

    await db.collection("jobs")
    .add(job);

    res.json({
      success: true,
      message: "Job created"
    });

  } catch(err){

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});



// ============================
// APPLY FOR JOB
// ============================

app.post("/apply-job", async (req, res) => {

  try {

    const application = req.body;

    application.createdAt = new Date();

    await db.collection("applications")
    .add(application);

    res.json({
      success: true,
      message: "Application submitted"
    });

  } catch(err){

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});



// ============================
// CREATE AD
// ============================

app.post("/create-ad", async (req, res) => {

  try {

    const ad = req.body;

    ad.status = "pending";

    ad.createdAt = new Date();

    await db.collection("ads")
    .add(ad);

    res.json({
      success: true,
      message: "Ad submitted for approval"
    });

  } catch(err){

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});



// ============================
// ADMIN LOGIN CHECK
// ============================

app.post("/admin-check", async (req, res) => {

  try {

    const { email } = req.body;

    if(
      email ===
      "ebubechichukwu8@gmail.com"
    ){

      return res.json({
        success: true,
        admin: true
      });

    }

    res.json({
      success: true,
      admin: false
    });

  } catch(err){

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});



// ============================
// START SERVER
// ============================

const PORT =
process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(
    `CONNECT Backend Running On Port ${PORT}`
  );

});
