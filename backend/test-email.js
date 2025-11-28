// Test script to send sample booking confirmation email
import dotenv from 'dotenv';

// Load environment variables FIRST
const result = dotenv.config();
console.log('🚀 Testing updated email template...');
console.log('📧 Environment loaded:', result.error ? '❌ Failed' : '✅ Success');
console.log('📧 Resend API Key configured:', process.env.RESEND_API_KEY ? '✅ Yes' : '❌ No');

if (!process.env.RESEND_API_KEY) {
  console.log('❌ RESEND_API_KEY not found in environment variables');
  console.log('📝 Available env vars:', Object.keys(process.env).filter(key => key.includes('RESEND')));
  process.exit(1);
}

// Now import the email service after env vars are loaded
const { sendBookingConfirmation } = await import('./src/services/email.js');

// Sample booking data matching the updated template
const sampleBookingData = {
  customerName: "Test Customer",
  bookingNumber: "BK-2024-001234",
  serviceName: "Premium Hair Styling & Treatment",
  bookingDate: "2024-12-15",
  bookingTime: "2:30 PM",
  price: 15000.00
};

console.log('📧 Sending to: tygaodibenuah@gmail.com');
console.log('📋 Sample booking data:', sampleBookingData);

try {
  const result = await sendBookingConfirmation('tygaodibenuah@gmail.com', sampleBookingData);
  
  if (result.success) {
    console.log('✅ Email sent successfully!');
    console.log('📨 Message ID:', result.messageId);
    console.log('🎨 Template features tested:');
    console.log('  - Purple gradient header');
    console.log('  - Cursive typography (Patrick Hand/UnifrakturCook)');
    console.log('  - Step-based progress indicators');
    console.log('  - Responsive card layouts');
    console.log('  - Professional footer design');
    console.log('');
    console.log('📧 Check your inbox at tygaodibenuah@gmail.com for the test email!');
  } else {
    console.log('❌ Email sending failed:', result.error);
  }
} catch (error) {
  console.error('💥 Error sending test email:', error);
}