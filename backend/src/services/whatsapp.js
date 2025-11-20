import axios from 'axios';

// Use environment variable with fallback
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v17.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;

export const sendWhatsApp = async (to, message) => {
  try {
    const response = await axios.post(
      `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: {
          body: message
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('WhatsApp message sent successfully:', response.data);
    return { success: true, messageId: response.data.messages[0].id };
  } catch (error) {
    console.error('WhatsApp sending failed:', error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
};

export const sendBookingConfirmationWhatsApp = async (phoneNumber, bookingDetails) => {
  const message = `🎉 *Booking Confirmed!*

Hello ${bookingDetails.customerName},

Your booking has been confirmed with the following details:

📋 *Booking Number:* ${bookingDetails.bookingNumber}
💅 *Service:* ${bookingDetails.serviceName}
📅 *Date:* ${new Date(bookingDetails.bookingDate).toLocaleDateString()}
⏰ *Time:* ${bookingDetails.bookingTime}
💰 *Price:* ₦${bookingDetails.price}

We look forward to serving you! Please arrive 10 minutes early.

Best regards,
Vonne X2X Team`;

  return await sendWhatsApp(phoneNumber, message);
};

export const sendBookingReminderWhatsApp = async (phoneNumber, bookingDetails) => {
  const message = `⏰ *Appointment Reminder*

Hello ${bookingDetails.customerName},

This is a friendly reminder for your upcoming appointment:

💅 *Service:* ${bookingDetails.serviceName}
📅 *Date:* ${new Date(bookingDetails.bookingDate).toLocaleDateString()}
⏰ *Time:* ${bookingDetails.bookingTime}

Please arrive 10 minutes early for your appointment.

See you soon!
Vonne X2X Team`;

  return await sendWhatsApp(phoneNumber, message);
};

export const sendBookingStatusUpdate = async (phoneNumber, bookingDetails, status) => {
  let statusMessage = '';
  let emoji = '';
  
  switch (status) {
    case 'scheduled':
      emoji = '✅';
      statusMessage = 'scheduled';
      break;
    case 'pending_confirmation':
      emoji = '⏳';
      statusMessage = 'pending confirmation';
      break;
    case 'in-progress':
      emoji = '🔧';
      statusMessage = 'in progress';
      break;
    case 'cancelled':
      emoji = '❌';
      statusMessage = 'cancelled';
      break;
    case 'completed':
      emoji = '🎉';
      statusMessage = 'completed';
      break;
    default:
      emoji = '📋';
      statusMessage = 'updated';
  }

  const message = `${emoji} *Booking ${statusMessage.toUpperCase()}*

Hello ${bookingDetails.customerName},

Your booking (#${bookingDetails.bookingNumber}) has been ${statusMessage}.

💅 *Service:* ${bookingDetails.serviceName}
📅 *Date:* ${new Date(bookingDetails.bookingDate).toLocaleDateString()}
⏰ *Time:* ${bookingDetails.bookingTime}

${status === 'completed' ? 'Thank you for choosing Vonne X2X! We hope you enjoyed our service.' : ''}

Best regards,
Vonne X2X Team`;

  return await sendWhatsApp(phoneNumber, message);
};