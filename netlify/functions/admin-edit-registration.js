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
    const { roll, name, tshirt, jerseyName } = JSON.parse(event.body);

    if (!roll) {
      return { statusCode: 400, headers, body: JSON.stringify({ message: 'Roll number is required.' }) };
    }

    const docRef = db.collection('registrations').doc(roll);
    const doc = await docRef.get();

    if (!doc.exists) {
      return { statusCode: 404, headers, body: JSON.stringify({ message: 'Registration record not found.' }) };
    }

    const updateObj = {};
    if (name) updateObj.name = name;
    if (tshirt) updateObj.tshirt = tshirt;
    if (jerseyName) updateObj.jerseyName = jerseyName.toUpperCase();

    await docRef.update(updateObj);
    await addSystemLog(`Admin Edited Record ${roll}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Record updated successfully.' })
    };
  } catch (error) {
    console.error('Error updating registration:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Failed to update record: ' + error.message })
    };
  }
};
