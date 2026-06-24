const admin = require('firebase-admin');

if (!admin.apps.length) {
  let serviceAccount = null;
  const envVal = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  if (envVal) {
    try {
      const trimmed = envVal.trim();
      if (trimmed.startsWith('{')) {
        serviceAccount = JSON.parse(trimmed);
      } else {
        serviceAccount = JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8'));
      }
    } catch (e) {
      console.error('Error parsing FIREBASE_SERVICE_ACCOUNT env var:', e);
    }
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else {
    // If not set, try initializing with default settings (useful for local firebase emulator/credentials)
    admin.initializeApp();
  }
}

const db = admin.firestore();

// Helper to log system events into the 'system_logs' collection in Firestore
async function addSystemLog(message) {
  try {
    await db.collection('system_logs').add({
      message: message,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error('Failed to write system log:', e);
  }
}

module.exports = { admin, db, addSystemLog };
