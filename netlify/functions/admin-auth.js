const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-KEY',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ message: 'Method Not Allowed' }) };
  }

  try {
    const { passcode } = JSON.parse(event.body);
    const correctPasscode = process.env.ADMIN_PASSCODE || 'admin123';

    if (passcode && passcode.trim() === correctPasscode.trim()) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, token: passcode.trim() })
      };
    } else {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, message: 'Access Denied. Invalid master passcode.' })
      };
    }
  } catch (error) {
    console.error('Admin auth error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Internal Server Error: ' + error.message })
    };
  }
};
