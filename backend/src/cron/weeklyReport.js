import cron from 'node-cron';
import { generateWeeklyReport } from '../services/reportService.js';
import { sendEmail } from '../services/email.js';
import { query } from '../config/db.js';

export const scheduleWeeklyReport = () => {
  // Run every Tuesday at 9:00 AM
  cron.schedule('0 9 * * 2', async () => {
    console.log('🔄 Starting weekly report generation job...');
    
    try {
      // Calculate date range (Previous Week: Monday to Sunday)
      const today = new Date();
      const lastSunday = new Date(today);
      lastSunday.setDate(today.getDate() - 2); // Tuesday - 2 = Sunday
      lastSunday.setHours(23, 59, 59, 999);

      const lastMonday = new Date(lastSunday);
      lastMonday.setDate(lastSunday.getDate() - 6); // Sunday - 6 = Monday
      lastMonday.setHours(0, 0, 0, 0);

      console.log(`📅 Report Period: ${lastMonday.toDateString()} to ${lastSunday.toDateString()}`);

      // Generate PDF
      const pdfBuffer = await generateWeeklyReport(lastMonday, lastSunday);
      console.log('✅ Report PDF generated successfully.');

      // Get Admin Emails
      const adminQuery = `SELECT email FROM users WHERE role = 'admin' OR role = 'manager'`;
      const adminResult = await query(adminQuery);
      const admins = adminResult.rows.map(row => row.email);

      if (admins.length === 0) {
        console.warn('⚠️ No admins found to send report to.');
        return;
      }

      console.log(`📧 Sending report to ${admins.length} recipients: ${admins.join(', ')}`);

      // Send Email
      const subject = `Weekly Activity Report (${lastMonday.toLocaleDateString()} - ${lastSunday.toLocaleDateString()})`;
      const text = `Please find attached the weekly activity report for the period ${lastMonday.toDateString()} to ${lastSunday.toDateString()}.`;
      const html = `
        <div style="font-family: 'Manrope', Arial, sans-serif; padding: 20px;">
          <h2 style="color: #333;">Weekly Activity Report</h2>
          <p>Please find attached the weekly activity report for the period <strong>${lastMonday.toDateString()}</strong> to <strong>${lastSunday.toDateString()}</strong>.</p>
          <p><strong>Summary:</strong></p>
          <ul>
            <li>Generated on: ${new Date().toLocaleString()}</li>
            <li>Status: Automated Delivery</li>
          </ul>
          <p>Best regards,<br>Vonne X2X System</p>
        </div>
      `;

      const attachments = [
        {
          filename: `Weekly_Report_${lastMonday.toISOString().split('T')[0]}.pdf`,
          content: pdfBuffer
        }
      ];

      for (const email of admins) {
        await sendEmail(email, subject, text, html, attachments);
      }

      console.log('✅ Weekly report job completed successfully.');

    } catch (error) {
      console.error('❌ Error generating or sending weekly report:', error);
    }
  });
  
  console.log('✅ Weekly report scheduler initialized (Every Tuesday at 9:00 AM)');
};
