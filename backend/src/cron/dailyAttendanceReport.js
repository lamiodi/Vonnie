import cron from 'node-cron';
import { query } from '../config/db.js';
import { sendDailyAttendanceReport } from '../services/email.js';
import { getLagosDateStr, formatLagosTime, lagosDayBoundsUTC } from '../utils/lagosTime.js';

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

      // 2. Today's date in Lagos Time
      const todayStr = getLagosDateStr();
      const formattedDate = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Lagos',
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
      }).format(new Date());

      const { startUTC, endUTC } = lagosDayBoundsUTC(todayStr);

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
        `SELECT * FROM attendance WHERE date = $1`,
        [todayStr]
      );
      const attendanceRecords = attendanceResult.rows;

      // 5. Compile the attendance data
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
            // Render in Lagos wall clock — server runs UTC and would otherwise
            // show every check-in one hour early
            checkInTime = formatLagosTime(record.check_in_time);
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

      // 6. Today's bookings with their assigned workers
      const bookingsResult = await query(
        `SELECT b.id, b.booking_number, b.customer_name, b.scheduled_time, b.status,
                COALESCE(svc.service_names, '{}') AS service_names,
                COALESCE(array_agg(u.name ORDER BY u.name) FILTER (WHERE u.name IS NOT NULL), '{}') AS worker_names
         FROM bookings b
         LEFT JOIN booking_workers bw ON bw.booking_id = b.id AND bw.status = 'active'
         LEFT JOIN users u ON u.id = bw.worker_id
         LEFT JOIN LATERAL (
           SELECT array_agg(s.name ORDER BY s.name) AS service_names
           FROM booking_services bs
           JOIN services s ON s.id = bs.service_id
           WHERE bs.booking_id = b.id
         ) svc ON TRUE
         WHERE b.scheduled_time >= $1 AND b.scheduled_time < $2
         GROUP BY b.id, svc.service_names
         ORDER BY b.scheduled_time ASC`,
        [startUTC, endUTC]
      );

      const bookingsData = bookingsResult.rows.map(b => ({
        bookingNumber: b.booking_number,
        customerName: b.customer_name,
        services: b.service_names.length > 0 ? b.service_names.join(', ') : '—',
        time: formatLagosTime(b.scheduled_time),
        status: b.status,
        workers: b.worker_names.length > 0 ? b.worker_names.join(', ') : 'Unassigned'
      }));

      const reportData = {
        date: formattedDate,
        totalWorkers: activeWorkers.length,
        presentCount,
        lateCount,
        absentCount,
        workers: workersData,
        bookings: bookingsData
      };

      // 7. Send the email
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
