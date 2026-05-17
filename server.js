require('dotenv').config();

const express = require('express');
const cors = require('cors');

const {
  db,
  createTransaction,
  updateWallet,
  getUser
} = require('./firebase');

const {
  limiter,
  authMiddleware,
  adminMiddleware
} = require('./middleware');

const {
  generateTransactionRef,
  createFlutterwavePayment,
  verifyFlutterwaveTransaction,
  generateMysteryReward
} = require('./services');

const app = express();

app.use(cors());
app.use(express.json());
app.use(limiter);

app.get('/', (req, res) => {
  res.json({
    message: 'CONNECT Backend Running'
  });
});

// CREATE SUBSCRIPTION
app.post('/create-subscription', authMiddleware, async (req, res) => {
  try {
    const { amount, redirect_url } = req.body;

    const user = await getUser(req.user.uid);

    const tx_ref = generateTransactionRef();

    const payment = await createFlutterwavePayment({
      amount,
      email: user.email,
      name: user.name || 'CONNECT User',
      tx_ref,
      redirect_url
    });

    await createTransaction({
      userId: req.user.uid,
      type: 'subscription',
      amount,
      tx_ref,
      status: 'pending'
    });

    return res.json(payment);
  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
});

// VERIFY PAYMENT
app.post('/verify-payment', authMiddleware, async (req, res) => {
  try {
    const { transactionId, plan } = req.body;

    const verification = await verifyFlutterwaveTransaction(transactionId);

    if (
      verification.status === 'success' &&
      verification.data.status === 'successful'
    ) {
      await db.collection('subscriptions').doc(req.user.uid).set({
        plan,
        active: true,
        updatedAt: new Date()
      });

      return res.json({
        success: true,
        message: 'Subscription activated'
      });
    }

    return res.status(400).json({
      error: 'Payment failed'
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
});

// CREATE JOB
app.post('/post-job', authMiddleware, async (req, res) => {
  try {
    const data = req.body;

    const user = await getUser(req.user.uid);

    if (
      user.plan === 'free_trial' &&
      user.freeJobPostsRemaining <= 0
    ) {
      return res.status(403).json({
        error: 'Free trial exhausted'
      });
    }

    await db.collection('jobs').add({
      ...data,
      ownerId: req.user.uid,
      createdAt: new Date()
    });

    if (user.plan === 'free_trial') {
      await db.collection('users').doc(req.user.uid).update({
        freeJobPostsRemaining:
          user.freeJobPostsRemaining - 1
      });
    }

    return res.json({
      success: true,
      message: 'Job posted successfully'
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
});

// APPLY FOR JOB
app.post('/apply-job', authMiddleware, async (req, res) => {
  try {
    const {
      jobId,
      message,
      cvUrl
    } = req.body;

    await db.collection('jobApplications').add({
      jobId,
      applicantId: req.user.uid,
      message,
      cvUrl,
      status: 'pending',
      createdAt: new Date()
    });

    return res.json({
      success: true,
      message: 'Application submitted'
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
});

// CLAIM MYSTERY BOX
app.post('/claim-mystery-box', authMiddleware, async (req, res) => {
  try {
    const referralDoc = await db
      .collection('referrals')
      .doc(req.user.uid)
      .get();

    const referralData = referralDoc.data();

    if (
      !referralData ||
      referralData.successfulReferrals < 30
    ) {
      return res.status(400).json({
        error: 'Not eligible'
      });
    }

    if (referralData.mysteryBoxClaimed) {
      return res.status(400).json({
        error: 'Already claimed'
      });
    }

    const reward = generateMysteryReward();

    await updateWallet(req.user.uid, reward);

    await db.collection('mysteryRewards').add({
      userId: req.user.uid,
      reward,
      createdAt: new Date()
    });

    await db.collection('referrals').doc(req.user.uid).update({
      mysteryBoxClaimed: true
    });

    return res.json({
      success: true,
      reward
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
});

// ADMIN DELETE USER
app.delete('/admin/delete-user/:uid', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await db.collection('users').doc(req.params.uid).delete();

    return res.json({
      success: true,
      message: 'User deleted'
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
});

// FLUTTERWAVE WEBHOOK
app.post('/flutterwave-webhook', async (req, res) => {
  try {
    const payload = req.body;

    console.log('Webhook:', payload);

    return res.sendStatus(200);
  } catch (error) {
    return res.sendStatus(500);
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log('CONNECT Backend Running');
});