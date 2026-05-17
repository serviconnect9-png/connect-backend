const admin = require('firebase-admin');
const serviceAccount = require('./firebase-admin.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function verifyUserToken(token) {
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

async function getUser(uid) {
  const doc = await db.collection('users').doc(uid).get();
  return doc.data();
}

async function createTransaction(data) {
  return await db.collection('transactions').add({
    ...data,
    createdAt: new Date()
  });
}

async function updateWallet(uid, amount) {
  const walletRef = db.collection('wallets').doc(uid);

  await db.runTransaction(async (transaction) => {
    const walletDoc = await transaction.get(walletRef);

    if (!walletDoc.exists) {
      transaction.set(walletRef, {
        availableBalance: amount,
        pendingBalance: 0,
        createdAt: new Date()
      });
    } else {
      const current = walletDoc.data().availableBalance || 0;

      transaction.update(walletRef, {
        availableBalance: current + amount
      });
    }
  });
}

async function isAdmin(uid) {
  const user = await getUser(uid);
  return user?.role === 'admin';
}

module.exports = {
  admin,
  db,
  verifyUserToken,
  getUser,
  createTransaction,
  updateWallet,
  isAdmin
};