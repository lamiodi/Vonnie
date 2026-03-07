
import { Resend } from 'resend';

let resendClient = null;

const getResendClient = () => {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
};

// Common styles and font imports
const FONT_IMPORTS = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
    body, h1, h2, h3, h4, p, div, span, a, li {
      font-family: 'Manrope', Arial, sans-serif !important;
    }
  </style>
`;

const getEmailWrapper = (content) => `
  <div style="background-color: #f3f4f6; padding: 40px 20px; font-family: 'Manrope', Arial, sans-serif; line-height: 1.5; color: #374151;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
      ${content}
    </div>
    <div style="text-align: center; margin-top: 24px; color: #6b7280; font-size: 12px;">
      <p style="margin: 0 0 4px 0;">&copy; ${new Date().getFullYear()} Vonne X2X. All rights reserved.</p>
      <p style="margin: 0;">Professional Service Management System</p>
    </div>
  </div>
`;

export const sendEmail = async (to, subject, text, html = null, attachments = []) => {
  try {
    const resend = getResendClient();
    // Inject font imports if HTML is provided
    const finalHtml = html ? `${FONT_IMPORTS}${html}` : html;
    
    const { data, error } = await resend.emails.send({
      from: 'Vonne X2X <notifications@vonneex2x.store>',
      to,
      subject,
      text,
      html: finalHtml || text,
      attachments
    });

    if (error) {
      console.error('Email sending failed:', error);
      return { success: false, error: error.message };
    }

    console.log('Email sent successfully with Resend:', data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Email sending failed:', error);
    return { success: false, error: error.message };
  }
};

export const sendBookingConfirmation = async (userEmail, bookingDetails) => {
  const subject = '✅ Booking Confirmed - Vonne X2X';
  
  // Format price
  const price = bookingDetails.price 
    ? `₦${parseFloat(bookingDetails.price).toLocaleString('en-NG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
    : 'To be discussed';
    
  // Format service name
  const serviceName = bookingDetails.serviceName || 'To be discussed in-shop';

  const content = `
      <!-- Header with gradient -->
      <div style="background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%); padding: 32px 24px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">
          Booking Confirmed!
        </h1>
        <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.95; font-weight: 500;">Your appointment is locked in</p>
      </div>
      
      <!-- Main content -->
      <div style="padding: 32px 24px;">
        <p style="font-size: 16px; color: #374151; margin-bottom: 24px; line-height: 1.6;">Hello <strong style="color: #111827;">${bookingDetails.customerName}</strong>,</p>
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin-bottom: 24px;">
          Thank you for choosing Vonne X2X! We're excited to confirm your appointment.
        </p>
        
        <!-- Booking Details Card -->
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin: 24px 0;">
          <h3 style="color: #111827; margin: 0 0 16px 0; font-size: 18px; font-weight: 700; display: flex; align-items: center;">
            <span style="margin-right: 8px;">📋</span> Booking Details
          </h3>
          
          <div style="display: grid; gap: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
              <span style="font-weight: 600; color: #6b7280; font-size: 14px;">Booking Number</span>
              <span style="color: #9333ea; font-weight: 700; font-size: 14px; font-family: 'Manrope', monospace;">${bookingDetails.bookingNumber}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
              <span style="font-weight: 600; color: #6b7280; font-size: 14px;">Service</span>
              <span style="color: #111827; font-weight: 600; font-size: 14px;">${serviceName}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
              <span style="font-weight: 600; color: #6b7280; font-size: 14px;">Date</span>
              <span style="color: #111827; font-weight: 600; font-size: 14px;">${new Date(bookingDetails.bookingDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
              <span style="font-weight: 600; color: #6b7280; font-size: 14px;">Time</span>
              <span style="color: #111827; font-weight: 700; font-size: 14px;">${bookingDetails.bookingTime}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
              <span style="font-weight: 600; color: #6b7280; font-size: 14px;">Est. Price</span>
              <span style="color: #059669; font-weight: 700; font-size: 14px;">${price}</span>
            </div>
          </div>
        </div>
        
        <!-- Next steps -->
        <div style="background: #eff6ff; border: 1px solid #dbeafe; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <h4 style="margin: 0 0 8px 0; color: #1e40af; font-size: 15px; font-weight: 700;">✨ What's Next?</h4>
          <p style="margin: 0; color: #1e3a8a; font-size: 14px; line-height: 1.5;">
            Please arrive 10 minutes early. We can't wait to see you!
          </p>
        </div>
        
        <!-- Contact info -->
        <div style="text-align: center; margin-top: 32px;">
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">Need to reschedule?</p>
          <a href="mailto:support@vonneex2x.store" style="display: inline-block; color: #9333ea; text-decoration: none; font-weight: 600; font-size: 14px;">support@vonneex2x.store</a>
        </div>
      </div>
  `;
  
  const html = getEmailWrapper(content);
  return await sendEmail(userEmail, subject, '', html);
};

export const sendBookingReminder = async (userEmail, bookingDetails) => {
  const subject = '⏰ Appointment Reminder - Vonne X2X';
  
  // Format service name
  const serviceName = bookingDetails.serviceName || 'To be discussed in-shop';
  
  const content = `
      <!-- Header with gradient -->
      <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px 24px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">
          Appointment Reminder
        </h1>
        <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.95; font-weight: 500;">We'll see you soon!</p>
      </div>
      
      <!-- Main content -->
      <div style="padding: 32px 24px;">
        <p style="font-size: 16px; color: #374151; margin-bottom: 24px; line-height: 1.6;">Hello <strong style="color: #111827;">${bookingDetails.customerName}</strong>,</p>
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin-bottom: 24px;">
          This is a friendly reminder for your upcoming beauty appointment.
        </p>
        
        <!-- Appointment details card -->
        <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 12px; padding: 24px; margin: 24px 0;">
          <h3 style="color: #b45309; margin: 0 0 16px 0; font-size: 18px; font-weight: 700; display: flex; align-items: center;">
            <span style="margin-right: 8px;">📅</span> Appointment Details
          </h3>
          
          <div style="display: grid; gap: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: white; border-radius: 8px; border: 1px solid #fcd34d;">
              <span style="font-weight: 600; color: #6b7280; font-size: 14px;">Service</span>
              <span style="color: #111827; font-weight: 600; font-size: 14px;">${serviceName}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: white; border-radius: 8px; border: 1px solid #fcd34d;">
              <span style="font-weight: 600; color: #6b7280; font-size: 14px;">Date</span>
              <span style="color: #111827; font-weight: 600; font-size: 14px;">${new Date(bookingDetails.bookingDate).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: white; border-radius: 8px; border: 1px solid #fcd34d;">
              <span style="font-weight: 600; color: #6b7280; font-size: 14px;">Time</span>
              <span style="color: #111827; font-weight: 700; font-size: 14px;">${bookingDetails.bookingTime}</span>
            </div>
          </div>
        </div>
        
        <!-- Tips section -->
        <div style="background: #eff6ff; border: 1px solid #dbeafe; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <h4 style="margin: 0 0 10px 0; color: #1e40af; font-size: 15px; font-weight: 700;">💡 Quick Tips</h4>
          <ul style="margin: 0; padding-left: 20px; color: #1e3a8a; font-size: 14px; line-height: 1.6;">
            <li style="margin-bottom: 4px;">Please arrive 10 minutes early</li>
            <li>Bring any inspiration photos you have</li>
          </ul>
        </div>
        
        <!-- Contact info -->
        <div style="text-align: center; margin-top: 32px;">
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">Need to reschedule?</p>
          <a href="mailto:support@vonneex2x.store" style="display: inline-block; color: #9333ea; text-decoration: none; font-weight: 600; font-size: 14px;">support@vonneex2x.store</a>
        </div>
      </div>
  `;
  
  const html = getEmailWrapper(content);
  return await sendEmail(userEmail, subject, '', html);
};

export const sendPaymentConfirmation = async (email, bookingDetails, paymentContext = {}) => {
  const { 
    bookingNumber, 
    customerName, 
    amount, 
    paymentMethod = 'online',
    source = 'booking' // 'booking', 'pos', 'payment-confirmation'
  } = bookingDetails;
  
  const subject = source === 'pos' 
    ? '💳 Payment Confirmed - POS Transaction' 
    : '💳 Payment Confirmed - Your Booking is Confirmed!';
    
  const content = `
      <!-- Header with gradient -->
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px 24px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">
          Payment Confirmed
        </h1>
        <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.95; font-weight: 500;">Transaction processed successfully</p>
      </div>
      
      <!-- Main content -->
      <div style="padding: 32px 24px;">
        <p style="font-size: 16px; color: #374151; margin-bottom: 24px; line-height: 1.6;">Hello <strong style="color: #111827;">${customerName}</strong>,</p>
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin-bottom: 24px;">
          We've received your payment. Here are the details for your records.
        </p>
        
        <!-- Payment details card -->
        <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 12px; padding: 24px; margin: 24px 0;">
          <h3 style="color: #15803d; margin: 0 0 16px 0; font-size: 18px; font-weight: 700; display: flex; align-items: center;">
            <span style="margin-right: 8px;">💰</span> Payment Details
          </h3>
          
          <div style="display: grid; gap: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: white; border-radius: 8px; border: 1px solid #86efac;">
              <span style="font-weight: 600; color: #6b7280; font-size: 14px;">Amount Paid</span>
              <span style="color: #059669; font-weight: 700; font-size: 16px;">₦${amount?.toFixed(2) || '0.00'}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: white; border-radius: 8px; border: 1px solid #86efac;">
              <span style="font-weight: 600; color: #6b7280; font-size: 14px;">Method</span>
              <span style="color: #111827; font-weight: 600; font-size: 14px;">${paymentMethod}</span>
            </div>
            
            ${bookingNumber ? `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: white; border-radius: 8px; border: 1px solid #86efac;">
                <span style="font-weight: 600; color: #6b7280; font-size: 14px;">Booking Ref</span>
                <span style="color: #111827; font-weight: 600; font-size: 14px; font-family: 'Manrope', monospace;">${bookingNumber}</span>
              </div>
            ` : ''}
            
            ${source === 'pos' ? `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: white; border-radius: 8px; border: 1px solid #86efac;">
                <span style="font-weight: 600; color: #6b7280; font-size: 14px;">Type</span>
                <span style="color: #111827; font-weight: 600; font-size: 14px;">Point of Sale</span>
              </div>
            ` : ''}
          </div>
        </div>
        
        <!-- Next steps -->
        <div style="background: #eff6ff; border: 1px solid #dbeafe; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <h4 style="margin: 0 0 8px 0; color: #1e40af; font-size: 15px; font-weight: 700;">✨ All Set!</h4>
          <p style="margin: 0; color: #1e3a8a; font-size: 14px; line-height: 1.5;">
            Your payment has been secured. Thank you for your business.
          </p>
        </div>
        
        <!-- Contact info -->
        <div style="text-align: center; margin-top: 32px;">
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">Questions about this charge?</p>
          <a href="mailto:support@vonneex2x.store" style="display: inline-block; color: #9333ea; text-decoration: none; font-weight: 600; font-size: 14px;">support@vonneex2x.store</a>
        </div>
      </div>
  `;
  
  const html = getEmailWrapper(content);
  return await sendEmail(email, subject, '', html);
};

export const sendContactFormResponse = async (email, name, message, replyMessage) => {
  const subject = 'Re: Your Inquiry - Vonne X2X';
  
  const content = `
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 32px 24px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 800;">Message Received</h1>
        <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.95;">We've received your inquiry</p>
      </div>
      
      <!-- Content -->
      <div style="padding: 32px 24px;">
        <p style="font-size: 16px; color: #374151; margin-bottom: 24px; line-height: 1.6;">
          Hello <strong style="color: #1e293b;">${name}</strong>,
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 24px; line-height: 1.6;">
          Thank you for contacting us. ${replyMessage ? 'Here is our response to your message:' : 'We have received your message and will get back to you shortly.'}
        </p>
        
        ${replyMessage ? `
        <div style="background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <h3 style="color: #0f766e; margin: 0 0 12px 0; font-size: 16px; font-weight: 700;">💬 Our Response</h3>
          <p style="margin: 0; color: #115e59; line-height: 1.6; font-size: 15px;">${replyMessage}</p>
        </div>
        ` : ''}
        
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <h3 style="color: #64748b; margin: 0 0 12px 0; font-size: 14px; font-weight: 700; text-transform: uppercase;">Original Message</h3>
          <p style="margin: 0; color: #475569; line-height: 1.6; font-style: italic; font-size: 14px;">"${message}"</p>
        </div>
        
        <div style="text-align: center; margin-top: 32px;">
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">Need further assistance?</p>
          <a href="mailto:support@vonneex2x.store" style="color: #4f46e5; text-decoration: none; font-weight: 600; font-size: 14px;">Reply to this email</a>
        </div>
      </div>
  `;
  
  const html = getEmailWrapper(content);
  return await sendEmail(email, subject, '', html);
};

export const sendPasswordResetEmail = async (email, resetToken) => {
  const subject = '🔒 Password Reset Request - Vonne X2X';
  const resetLink = `https://vonneex2x.store/reset-password?token=${resetToken}`;
  
  const content = `
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%); padding: 32px 24px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 800;">Password Reset</h1>
        <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.95;">Secure Account Recovery</p>
      </div>
      
      <!-- Content -->
      <div style="padding: 32px 24px;">
        <p style="font-size: 16px; color: #374151; margin-bottom: 24px; line-height: 1.6;">
          We received a request to reset your password. If you didn't make this request, you can safely ignore this email.
        </p>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetLink}" style="display: inline-block; background: #e11d48; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(225, 29, 72, 0.2); transition: transform 0.2s;">
            Reset Password
          </a>
        </div>
        
        <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <p style="margin: 0; color: #9f1239; font-size: 13px; text-align: center;">
            This link will expire in 1 hour for security reasons.
          </p>
        </div>
        
        <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px;">Or copy and paste this link into your browser:</p>
          <p style="margin: 0; font-size: 12px; color: #4b5563; word-break: break-all; font-family: monospace; background: #f3f4f6; padding: 8px; border-radius: 4px;">${resetLink}</p>
        </div>
      </div>
  `;
  
  const html = getEmailWrapper(content);
  return await sendEmail(email, subject, '', html);
};


export const sendWebhookAlert = async (alertType, errorDetails, webhookData = null) => {
  const subject = `🚨 Vonne X2X Webhook Alert - ${alertType}`;
  
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@vonneex2x.store';
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@vonneex2x.store';
  
  const content = `
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 32px 24px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 800;">🚨 Webhook Alert</h1>
        <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.95;">${alertType}</p>
      </div>
      
      <!-- Content -->
      <div style="padding: 32px 24px;">
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="color: #dc2626; margin: 0 0 12px 0; font-size: 16px; font-weight: 700;">⚠️ Error Details</h3>
          <pre style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; font-size: 12px; color: #374151; overflow-x: auto; margin: 0; font-family: monospace;">${JSON.stringify(errorDetails, null, 2)}</pre>
        </div>
        
        ${webhookData ? `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="color: #1f2937; margin: 0 0 12px 0; font-size: 16px; font-weight: 700;">📡 Webhook Data</h3>
          <pre style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; font-size: 12px; color: #374151; overflow-x: auto; margin: 0; font-family: monospace;">${JSON.stringify(webhookData, null, 2)}</pre>
        </div>
        ` : ''}
        
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px;">
          <h3 style="color: #1d4ed8; margin: 0 0 8px 0; font-size: 15px; font-weight: 700;">🔍 Action Required</h3>
          <p style="margin: 0; color: #1e40af; line-height: 1.5; font-size: 14px;">
            Please investigate this webhook issue immediately. Check the logs for more details.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 24px; padding: 12px; background: #f8fafc; border-radius: 8px;">
          <p style="margin: 0; color: #64748b; font-size: 12px;">
            Time: ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' })}
          </p>
        </div>
      </div>
  `;
  
  const html = getEmailWrapper(content);
  // Send to both admin and support
  await sendEmail(adminEmail, subject, '', html);
  return await sendEmail(supportEmail, subject, '', html);
};

export const sendInventoryAlert = async (alertDetails) => {
  const { alertType, products = [], recipientEmail } = alertDetails;
  
  const subject = `📦 Inventory Alert: ${alertType === 'low_stock' ? 'Low Stock Warning' : 'Stock Update'} - Vonne X2X`;
  
  // Generate products list HTML
  const productsHtml = products.map(product => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: white; border-radius: 8px; border: 1px solid #fee2e2; margin-bottom: 8px;">
      <div>
        <p style="margin: 0; font-weight: 600; color: #1f2937; font-size: 14px;">${product.name}</p>
        <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 12px; font-family: monospace;">SKU: ${product.sku || 'N/A'}</p>
      </div>
      <div style="text-align: right;">
        <span style="display: inline-block; padding: 4px 10px; background: #fee2e2; color: #991b1b; border-radius: 999px; font-size: 12px; font-weight: 700;">
          ${product.stock_level} left
        </span>
      </div>
    </div>
  `).join('');

  const content = `
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); padding: 32px 24px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 800;">📦 Inventory Alert</h1>
        <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.95;">Action Required: Low Stock Detected</p>
      </div>
      
      <!-- Content -->
      <div style="padding: 32px 24px;">
        <p style="font-size: 16px; color: #374151; margin-bottom: 24px; line-height: 1.6;">
          The following items have fallen below the minimum stock threshold (5 units). Please restock soon.
        </p>
        
        <!-- Products List -->
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <h3 style="color: #991b1b; margin: 0 0 16px 0; font-size: 16px; font-weight: 700;">⚠️ Low Stock Items</h3>
          ${productsHtml}
        </div>
        
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px;">
          <h3 style="color: #1d4ed8; margin: 0 0 8px 0; font-size: 15px; font-weight: 700;">🔍 Action Required</h3>
          <p style="margin: 0; color: #1e40af; line-height: 1.5; font-size: 14px;">
            Review inventory levels and place replenishment orders to avoid stockouts.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 24px; padding: 12px; background: #f8fafc; border-radius: 8px;">
          <p style="margin: 0; color: #64748b; font-size: 12px;">
            Time: ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' })}
          </p>
        </div>
      </div>
  `;
  
  const html = getEmailWrapper(content);
  return await sendEmail(recipientEmail, subject, '', html);
};

export const sendPOSTransactionEmail = async (email, transactionDetails) => {
  const { 
    transactionId, 
    customerName = 'Valued Customer', 
    items = [], 
    totalAmount, 
    paymentMethod,
    date = new Date()
  } = transactionDetails;
  
  const subject = '🧾 POS Receipt - Vonne X2X';
  
  // Generate items list HTML
  const itemsHtml = items.map(item => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
      <div>
        <p style="margin: 0; font-weight: 600; color: #1f2937; font-size: 14px;">${item.name || 'Item'}</p>
        <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 12px;">Qty: ${item.quantity} x ₦${item.price?.toLocaleString('en-NG')}</p>
      </div>
      <p style="margin: 0; font-weight: 600; color: #1f2937; font-size: 14px;">₦${(item.quantity * item.price)?.toLocaleString('en-NG')}</p>
    </div>
  `).join('');

  const content = `
      <!-- Header with gradient -->
      <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 32px 24px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">
          Receipt
        </h1>
        <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.95; font-weight: 500;">Thank you for your purchase</p>
      </div>
      
      <!-- Main content -->
      <div style="padding: 32px 24px;">
        <p style="font-size: 16px; color: #374151; margin-bottom: 24px; line-height: 1.6;">Hello <strong style="color: #111827;">${customerName}</strong>,</p>
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin-bottom: 24px;">
          Here is your receipt for your recent transaction at Vonne X2X.
        </p>
        
        <!-- Transaction Details -->
        <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin: 24px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="border-bottom: 2px dashed #e5e7eb; padding-bottom: 16px; margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #6b7280; font-size: 13px;">Transaction ID</span>
              <span style="color: #374151; font-weight: 600; font-size: 13px; font-family: monospace;">${transactionId}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #6b7280; font-size: 13px;">Date</span>
              <span style="color: #374151; font-weight: 600; font-size: 13px;">${new Date(date).toLocaleString('en-NG')}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #6b7280; font-size: 13px;">Payment Method</span>
              <span style="color: #374151; font-weight: 600; font-size: 13px; text-transform: capitalize;">${paymentMethod}</span>
            </div>
          </div>
          
          <!-- Items List -->
          <div style="margin-bottom: 16px;">
            <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Items Purchased</p>
            ${itemsHtml}
          </div>
          
          <!-- Total -->
          <div style="border-top: 2px solid #e5e7eb; padding-top: 16px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 16px; font-weight: 700; color: #111827;">Total Paid</span>
            <span style="font-size: 20px; font-weight: 800; color: #2563eb;">₦${totalAmount?.toLocaleString('en-NG', {minimumFractionDigits: 2})}</span>
          </div>
        </div>
        
        <!-- Footer Info -->
        <div style="text-align: center; margin-top: 32px;">
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">Questions about this receipt?</p>
          <a href="mailto:support@vonneex2x.store" style="display: inline-block; color: #2563eb; text-decoration: none; font-weight: 600; font-size: 14px;">support@vonneex2x.store</a>
        </div>
      </div>
  `;
  
  const html = getEmailWrapper(content);
  return await sendEmail(email, subject, '', html);
};

export const sendWeeklyReportEmail = async (email, period, attachments = []) => {
  const subject = `Weekly Activity Report (${period.start} - ${period.end})`;
  const text = `Please find attached the weekly activity report for the period ${period.start} to ${period.end}.`;
  
  const content = `
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); padding: 32px 24px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 800;">📊 Weekly Report</h1>
        <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.95;">${period.start} - ${period.end}</p>
      </div>
      
      <!-- Content -->
      <div style="padding: 32px 24px;">
        <p style="font-size: 16px; color: #374151; margin-bottom: 24px; line-height: 1.6;">
          Please find attached the weekly activity report for the period <strong>${period.start}</strong> to <strong>${period.end}</strong>.
        </p>
        
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <h3 style="color: #1e293b; margin: 0 0 16px 0; font-size: 16px; font-weight: 700;">📑 Report Summary</h3>
          <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.6;">
            <li><strong>Generated on:</strong> ${new Date().toLocaleString()}</li>
            <li><strong>Status:</strong> Automated Delivery</li>
            <li><strong>Attachments:</strong> ${attachments.length} file(s)</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin-top: 24px;">
          <a href="mailto:support@vonneex2x.store" style="color: #4f46e5; text-decoration: none; font-weight: 600; font-size: 14px;">System Support</a>
        </div>
      </div>
  `;
  
  const html = getEmailWrapper(content);
  return await sendEmail(email, subject, text, html, attachments);
};

export const sendWorkerCredentials = async (email, workerName, password) => {
  const subject = '🔐 Your Vonne X2X Account Credentials';
  
  const content = `
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); padding: 32px 24px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 800;">Welcome Aboard!</h1>
        <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.95;">Account Created Successfully</p>
      </div>
      
      <!-- Content -->
      <div style="padding: 32px 24px;">
        <p style="font-size: 16px; color: #374151; margin-bottom: 24px; line-height: 1.6;">
          Hello <strong style="color: #0f172a;">${workerName}</strong>,
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 24px; line-height: 1.6;">
          Your account for Vonne X2X Management System has been created. You can now log in to access your dashboard and schedule.
        </p>
        
        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <h3 style="color: #0369a1; margin: 0 0 16px 0; font-size: 16px; font-weight: 700;">🔐 Login Credentials</h3>
          
          <div style="margin-bottom: 12px;">
            <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600;">Email</p>
            <p style="margin: 0; font-size: 16px; color: #0f172a; font-family: monospace; background: white; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">${email}</p>
          </div>
          
          <div>
            <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600;">Password</p>
            <p style="margin: 0; font-size: 16px; color: #0f172a; font-family: monospace; background: white; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">${password}</p>
          </div>
        </div>
        
        <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px;">
          <h3 style="color: #b45309; margin: 0 0 8px 0; font-size: 15px; font-weight: 700;">⚠️ Important</h3>
          <p style="margin: 0; color: #92400e; line-height: 1.5; font-size: 14px;">
            Please change your password immediately after your first login for security purposes.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 32px;">
          <a href="https://vonneex2x.store/login" style="display: inline-block; background: #0ea5e9; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(14, 165, 233, 0.2);">Login to Dashboard</a>
        </div>
      </div>
  `;
  
  const html = getEmailWrapper(content);
  return await sendEmail(email, subject, '', html);
};

