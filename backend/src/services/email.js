import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

export const sendEmail = async (to, subject, text, html = null) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
      html: html || text
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Email sending failed:', error);
    return { success: false, error: error.message };
  }
};

export const sendBookingConfirmation = async (userEmail, bookingDetails) => {
  const subject = 'Booking Confirmation - Vonne X2X';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Booking Confirmation</h2>
      <p>Dear ${bookingDetails.customerName},</p>
      <p>Your booking has been confirmed! Here are the details:</p>
      
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Booking Details</h3>
        <p><strong>Booking Number:</strong> ${bookingDetails.bookingNumber}</p>
        <p><strong>Service:</strong> ${bookingDetails.serviceName}</p>
        <p><strong>Date:</strong> ${new Date(bookingDetails.bookingDate).toLocaleDateString()}</p>
        <p><strong>Time:</strong> ${bookingDetails.bookingTime}</p>
        <p><strong>Price:</strong> ₦${bookingDetails.price}</p>
      </div>
      
      <p>We look forward to serving you!</p>
      <p>Best regards,<br>Vonne X2X Team</p>
    </div>
  `;
  
  return await sendEmail(userEmail, subject, '', html);
};

export const sendBookingReminder = async (userEmail, bookingDetails) => {
  const subject = 'Booking Reminder - Vonne X2X';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Booking Reminder</h2>
      <p>Dear ${bookingDetails.customerName},</p>
      <p>This is a reminder for your upcoming appointment:</p>
      
      <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <h3 style="margin-top: 0;">Appointment Details</h3>
        <p><strong>Service:</strong> ${bookingDetails.serviceName}</p>
        <p><strong>Date:</strong> ${new Date(bookingDetails.bookingDate).toLocaleDateString()}</p>
        <p><strong>Time:</strong> ${bookingDetails.bookingTime}</p>
      </div>
      
      <p>Please arrive 10 minutes early for your appointment.</p>
      <p>Best regards,<br>Vonne X2X Team</p>
    </div>
  `;
  
  return await sendEmail(userEmail, subject, '', html);
};