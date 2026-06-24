const { db } = require('./utils/firebase');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-KEY',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
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
    const snapshot = await db.collection('registrations').get();
    const list = [];
    snapshot.forEach(doc => {
      list.push(doc.data());
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(list)
    };
  } catch (error) {
    console.error('Error fetching registrations:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Database query failed: ' + error.message })
    };
  }
};
