import cron from 'node-cron';
import { query } from '../config/db.js';
import { sendDailyAttendanceReport } from '../services/email.js';

export const scheduleDailyAttendanceReport = () => {
  // Run every day at 10:00 AM Lagos Time
  cron.schedule('0 10 * * *', async () => {
    console.log('⏰ Starting Daily Attendance Report job...');

    try {
      // 1. Get the admin email
      const adminResult = await query("SELECT email FROM users WHERE role = 'admin' LIMIT 1");
      if (adminResult.rows.length === 0) {
        console.log('❌ No admin found to send attendance report to.');
        return;
      }
      const adminEmail = process.env.ADMIN_EMAIL || adminResult.rows[0].email;

      // 2. Determine today's date in Lagos Time
      const now = new Date();
      const lagosTimeStr = now.toLocaleString('en-US', { timeZone: 'Africa/Lagos' });
      const lagosDate = new Date(lagosTimeStr);
      const todayStr = lagosDate.toISOString().split('T')[0];
      
      const formattedDate = lagosDate.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
      });

      // 3. Fetch all active workers (staff & managers)
      const workersResult = await query(
        "SELECT id, name, role FROM users WHERE role IN ('staff', 'manager') AND is_active = true"
      );
      const activeWorkers = workersResult.rows;

      if (activeWorkers.length === 0) {
        console.log('ℹ️ No active workers found.');
        return;
      }

      // 4. Fetch today's attendance records
      const attendanceResult = await query(
        `SELECT * FROM attendance WHERE date = $1 OR date::text LIKE $2`,
        [todayStr, `${todayStr}%`]
      );
      const attendanceRecords = attendanceResult.rows;

      // 5. Compile the report data
      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;

      const workersData = activeWorkers.map(worker => {
        const record = attendanceRecords.find(r => r.worker_id === worker.id);
        
        let status = 'absent';
        let checkInTime = null;
        let verificationMethod = 'None';

        if (record) {
          status = record.status === 'late' ? 'late' : 'present';
          
          if (status === 'present') presentCount++;
          if (status === 'late') lateCount++;

          if (record.check_in_time) {
            const timeObj = new Date(record.check_in_time);
            checkInTime = timeObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          }

          if (record.location_verification_status === 'verified') {
            // Determine if it was Fingerprint or GPS
            // In our system, fingerprint doesn't set lat/lng but sets verified
            if (record.check_in_latitude && record.check_in_longitude) {
              verificationMethod = 'GPS';
            } else {
              verificationMethod = 'Fingerprint / Kiosk';
            }
          } else {
            verificationMethod = 'Unverified / Flagged';
          }
        } else {
          absentCount++;
        }

        return {
          name: worker.name,
          role: worker.role,
          status,
          checkInTime,
          verificationMethod
        };
      });

      const reportData = {
        date: formattedDate,
        totalWorkers: activeWorkers.length,
        presentCount,
        lateCount,
        absentCount,
        workers: workersData
      };

      // 6. Send the email
      console.log(`📧 Sending attendance report to ${adminEmail}...`);
      await sendDailyAttendanceReport(adminEmail, reportData);
      console.log('✅ Daily Attendance Report sent successfully.');

    } catch (error) {
      console.error('❌ Error running daily attendance report job:', error);
    }
  }, {
    scheduled: true,
    timezone: "Africa/Lagos"
  });
};
