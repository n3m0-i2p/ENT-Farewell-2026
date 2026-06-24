const { db, addSystemLog } = require('./utils/firebase');

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

  // GET /api/opinions
  if (event.httpMethod === 'GET') {
    try {
      const snapshot = await db.collection('opinions').orderBy('timestamp', 'desc').limit(100).get();
      const opinions = [];
      snapshot.forEach(doc => {
        opinions.push({ id: doc.id, ...doc.data() });
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(opinions)
      };
    } catch (error) {
      console.error('Error fetching opinions:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ message: 'Failed to fetch opinions: ' + error.message })
      };
    }
  }

  // POST /api/opinions
  if (event.httpMethod === 'POST') {
    try {
      const { name, roll, shift, email, message, text } = JSON.parse(event.body);
      const msg = (message || text || '').trim();

      if (!msg) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: 'Opinion message cannot be empty.' })
        };
      }

      if (!email || !email.includes('@')) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: 'A valid email is required to post.' })
        };
      }

      // Check if registration exists for this email to link official profiles
      let finalName = name ? name.trim() : 'Guest Graduate';
      let finalRoll = roll ? roll.trim() : 'Guest';
      let finalShift = shift ? shift.trim() : '1st';
      let isVerifiedStudent = false;

      const regsRef = db.collection('registrations');
      const regsSnapshot = await regsRef.where('email', '==', email.trim()).get();

      if (!regsSnapshot.empty) {
        // Use first matching record
        const regData = regsSnapshot.docs[0].data();
        finalName = regData.name;
        finalRoll = regData.roll;
        finalShift = regData.shift || finalShift;
        isVerifiedStudent = regData.status === 'Paid';
      }

      const opinion = {
        name: finalName,
        roll: finalRoll,
        shift: finalShift,
        email: email.trim(),
        message: msg,
        isVerifiedStudent,
        timestamp: new Date().toISOString()
      };

      await db.collection('opinions').add(opinion);
      await addSystemLog(`Opinion Posted by ${finalName} (Roll: ${finalRoll})`);

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ message: 'Opinion posted successfully.', opinion })
      };
    } catch (error) {
      console.error('Error posting opinion:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ message: 'Failed to post opinion: ' + error.message })
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ message: 'Method Not Allowed' })
  };
};
