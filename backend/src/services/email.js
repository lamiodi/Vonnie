import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async (to, subject, text, html = null) => {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Vonne X2X <notifications@vonneex2x.store>',
      to,
      subject,
      text,
      html: html || text
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
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
        <h2 style="margin: 0; font-size: 28px;">📅 Appointment Reminder</h2>
      </div>
      
      <div style="padding: 30px;">
        <p style="font-size: 16px; color: #333;">Dear <strong>${bookingDetails.customerName}</strong>,</p>
        <p style="font-size: 16px; color: #555;">This is a friendly reminder for your upcoming appointment:</p>
        
        <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <h3 style="color: #667eea; margin-top: 0; font-size: 20px;">Appointment Details</h3>
          <div style="display: grid; grid-template-columns: 120px 1fr; gap: 10px; margin-top: 15px;">
            <span style="font-weight: 600; color: #666;">Service:</span>
            <span style="color: #333;">${bookingDetails.serviceName}</span>
            
            <span style="font-weight: 600; color: #666;">Date:</span>
            <span style="color: #333;">${new Date(bookingDetails.bookingDate).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</span>
            
            <span style="font-weight: 600; color: #666;">Time:</span>
            <span style="color: #333; font-weight: 600;">${bookingDetails.bookingTime}</span>
          </div>
        </div>
        
        <div style="background: #e3f2fd; border: 1px solid #bbdefb; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #1565c0; font-size: 14px;">
            <strong>💡 Tip:</strong> Please arrive 10 minutes early for your appointment to complete any necessary paperwork.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #666; font-size: 14px;">Need to reschedule or have questions?</p>
          <p style="color: #666; font-size: 14px;">Contact us at <a href="mailto:support@vonneex2x.store" style="color: #667eea;">support@vonneex2x.store</a></p>
        </div>
      </div>
      
      <div style="background: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
        <p style="margin: 0; color: #666; font-size: 14px;">Best regards,<br><strong>Vonne X2X Team</strong></p>
        <p style="margin: 10px 0 0 0; color: #999; font-size: 12px;">Professional Service Management System</p>
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
    ? 'Payment Confirmed - POS Transaction' 
    : 'Payment Confirmed - Your Booking is Confirmed!';
    
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); padding: 30px; text-align: center; color: white;">
        <h2 style="margin: 0; font-size: 28px;">✅ Payment Confirmed</h2>
      </div>
      
      <div style="padding: 30px;">
        <p style="font-size: 16px; color: #333;">Dear <strong>${customerName}</strong>,</p>
        <p style="font-size: 16px; color: #555;">Your payment has been successfully processed!</p>
        
        <div style="background: #f1f8e9; border: 1px solid #c5e1a5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #4CAF50; margin-top: 0; font-size: 20px;">Payment Details</h3>
          <div style="display: grid; grid-template-columns: 120px 1fr; gap: 10px; margin-top: 15px;">
            <span style="font-weight: 600; color: #666;">Amount:</span>
            <span style="color: #333; font-weight: 600;">₦${amount?.toFixed(2) || '0.00'}</span>
            
            <span style="font-weight: 600; color: #666;">Method:</span>
            <span style="color: #333;">${paymentMethod}</span>
            
            ${bookingNumber ? `
              <span style="font-weight: 600; color: #666;">Booking Number:</span>
              <span style="color: #333;">${bookingNumber}</span>
            ` : ''}
            
            ${source === 'pos' ? `
              <span style="font-weight: 600; color: #666;">Transaction Type:</span>
              <span style="color: #333;">Point of Sale</span>
            ` : ''}
          </div>
        </div>
        
        <div style="background: #e8f5e9; border: 1px solid #a5d6a7; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #2e7d32; font-size: 14px;">
            <strong>✨ Next Steps:</strong> Your booking is now confirmed and you will receive a reminder before your appointment.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #666; font-size: 14px;">Thank you for choosing Vonne X2X!</p>
        </div>
      </div>
      
      <div style="background: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
        <p style="margin: 0; color: #666; font-size: 14px;">Best regards,<br><strong>Vonne X2X Team</strong></p>
        <p style="margin: 10px 0 0 0; color: #999; font-size: 12px;">Professional Service Management System</p>
      </div>
    </div>
  `;
  
  return await sendEmail(email, subject, '', html);
};

// Unified inventory alert system
export const sendInventoryAlert = async (alertData) => {
  const {
    alertType = 'low_stock', // 'low_stock', 'out_of_stock', 'reorder_needed'
    products,
    recipientEmail = 'admin@vonneex2x.store'
  } = alertData;

  let subject, headerText, contextMessage;
  
  if (alertType === 'out_of_stock') {
    subject = '🚨 Out of Stock Alert - Vonne X2X';
    headerText = '🚨 Out of Stock Alert';
    contextMessage = 'The following products are completely out of stock:';
  } else if (alertType === 'reorder_needed') {
    subject = '📦 Reorder Alert - Vonne X2X';
    headerText = '📦 Reorder Alert';
    contextMessage = 'The following products need to be reordered:';
  } else {
    subject = '⚠️ Low Stock Alert - Vonne X2X';
    headerText = '⚠️ Low Stock Alert';
    contextMessage = 'The following products are running low on stock:';
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%); padding: 30px; text-align: center; color: white;">
        <h2 style="margin: 0; font-size: 28px;">${headerText}</h2>
      </div>
      
      <div style="padding: 30px;">
        <p style="font-size: 16px; color: #333;">Dear <strong>Inventory Manager</strong>,</p>
        <p style="font-size: 16px; color: #555;">${contextMessage}</p>
        
        <div style="background: #ffebee; border: 1px solid #ffcdd2; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #f44336; margin-top: 0; font-size: 20px;">Affected Products</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <tr style="background-color: #ffcdd2;">
              <th style="padding: 10px; text-align: left; font-weight: 600;">Product</th>
              <th style="padding: 10px; text-align: center; font-weight: 600;">SKU</th>
              <th style="padding: 10px; text-align: right; font-weight: 600;">Current Stock</th>
            </tr>
            ${products.map(product => `
              <tr style="border-bottom: 1px solid #ffcdd2;">
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
        
        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #666; font-size: 14px;">Need to update stock levels or have questions?</p>
          <p style="color: #666; font-size: 14px;">Contact the system administrator.</p>
        </div>
      </div>
      
      <div style="background: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
        <p style="margin: 0; color: #666; font-size: 14px;">Best regards,<br><strong>Vonne X2X Team</strong></p>
        <p style="margin: 10px 0 0 0; color: #999; font-size: 12px;">Professional Service Management System</p>
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

  let subject, headerText, contextMessage;
  
  if (isReschedule) {
    subject = 'Booking Rescheduled - Vonne X2X';
    headerText = '🔄 Booking Rescheduled';
    contextMessage = 'Your appointment has been successfully rescheduled. Here are your updated details:';
  } else if (isUpdate) {
    subject = 'Booking Updated - Vonne X2X';
    headerText = '📝 Booking Updated';
    contextMessage = 'Your appointment details have been updated:';
  } else {
    subject = 'Booking Confirmation - Vonne X2X';
    headerText = '✅ Booking Confirmed';
    contextMessage = 'Your booking has been confirmed! Here are the details:';
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #FF9800 0%, #F57C00 100%); padding: 30px; text-align: center; color: white;">
        <h2 style="margin: 0; font-size: 28px;">${headerText}</h2>
      </div>
      
      <div style="padding: 30px;">
        <p style="font-size: 16px; color: #333;">Dear <strong>${customerName}</strong>,</p>
        <p style="font-size: 16px; color: #555;">${contextMessage}</p>
        
        ${(isReschedule || isUpdate) && previousDate && previousTime ? `
          <div style="background: #fff3e0; border: 1px solid #ffe0b2; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #F57C00; margin-top: 0; font-size: 16px;">Previous Appointment</h4>
            <p style="margin: 5px 0; color: #666;">
              <strong>Date:</strong> ${new Date(previousDate).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}<br>
              <strong>Time:</strong> ${previousTime}
            </p>
          </div>
        ` : ''}
        
        <div style="background: #f8f9fa; border-left: 4px solid #FF9800; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <h3 style="color: #FF9800; margin-top: 0; font-size: 20px;">Appointment Details</h3>
          <div style="display: grid; grid-template-columns: 120px 1fr; gap: 10px; margin-top: 15px;">
            <span style="font-weight: 600; color: #666;">Booking Number:</span>
            <span style="color: #333; font-weight: 600;">${bookingNumber}</span>
            
            <span style="font-weight: 600; color: #666;">Service:</span>
            <span style="color: #333;">${serviceName}</span>
            
            <span style="font-weight: 600; color: #666;">Date:</span>
            <span style="color: #333;">${new Date(bookingDate).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</span>
            
            <span style="font-weight: 600; color: #666;">Time:</span>
            <span style="color: #333; font-weight: 600;">${bookingTime}</span>
            
            <span style="font-weight: 600; color: #666;">Price:</span>
            <span style="color: #333;">₦${price?.toFixed(2) || '0.00'}</span>
          </div>
        </div>
        
        <div style="background: #e3f2fd; border: 1px solid #bbdefb; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #1565c0; font-size: 14px;">
            <strong>💡 Important:</strong> Please arrive 10 minutes early for your appointment to complete any necessary paperwork.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #666; font-size: 14px;">Need to reschedule or have questions?</p>
          <p style="color: #666; font-size: 14px;">Contact us at <a href="mailto:support@vonneex2x.store" style="color: #FF9800;">support@vonneex2x.store</a></p>
        </div>
      </div>
      
      <div style="background: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
        <p style="margin: 0; color: #666; font-size: 14px;">Best regards,<br><strong>Vonne X2X Team</strong></p>
        <p style="margin: 10px 0 0 0; color: #999; font-size: 12px;">Professional Service Management System</p>
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
    ? 'Payment Confirmed - Your Booking is Confirmed!' 
    : 'Transaction Receipt - Vonne X2X';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); padding: 30px; text-align: center; color: white;">
        <h2 style="margin: 0; font-size: 28px;">${bookingNumber ? 'Payment Confirmed' : 'Transaction Receipt'}</h2>
      </div>
      
      <div style="padding: 30px;">
        <p style="font-size: 16px; color: #333;">Dear <strong>${customerName}</strong>,</p>
        <p style="font-size: 16px; color: #555;">Thank you for your transaction at Vonne X2X.</p>
        
        ${bookingNumber ? `
          <div style="background: #e3f2fd; border: 1px solid #bbdefb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #2196F3; margin-top: 0; font-size: 20px;">Booking Confirmation</h3>
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 10px;">
              <span style="font-weight: 600; color: #666;">Booking Number:</span>
              <span style="color: #333; font-weight: 600;">${bookingNumber}</span>
              
              <span style="font-weight: 600; color: #666;">Transaction ID:</span>
              <span style="color: #333;">${transactionId}</span>
            </div>
          </div>
        ` : ''}
        
        ${includeReceipt ? `
          <div style="background: #f5f5f5; border: 1px solid #e0e0e0; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0; font-size: 20px;">Transaction Details</h3>
            ${items && items.length > 0 ? `
              <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <tr style="background-color: #e0e0e0;">
                  <th style="padding: 10px; text-align: left; font-weight: 600;">Item</th>
                  <th style="padding: 10px; text-align: right; font-weight: 600;">Amount</th>
                </tr>
                ${items.map(item => `
                  <tr style="border-bottom: 1px solid #e0e0e0;">
                    <td style="padding: 10px;">${item.name}</td>
                    <td style="padding: 10px; text-align: right;">₦${item.amount.toFixed(2)}</td>
                  </tr>
                `).join('')}
              </table>
            ` : ''}
            <div style="border-top: 2px solid #333; margin-top: 15px; padding-top: 15px; text-align: right;">
              <p style="margin: 5px 0; font-size: 16px;">
                <strong>Total: ₦${totalAmount.toFixed(2)}</strong>
              </p>
              <p style="margin: 5px 0; color: #666;">
                <strong>Payment Method:</strong> ${paymentMethod}
              </p>
            </div>
          </div>
        ` : ''}
        
        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #666; font-size: 14px;">Thank you for choosing Vonne X2X!</p>
        </div>
      </div>
      
      <div style="background: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
        <p style="margin: 0; color: #666; font-size: 14px;">Best regards,<br><strong>Vonne X2X Team</strong></p>
        <p style="margin: 10px 0 0 0; color: #999; font-size: 12px;">Professional Service Management System</p>
      </div>
    </div>
  `;
  
  return await sendEmail(email, subject, '', html);
};