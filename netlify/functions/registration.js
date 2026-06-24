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

  try {
    const roll = event.queryStringParameters && event.queryStringParameters.roll;

    if (!roll) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Roll number parameter is required.' })
      };
    }

    const docRef = db.collection('registrations').doc(roll);
    const doc = await docRef.get();

    if (!doc.exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: 'Registration not found.' })
      };
    }

    const data = doc.data();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('Error fetching registration status:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Internal Server Error: ' + error.message })
    };
  }
};
