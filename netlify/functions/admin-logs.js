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
    const snapshot = await db.collection('system_logs').orderBy('timestamp', 'desc').limit(200).get();
    const logs = [];
    snapshot.forEach(doc => {
      logs.push(doc.data());
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(logs)
    };
  } catch (error) {
    console.error('Error fetching logs:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Failed to fetch logs: ' + error.message })
    };
  }
};
