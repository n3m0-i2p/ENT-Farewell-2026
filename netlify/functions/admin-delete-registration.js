const { db, addSystemLog } = require('./utils/firebase');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-KEY',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ message: 'Method Not Allowed' }) };
  }

  // Validate admin token
  const authHeader = event.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
  const correctPasscode = process.env.ADMIN_PASSCODE || 'admin123';

  if (token !== correctPasscode) {
    return { statusCode: 401, headers, body: JSON.stringify({ message: 'Unauthorized' }) };
  }

  try {
    const { roll } = JSON.parse(event.body);

    if (!roll) {
      return { statusCode: 400, headers, body: JSON.stringify({ message: 'Roll number is required.' }) };
    }

    const docRef = db.collection('registrations').doc(roll);
    const doc = await docRef.get();

    if (!doc.exists) {
      return { statusCode: 404, headers, body: JSON.stringify({ message: 'Registration record not found.' }) };
    }

    await docRef.delete();
    await addSystemLog(`Admin Deleted Record ${roll}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Record deleted successfully.' })
    };
  } catch (error) {
    console.error('Error deleting registration:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Failed to delete record: ' + error.message })
    };
  }
};
