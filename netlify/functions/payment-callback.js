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

  const queryParams = event.queryStringParameters || {};
  const isPost = event.httpMethod === 'POST';

  let status = queryParams.status;
  let roll = queryParams.roll;
  let txnId = queryParams.transaction_id || queryParams.transactionId || queryParams.txid;

  // If POST webhook, parse body
  if (isPost && event.body) {
    try {
      const body = JSON.parse(event.body);
      status = body.status || status;
      roll = body.meta_data || body.roll || roll;
      txnId = body.transaction_id || body.payment_id || txnId;
    } catch (e) {
      console.error('Failed to parse webhook POST body:', e);
    }
  }

  console.log('Payment callback query parameters:', queryParams);
  console.log('Extracted values - status:', status, 'roll:', roll, 'txnId:', txnId);

  const host = event.headers['x-forwarded-host'] || event.headers.host || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';

  const redirectSuccess = `${protocol}://${host}/?payment_status=success&roll=${roll}`;
  const redirectCancel = `${protocol}://${host}/?payment_status=cancel&roll=${roll}`;

  if (!roll) {
    if (isPost) {
      return { statusCode: 400, headers, body: JSON.stringify({ message: 'Missing roll number' }) };
    }
    return {
      statusCode: 302,
      headers: { Location: `${protocol}://${host}/?payment_status=error&message=Missing+roll+number` },
      body: ''
    };
  }

  const apiKey = process.env.RUPANTORPAY_API_KEY || 'sandbox_api_key';

  if (status === 'success') {
    // If sandbox testing or we have a transaction ID to verify
    let isVerified = false;
    let senderNumber = 'N/A';
    let payId = `PAYID_${Date.now()}`;

    if (txnId && txnId.startsWith('TXN_MOCK_')) {
      // Sandbox bypass
      isVerified = true;
      senderNumber = '01700000000';
    } else if (txnId) {
      try {
        const rpResponse = await fetch('https://payment.rupantorpay.com/api/payment/verify-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': apiKey
          },
          body: JSON.stringify({ transaction_id: txnId })
        });
        const rpData = await rpResponse.json();
        console.log('RupantorPay Verify response:', rpData);

        if (rpResponse.ok && (rpData.status === 'success' || rpData.status === true)) {
          isVerified = true;
          senderNumber = rpData.sender_number || rpData.phone || 'N/A';
          payId = rpData.payment_id || payId;
        }
      } catch (err) {
        console.error('Error verifying payment with RupantorPay:', err);
      }
    } else {
      // If we don't have transaction_id but status is success, we might be inside a sandbox redirect
      if (apiKey === 'sandbox_api_key' || apiKey.includes('sandbox')) {
        isVerified = true;
        txnId = `TXN_MOCK_${Date.now()}`;
        senderNumber = '01711112222';
      }
    }

    if (isVerified) {
      try {
        const docRef = db.collection('registrations').doc(roll);
        const doc = await docRef.get();
        if (doc.exists) {
          const rcptId = `BPI26-${roll}-${Math.floor(100 + Math.random() * 900)}`;
          
          await docRef.update({
            status: 'Paid',
            txid: txnId,
            bkashNo: senderNumber,
            rcptId: rcptId,
            timestamp: new Date().toISOString()
          });

          await addSystemLog(`Payment Confirmed for Roll ${roll}`);
        } else {
          console.error(`Registration record for roll ${roll} not found in database.`);
        }
      } catch (dbErr) {
        console.error('Error updating Firebase document:', dbErr);
        if (isPost) {
          return { statusCode: 500, headers, body: JSON.stringify({ message: 'Database error: ' + dbErr.message }) };
        }
      }

      if (isPost) {
        return { statusCode: 200, headers, body: JSON.stringify({ status: 'success', message: 'Payment successfully processed' }) };
      }
      return {
        statusCode: 302,
        headers: { Location: redirectSuccess },
        body: ''
      };
    } else {
      // Verification failed
      if (isPost) {
        return { statusCode: 400, headers, body: JSON.stringify({ message: 'Payment verification failed' }) };
      }
      return {
        statusCode: 302,
        headers: { Location: `${protocol}://${host}/?payment_status=failed&roll=${roll}` },
        body: ''
      };
    }
  } else {
    // Payment cancelled or failed
    try {
      const docRef = db.collection('registrations').doc(roll);
      const doc = await docRef.get();
      if (doc.exists && doc.data().status !== 'Paid') {
        await docRef.update({ status: 'Cancelled' });
        await addSystemLog(`Payment cancelled/failed for Roll ${roll}`);
      }
    } catch (e) {
      console.error('Error updating cancellation status:', e);
    }

    if (isPost) {
      return { statusCode: 200, headers, body: JSON.stringify({ message: 'Cancellation processed' }) };
    }
    return {
      statusCode: 302,
      headers: { Location: redirectCancel },
      body: ''
    };
  }
};
