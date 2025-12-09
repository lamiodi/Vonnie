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
  <link href="https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=UnifrakturCook:wght@700&display=swap" rel="stylesheet">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=UnifrakturCook:wght@700&display=swap');
  </style>
`;

export const sendEmail = async (to, subject, text, html = null) => {
  try {
    const resend = getResendClient();
    // Inject font imports if HTML is provided
    const finalHtml = html ? `${FONT_IMPORTS}${html}` : html;
    
    const { data, error } = await resend.emails.send({
      from: 'Vonne X2X <notifications@vonneex2x.store>',
      to,
      subject,
      text,
      html: finalHtml || text
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
  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e5e7eb;">
      <!-- Header with gradient -->
      <div style="background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%); padding: 32px 24px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
          ✅ Booking Confirmed!
        </h1>
        <p style="margin: 8px 0 0 0; font-size: 18px; opacity: 0.9; font-weight: 400;">Your appointment has been successfully booked</p>
      </div>
      
      <!-- Main content -->
      <div style="padding: 32px 24px;">
        <p style="font-size: 18px; color: #374151; margin-bottom: 24px; line-height: 1.6;">Dear <strong style="color: #111827;">${bookingDetails.customerName}</strong>,</p>
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin-bottom: 24px;">
          Thank you for choosing Vonne X2X! We're excited to confirm your appointment.
        </p>
        
        <!-- Booking Details Card -->
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin: 24px 0;">
          <h3 style="color: #111827; margin: 0 0 16px 0; font-size: 20px; font-weight: 700;">
            📋 Booking Details
          </h3>
          
          <div style="display: grid; gap: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: white; border-radius: 6px; border-left: 4px solid #9333ea;">
              <span style="font-weight: 600; color: #6b7280; font-size: 15px;">Booking Number:</span>
              <span style="color: #9333ea; font-weight: 700; font-size: 16px; font-family: 'Courier New', monospace;">${bookingDetails.bookingNumber}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: white; border-radius: 6px; border-left: 4px solid #ec4899;">
              <span style="font-weight: 600; color: #6b7280; font-size: 15px;">Service:</span>
              <span style="color: #374151; font-weight: 600; font-size: 16px;">${bookingDetails.serviceName}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: white; border-radius: 6px; border-left: 4px solid #9333ea;">
              <span style="font-weight: 600; color: #6b7280; font-size: 15px;">Date:</span>
              <span style="color: #374151; font-weight: 600; font-size: 16px;">${new Date(bookingDetails.bookingDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: white; border-radius: 6px; border-left: 4px solid #ec4899;">
              <span style="font-weight: 600; color: #6b7280; font-size: 15px;">Time:</span>
              <span style="color: #374151; font-weight: 700; font-size: 18px;">${bookingDetails.bookingTime}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: white; border-radius: 6px; border-left: 4px solid #059669;">
              <span style="font-weight: 600; color: #6b7280; font-size: 15px;">Price:</span>
              <span style="color: #059669; font-weight: 700; font-size: 18px;">₦${bookingDetails.price}</span>
            </div>
          </div>
        </div>
        
        <!-- Next steps -->
        <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <h4 style="margin: 0 0 8px 0; color: #0369a1; font-size: 14px; font-weight: 600;">✨ Next Steps</h4>
          <p style="margin: 0; color: #0c4a6e; font-size: 13px; line-height: 1.5;">
            Please arrive 10 minutes early. We can't wait to see you!
          </p>
        </div>
        
        <!-- Contact info -->
        <div style="text-align: center; margin: 24px 0; padding: 16px; background: #f9fafb; border-radius: 8px;">
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">Need to reschedule?</p>
          <p style="margin: 0; color: #374151; font-weight: 500;">
            Contact us at <a href="mailto:support@vonneex2x.store" style="color: #9333ea; text-decoration: none; font-weight: 600;">support@vonneex2x.store</a>
          </p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="background: #111827; padding: 24px; text-align: center; color: white;">
        <p style="margin: 0; font-size: 16px; font-weight: 600; margin-bottom: 4px;">Vonne X2X</p>
        <p style="margin: 0; font-size: 13px; opacity: 0.7;">Professional Service Management System</p>
        <p style="margin: 8px 0 0 0; font-size: 11px; opacity: 0.6;">Thank you for choosing us!</p>
      </div>
    </div>
  `;
  
  return await sendEmail(userEmail, subject, '', html);
};

export const sendBookingReminder = async (userEmail, bookingDetails) => {
  const subject = '⏰ Appointment Reminder - Vonne X2X';
  const html = `
    <div style="font-family: 'Patrick Hand', cursive, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border: 2px solid #f59e0b;">
      <!-- Header with gradient -->
      <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 30px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 32px; font-family: 'UnifrakturCook', cursive, serif; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">
          ⏰ Appointment Reminder
        </h1>
        <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">Your beauty appointment is coming up!</p>
      </div>
      
      <!-- Main content -->
      <div style="padding: 30px;">
        <p style="font-size: 18px; color: #1f2937; margin-bottom: 20px;">Dear <strong style="color: #9333ea;">${bookingDetails.customerName}</strong>,</p>
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin-bottom: 25px;">
          This is a friendly reminder for your upcoming beauty appointment. We're excited to see you soon!
        </p>
        
        <!-- Appointment details card -->
        <div style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 2px solid #f59e0b; border-radius: 16px; padding: 25px; margin: 25px 0; box-shadow: 0 4px 20px rgba(245, 158, 11, 0.1);">
          <h3 style="color: #d97706; margin: 0 0 20px 0; font-size: 22px; font-family: 'UnifrakturCook', cursive, serif; background: linear-gradient(45deg, #f59e0b, #d97706); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
            📅 Appointment Details
          </h3>
          
          <div style="display: grid; gap: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; background: white; border-radius: 10px; border-left: 4px solid #f59e0b;">
              <span style="font-weight: 600; color: #6b7280;">Service:</span>
              <span style="color: #1f2937; font-weight: 600;">${bookingDetails.serviceName}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; background: white; border-radius: 10px; border-left: 4px solid #d97706;">
              <span style="font-weight: 600; color: #6b7280;">Date:</span>
              <span style="color: #1f2937; font-weight: 600;">${new Date(bookingDetails.bookingDate).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; background: white; border-radius: 10px; border-left: 4px solid #f59e0b;">
              <span style="font-weight: 600; color: #6b7280;">Time:</span>
              <span style="color: #1f2937; font-weight: bold; font-size: 18px;">${bookingDetails.bookingTime}</span>
            </div>
          </div>
        </div>
        
        <!-- Tips section -->
        <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 12px; padding: 20px; margin: 25px 0;">
          <h4 style="margin: 0 0 10px 0; color: #0369a1; font-size: 16px; font-weight: 600;">💡 Appointment Tips</h4>
          <ul style="margin: 0; padding-left: 20px; color: #0c4a6e; font-size: 14px; line-height: 1.6;">
            <li>Please arrive 10 minutes early for your appointment</li>
            <li>Bring any relevant documents or preferences</li>
          </ul>
        </div>
        
        <!-- Contact info -->
        <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f8fafc; border-radius: 12px;">
          <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px;">Need to reschedule?</p>
          <p style="margin: 0; color: #9333ea; font-weight: 600;">
            Contact us at <a href="mailto:support@vonneex2x.store" style="color: #ec4899; text-decoration: none;">support@vonneex2x.store</a>
          </p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="background: linear-gradient(135deg, #1f2937 0%, #374151 100%); padding: 30px; text-align: center; color: white;">
        <p style="margin: 0; font-size: 18px; font-family: 'UnifrakturCook', cursive, serif; margin-bottom: 10px;">Vonne X2X</p>
        <p style="margin: 0; font-size: 14px; opacity: 0.8;">Professional Service Management System</p>
      </div>
    </div>
  `;
  
  return await sendEmail(userEmail, subject, '', html);
};

// Unified payment confirmation service
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
    
  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e5e7eb;">
      <!-- Header with gradient -->
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px 24px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
          💳 Payment Confirmed
        </h1>
        <p style="margin: 8px 0 0 0; font-size: 18px; opacity: 0.9; font-weight: 400;">Your payment has been successfully processed!</p>
      </div>
      
      <!-- Main content -->
      <div style="padding: 32px 24px;">
        <p style="font-size: 18px; color: #374151; margin-bottom: 24px; line-height: 1.6;">Dear <strong style="color: #111827;">${customerName}</strong>,</p>
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin-bottom: 24px;">
          Your payment has been successfully processed and your booking is now confirmed!
        </p>
        
        <!-- Payment details card -->
        <div style="background: #f0fdf4; border: 1px solid #10b981; border-radius: 8px; padding: 24px; margin: 24px 0;">
          <h3 style="color: #059669; margin: 0 0 16px 0; font-size: 20px; font-weight: 700;">
            💰 Payment Details
          </h3>
          
          <div style="display: grid; gap: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: white; border-radius: 6px; border-left: 4px solid #10b981;">
              <span style="font-weight: 600; color: #6b7280; font-size: 15px;">Amount:</span>
              <span style="color: #059669; font-weight: 700; font-size: 18px;">₦${amount?.toFixed(2) || '0.00'}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: white; border-radius: 6px; border-left: 4px solid #059669;">
              <span style="font-weight: 600; color: #6b7280; font-size: 15px;">Method:</span>
              <span style="color: #1f2937; font-weight: 600; font-size: 16px;">${paymentMethod}</span>
            </div>
            
            ${bookingNumber ? `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: white; border-radius: 6px; border-left: 4px solid #10b981;">
                <span style="font-weight: 600; color: #6b7280; font-size: 15px;">Booking Number:</span>
                <span style="color: #9333ea; font-weight: 700; font-size: 16px; font-family: 'Courier New', monospace;">${bookingNumber}</span>
              </div>
            ` : ''}
            
            ${source === 'pos' ? `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: white; border-radius: 6px; border-left: 4px solid #059669;">
                <span style="font-weight: 600; color: #6b7280; font-size: 15px;">Transaction Type:</span>
                <span style="color: #1f2937; font-weight: 600; font-size: 16px;">Point of Sale</span>
              </div>
            ` : ''}
          </div>
        </div>
        
        <!-- Next steps -->
        <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 12px; padding: 20px; margin: 25px 0;">
          <h4 style="margin: 0 0 10px 0; color: #0369a1; font-size: 16px; font-weight: 600;">✨ Next Steps</h4>
          <p style="margin: 0; color: #0c4a6e; font-size: 14px; line-height: 1.5;">
            Your booking is now confirmed! You'll receive a reminder before your appointment.
          </p>
        </div>
        
        <!-- Contact info -->
        <div style="text-align: center; margin: 24px 0; padding: 16px; background: #f9fafb; border-radius: 8px;">
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">Questions?</p>
          <p style="margin: 0; color: #374151; font-weight: 500;">
            Contact us at <a href="mailto:support@vonneex2x.store" style="color: #9333ea; text-decoration: none; font-weight: 600;">support@vonneex2x.store</a>
          </p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="background: #111827; padding: 24px; text-align: center; color: white;">
        <p style="margin: 0; font-size: 16px; font-weight: 600; margin-bottom: 4px;">Vonne X2X</p>
        <p style="margin: 0; font-size: 13px; opacity: 0.7;">Professional Service Management System</p>
      </div>
    </div>
  `;
  
  return await sendEmail(email, subject, '', html);
};

export const sendWebhookAlert = async (alertType, errorDetails, webhookData = null) => {
  const subject = `🚨 Vonne X2X Webhook Alert - ${alertType}`;
  
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@vonneex2x.store';
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@vonneex2x.store';
  
  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 28px; font-weight: bold;">🚨 Webhook Alert</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">${alertType}</p>
      </div>
      
      <!-- Content -->
      <div style="padding: 30px;">
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="color: #dc2626; margin: 0 0 15px 0;">⚠️ Error Details</h3>
          <pre style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 15px; font-size: 14px; color: #374151; overflow-x: auto; margin: 0;">${JSON.stringify(errorDetails, null, 2)}</pre>
        </div>
        
        ${webhookData ? `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="color: #1f2937; margin: 0 0 15px 0;">📡 Webhook Data</h3>
          <pre style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 15px; font-size: 14px; color: #374151; overflow-x: auto; margin: 0;">${JSON.stringify(webhookData, null, 2)}</pre>
        </div>
        ` : ''}
        
        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px;">
          <h3 style="color: #0369a1; margin: 0 0 10px 0;">🔍 Action Required</h3>
          <p style="margin: 0; color: #374151; line-height: 1.6;">
            Please investigate this webhook issue immediately. Check the logs for more details and ensure payment processing is working correctly.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 25px; padding: 15px; background: #f8fafc; border-radius: 8px;">
          <p style="margin: 0; color: #64748b; font-size: 14px;">
            Time: ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' })}
          </p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="background: linear-gradient(135deg, #1f2937 0%, #374151 100%); padding: 20px; text-align: center; color: white;">
        <p style="margin: 0; font-size: 14px; opacity: 0.8;">Vonne X2X Management System</p>
      </div>
    </div>
  `;
  
  // Send to both admin and support emails
  const recipients = [adminEmail, supportEmail].filter(Boolean).join(',');
  return await sendEmail(recipients, subject, '', html);
};

// Unified inventory alert system (updated with Patrick Hand)
export const sendInventoryAlert = async (alertData) => {
  const {
    alertType = 'low_stock', // 'low_stock', 'out_of_stock', 'reorder_needed'
    products,
    recipientEmail = 'admin@vonneex2x.store'
  } = alertData;

  let subject, headerText, contextMessage, headerGradient;
  
  if (alertType === 'out_of_stock') {
    subject = '🚨 Out of Stock Alert - Vonne X2X';
    headerText = '🚨 Out of Stock Alert';
    contextMessage = 'The following products are completely out of stock:';
    headerGradient = 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)';
  } else if (alertType === 'reorder_needed') {
    subject = '📦 Reorder Alert - Vonne X2X';
    headerText = '📦 Reorder Alert';
    contextMessage = 'The following products need to be reordered:';
    headerGradient = 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)';
  } else {
    subject = '⚠️ Low Stock Alert - Vonne X2X';
    headerText = '⚠️ Low Stock Alert';
    contextMessage = 'The following products are running low on stock:';
    headerGradient = 'linear-gradient(135deg, #ff9800 0%, #ef6c00 100%)';
  }

  const html = `
    <div style="font-family: 'Patrick Hand', cursive, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
      <div style="background: ${headerGradient}; padding: 30px; text-align: center; color: white;">
        <h2 style="margin: 0; font-size: 28px; font-family: 'UnifrakturCook', cursive, serif;">${headerText}</h2>
      </div>
      
      <div style="padding: 30px;">
        <p style="font-size: 16px; color: #333;">Dear <strong>Inventory Manager</strong>,</p>
        <p style="font-size: 16px; color: #555;">${contextMessage}</p>
        
        <div style="background: #fff; border: 1px solid #eee; padding: 0; border-radius: 8px; margin: 20px 0; overflow: hidden;">
          <h3 style="background: #f5f5f5; margin: 0; padding: 15px; color: #333; font-size: 18px; border-bottom: 1px solid #eee;">Affected Products</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background-color: #fafafa;">
              <th style="padding: 10px; text-align: left; font-weight: 600;">Product</th>
              <th style="padding: 10px; text-align: center; font-weight: 600;">SKU</th>
              <th style="padding: 10px; text-align: right; font-weight: 600;">Current Stock</th>
            </tr>
            ${products.map(product => `
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px;">${product.name}</td>
                <td style="padding: 10px; text-align: center;">${product.sku}</td>
                <td style="padding: 10px; text-align: right; font-weight: 600; color: ${product.stock_level === 0 ? '#f44336' : '#ff9800'};">
                  ${product.stock_level} units
                </td>
              </tr>
            `).join('')}
          </table>
        </div>
        
        <div style="background: #e3f2fd; border: 1px solid #bbdefb; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #1565c0; font-size: 14px;">
            <strong>📋 Action Required:</strong> Please review these stock levels and place orders with suppliers as needed.
          </p>
        </div>
      </div>
      
      <div style="background: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
        <p style="margin: 0; color: #666; font-size: 14px;">Best regards,<br><strong>Vonne X2X Team</strong></p>
      </div>
    </div>
  `;
  
  return await sendEmail(recipientEmail, subject, '', html);
};

// Unified booking confirmation service
export const sendUnifiedBookingConfirmation = async (email, bookingData, context = {}) => {
  const {
    bookingNumber,
    customerName,
    serviceName,
    bookingDate,
    bookingTime,
    price,
    status = 'confirmed', // 'confirmed', 'rescheduled', 'updated'
    previousDate,
    previousTime
  } = bookingData;

  const { isReschedule = false, isUpdate = false } = context;

  let subject, headerText, contextMessage, headerGradient;
  
  if (isReschedule) {
    subject = '🔄 Booking Rescheduled - Vonne X2X';
    headerText = '🔄 Booking Rescheduled';
    contextMessage = 'Your appointment has been successfully rescheduled. Here are your updated details:';
    headerGradient = 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)';
  } else if (isUpdate) {
    subject = '📝 Booking Updated - Vonne X2X';
    headerText = '📝 Booking Updated';
    contextMessage = 'Your appointment details have been updated:';
    headerGradient = 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)';
  } else {
    subject = '✅ Booking Confirmation - Vonne X2X';
    headerText = '✅ Booking Confirmed';
    contextMessage = 'Your booking has been confirmed! Here are the details:';
    headerGradient = 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)';
  }

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e5e7eb;">
      <!-- Header with gradient -->
      <div style="background: ${headerGradient}; padding: 32px 24px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">
          ${headerText}
        </h1>
        <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9; font-weight: 400;">${contextMessage}</p>
      </div>
      
      <!-- Main content -->
      <div style="padding: 32px 24px;">
        <p style="font-size: 16px; color: #374151; margin-bottom: 24px; line-height: 1.6;">Dear <strong style="color: #111827;">${customerName}</strong>,</p>
        
        ${(isReschedule || isUpdate) && previousDate && previousTime ? `
          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <h4 style="color: #d97706; margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">
              📅 Previous Appointment
            </h4>
            <div style="display: grid; gap: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: white; border-radius: 6px; border-left: 3px solid #f59e0b;">
                <span style="font-weight: 500; color: #6b7280;">Date:</span>
                <span style="color: #374151; font-weight: 500;">${new Date(previousDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: white; border-radius: 6px; border-left: 3px solid #d97706;">
                <span style="font-weight: 500; color: #6b7280;">Time:</span>
                <span style="color: #374151; font-weight: 500;">${previousTime}</span>
              </div>
            </div>
          </div>
        ` : ''}
        
        <!-- Appointment details card -->
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin: 24px 0;">
          <h3 style="color: #111827; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">
            📋 Appointment Details
          </h3>
          
          <div style="display: grid; gap: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: white; border-radius: 6px; border-left: 3px solid #9333ea;">
              <span style="font-weight: 500; color: #6b7280;">Booking Number:</span>
              <span style="color: #9333ea; font-weight: 600; font-size: 14px; font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;">${bookingNumber}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: white; border-radius: 6px; border-left: 3px solid #ec4899;">
              <span style="font-weight: 500; color: #6b7280;">Service:</span>
              <span style="color: #374151; font-weight: 500;">${serviceName}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: white; border-radius: 6px; border-left: 3px solid #9333ea;">
              <span style="font-weight: 500; color: #6b7280;">Date:</span>
              <span style="color: #374151; font-weight: 500;">${new Date(bookingDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: white; border-radius: 6px; border-left: 3px solid #ec4899;">
              <span style="font-weight: 500; color: #6b7280;">Time:</span>
              <span style="color: #374151; font-weight: 600; font-size: 16px;">${bookingTime}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: white; border-radius: 6px; border-left: 3px solid #059669;">
              <span style="font-weight: 500; color: #6b7280;">Price:</span>
              <span style="color: #059669; font-weight: 600; font-size: 16px;">₦${price?.toFixed(2) || '0.00'}</span>
            </div>
          </div>
        </div>
        
        <!-- Contact info -->
        <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f8fafc; border-radius: 12px;">
          <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px;">Questions?</p>
          <p style="margin: 0; color: #9333ea; font-weight: 600;">
            Contact us at <a href="mailto:support@vonneex2x.store" style="color: #ec4899; text-decoration: none;">support@vonneex2x.store</a>
          </p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="background: linear-gradient(135deg, #1f2937 0%, #374151 100%); padding: 30px; text-align: center; color: white;">
        <p style="margin: 0; font-size: 18px; font-family: 'UnifrakturCook', cursive, serif; margin-bottom: 10px;">Vonne X2X</p>
        <p style="margin: 0; font-size: 14px; opacity: 0.8;">Professional Service Management System</p>
      </div>
    </div>
  `;
  
  return await sendEmail(email, subject, '', html);
};

export const sendPOSTransactionEmail = async (email, transactionData) => {
  const {
    customerName,
    transactionId,
    items,
    totalAmount,
    paymentMethod,
    bookingNumber,
    includeReceipt = true
  } = transactionData;

  const subject = bookingNumber 
    ? '💳 Payment Confirmed - Your Booking is Confirmed!' 
    : '🧾 Transaction Receipt - Vonne X2X';

  const html = `
    <div style="font-family: 'Patrick Hand', cursive, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border: 2px solid #3b82f6;">
      <!-- Header with gradient -->
      <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 40px 30px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 32px; font-family: 'UnifrakturCook', cursive, serif; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">
          ${bookingNumber ? '💳 Payment Confirmed' : '🧾 Transaction Receipt'}
        </h1>
        <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">Thank you for your transaction at Vonne X2X</p>
      </div>
      
      <!-- Main content -->
      <div style="padding: 30px;">
        <p style="font-size: 18px; color: #1f2937; margin-bottom: 20px;">Dear <strong style="color: #3b82f6;">${customerName}</strong>,</p>
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin-bottom: 25px;">
          Thank you for your transaction at Vonne X2X. We're pleased to confirm your payment details below.
        </p>
        
        ${bookingNumber ? `
          <div style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border: 2px solid #3b82f6; border-radius: 16px; padding: 25px; margin: 25px 0; box-shadow: 0 4px 20px rgba(59, 130, 246, 0.1);">
            <h3 style="color: #1d4ed8; margin: 0 0 20px 0; font-size: 22px; font-family: 'UnifrakturCook', cursive, serif; background: linear-gradient(45deg, #3b82f6, #1d4ed8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
              📋 Booking Confirmation
            </h3>
            <div style="display: grid; gap: 15px;">
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; background: white; border-radius: 10px; border-left: 4px solid #3b82f6;">
                <span style="font-weight: 600; color: #6b7280;">Booking Number:</span>
                <span style="color: #1d4ed8; font-weight: bold; font-size: 16px; font-family: monospace;">${bookingNumber}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; background: white; border-radius: 10px; border-left: 4px solid #1d4ed8;">
                <span style="font-weight: 600; color: #6b7280;">Transaction ID:</span>
                <span style="color: #1f2937; font-weight: 600;">${transactionId}</span>
              </div>
            </div>
          </div>
        ` : ''}
        
        ${includeReceipt ? `
          <div style="background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border: 2px solid #64748b; border-radius: 16px; padding: 25px; margin: 25px 0; box-shadow: 0 4px 20px rgba(100, 116, 139, 0.1);">
            <h3 style="color: #334155; margin: 0 0 20px 0; font-size: 22px; font-family: 'UnifrakturCook', cursive, serif; background: linear-gradient(45deg, #64748b, #475569); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
              🧾 Transaction Details
            </h3>
            ${items && items.length > 0 ? `
              <div style="margin-bottom: 20px;">
                ${items.map(item => `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; background: white; border-radius: 10px; border-left: 4px solid #64748b; margin-bottom: 10px;">
                    <span style="font-weight: 600; color: #1f2937;">${item.name}</span>
                    <span style="color: #059669; font-weight: bold; font-size: 16px;">₦${item.amount.toFixed(2)}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            <div style="border-top: 2px solid #64748b; margin-top: 20px; padding-top: 20px; text-align: right; background: white; border-radius: 10px; padding: 15px;">
              <p style="margin: 5px 0; font-size: 18px;">
                <strong style="color: #1f2937;">Total Amount:</strong> 
                <strong style="color: #059669; font-size: 24px;">₦${totalAmount.toFixed(2)}</strong>
              </p>
              <p style="margin: 10px 0 0 0; color: #64748b; font-size: 14px;">
                <strong>Payment Method:</strong> 
                <span style="color: #1f2937; font-weight: 600;">${paymentMethod}</span>
              </p>
            </div>
          </div>
        ` : ''}
        
        <!-- Contact info -->
        <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f8fafc; border-radius: 12px;">
          <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px;">Questions?</p>
          <p style="margin: 0; color: #9333ea; font-weight: 600;">
            Contact us at <a href="mailto:support@vonneex2x.store" style="color: #ec4899; text-decoration: none;">support@vonneex2x.store</a>
          </p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="background: linear-gradient(135deg, #1f2937 0%, #374151 100%); padding: 30px; text-align: center; color: white;">
        <p style="margin: 0; font-size: 18px; font-family: 'UnifrakturCook', cursive, serif; margin-bottom: 10px;">Vonne X2X</p>
        <p style="margin: 0; font-size: 14px; opacity: 0.8;">Professional Service Management System</p>
      </div>
    </div>
  `;
  
  return await sendEmail(email, subject, '', html);
};
