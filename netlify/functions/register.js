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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ message: 'Method Not Allowed' })
    };
  }

  try {
    const { name, roll, email, phone, shift, jersey, tshirt, jerseyName } = JSON.parse(event.body);

    // Backend validation
    if (!name || !roll || !email || !phone || !shift || !jersey || !tshirt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'All registration fields are required.' })
      };
    }

    if (roll.length < 5) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Invalid board roll number.' })
      };
    }

    if (!email.includes('@')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Invalid email address.' })
      };
    }

    if (phone.length < 11) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Invalid phone number.' })
      };
    }

    const jName = jerseyName ? jerseyName.trim() : 'NONE';
    if (jName && jName !== 'NONE' && !/^[A-Za-z. -]+$/.test(jName)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Jersey custom name contains invalid characters.' })
      };
    }

    // Check if already paid
    const docRef = db.collection('registrations').doc(roll);
    const doc = await docRef.get();
    if (doc.exists && doc.data().status === 'Paid') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'This board roll is already registered and paid.' })
      };
    }

    // Determine host for redirect URLs
    const host = event.headers['x-forwarded-host'] || event.headers.host || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const successUrl = `${protocol}://${host}/api/payment-callback?status=success&roll=${roll}`;
    const cancelUrl = `${protocol}://${host}/api/payment-callback?status=cancel&roll=${roll}`;

    // Prepare RupantorPay Checkout Request
    const apiKey = process.env.RUPANTORPAY_API_KEY || 'sandbox_api_key';
    const payload = {
      fullname: name,
      email: email,
      amount: 1010,
      success_url: successUrl,
      cancel_url: cancelUrl,
      meta_data: roll
    };

    console.log('Initiating payment with payload:', payload);

    let paymentUrl = '';
    let payId = `PAYID_${Date.now()}`;

    try {
      const rpResponse = await fetch('https://payment.rupantorpay.com/api/payment/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey
        },
        body: JSON.stringify(payload)
      });

      const rpData = await rpResponse.json();
      console.log('RupantorPay API Response:', rpData);

      if (rpResponse.ok && (rpData.status === 'success' || rpData.status === true || rpData.payment_url)) {
        paymentUrl = rpData.payment_url || rpData.checkout_url || rpData.url || rpData.data?.payment_url;
        if (rpData.payment_id || rpData.transaction_id) {
          payId = rpData.payment_id || rpData.transaction_id;
        }
      } else {
        throw new Error(rpData.message || 'Payment gateway checkout initialization failed');
      }
    } catch (payErr) {
      console.error('RupantorPay API error:', payErr);
      // For testing/sandbox fallback if API key is invalid/missing
      if (apiKey === 'sandbox_api_key' || apiKey.includes('sandbox')) {
        console.log('Using sandbox payment fallback url');
        paymentUrl = `${protocol}://${host}/api/payment-callback?status=success&roll=${roll}&transaction_id=TXN_MOCK_${Date.now()}`;
      } else {
        return {
          statusCode: 502,
          headers,
          body: JSON.stringify({ message: 'Failed to initialize payment gateway: ' + payErr.message })
        };
      }
    }

    // Save registration info to database as Pending
    const registrationRecord = {
      name,
      roll,
      email,
      phone,
      shift,
      jersey,
      tshirt,
      jerseyName: jName.toUpperCase(),
      status: 'Pending',
      amount: 1010,
      payId: payId,
      txid: 'PENDING',
      bkashNo: 'PENDING',
      timestamp: new Date().toISOString()
    };

    await docRef.set(registrationRecord);
    await addSystemLog(`Registration initiated for Roll ${roll} (Pending Payment)`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Registration saved. Redirecting to payment...',
        payment_url: paymentUrl
      })
    };
  } catch (error) {
    console.error('Registration processing error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Internal Server Error: ' + error.message })
    };
  }
};
