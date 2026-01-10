import PDFDocument from 'pdfkit';
import { query } from '../config/db.js';
import fs from 'fs';
import path from 'path';

export const generateWeeklyReport = async (startDate, endDate) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // --- Header ---
      doc.fontSize(20).text('Weekly Activity Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Period: ${startDate.toDateString()} - ${endDate.toDateString()}`, { align: 'center' });
      doc.moveDown();
      doc.moveDown();

      // --- 1. Attendance Records ---
      doc.fontSize(16).text('1. Attendance Records', { underline: true });
      doc.moveDown();

      const attendanceQuery = `
        SELECT a.*, u.name as worker_name 
        FROM attendance a 
        JOIN users u ON a.worker_id = u.id 
        WHERE a.date >= $1 AND a.date <= $2 
        ORDER BY a.date ASC, u.name ASC
      `;
      const attendanceResult = await query(attendanceQuery, [startDate, endDate]);
      
      if (attendanceResult.rows.length === 0) {
        doc.fontSize(12).text('No attendance records found for this period.');
      } else {
        // Group by User
        const attendanceByUser = {};
        attendanceResult.rows.forEach(record => {
            if (!attendanceByUser[record.worker_name]) {
                attendanceByUser[record.worker_name] = [];
            }
            attendanceByUser[record.worker_name].push(record);
        });

        for (const [workerName, records] of Object.entries(attendanceByUser)) {
            doc.fontSize(12).font('Helvetica-Bold').text(workerName);
            doc.font('Helvetica');
            
            records.forEach(record => {
                const date = new Date(record.date).toDateString();
                const checkIn = record.check_in_time ? new Date(record.check_in_time).toLocaleTimeString() : 'N/A';
                const checkOut = record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString() : 'N/A';
                const status = record.status;
                
                doc.fontSize(10).text(`  - ${date}: ${checkIn} - ${checkOut} (${status})`);
            });
            doc.moveDown(0.5);
        }
      }
      doc.moveDown();

      // --- 2. Total Hours Worked ---
      doc.fontSize(16).text('2. Total Hours Worked', { underline: true });
      doc.moveDown();
      
      const hoursQuery = `
        SELECT u.name as worker_name, 
        SUM(EXTRACT(EPOCH FROM (check_out_time - check_in_time))/3600) as total_hours
        FROM attendance a
        JOIN users u ON a.worker_id = u.id
        WHERE a.date >= $1 AND a.date <= $2 
        AND check_in_time IS NOT NULL AND check_out_time IS NOT NULL
        GROUP BY u.name
      `;
      const hoursResult = await query(hoursQuery, [startDate, endDate]);

      if (hoursResult.rows.length === 0) {
        doc.fontSize(12).text('No hours recorded.');
      } else {
          hoursResult.rows.forEach(row => {
              const hours = parseFloat(row.total_hours).toFixed(2);
              doc.fontSize(12).text(`${row.worker_name}: ${hours} hours`);
          });
      }
      doc.moveDown();

      // --- 3. Project/Service Time Allocation ---
      doc.fontSize(16).text('3. Service Time Allocation', { underline: true });
      doc.moveDown();
      
      // Calculate duration from bookings where status is completed
      const serviceQuery = `
        SELECT s.name as service_name, COUNT(b.id) as count, SUM(b.duration) as total_duration
        FROM bookings b
        JOIN booking_services bs ON b.id = bs.booking_id
        JOIN services s ON bs.service_id = s.id
        WHERE b.scheduled_time >= $1 AND b.scheduled_time <= $2
        AND b.status = 'completed'
        GROUP BY s.name
      `;
      const serviceResult = await query(serviceQuery, [startDate, endDate]);

      if (serviceResult.rows.length === 0) {
          doc.fontSize(12).text('No completed services in this period.');
      } else {
          serviceResult.rows.forEach(row => {
              doc.fontSize(12).text(`${row.service_name}: ${row.count} bookings (${row.total_duration || 0} mins total)`);
          });
      }
      doc.moveDown();

      // --- 4. Notable Activity Highlights ---
      doc.fontSize(16).text('4. Highlights', { underline: true });
      doc.moveDown();
      
      const totalBookingsQuery = `SELECT COUNT(*) as count FROM bookings WHERE scheduled_time >= $1 AND scheduled_time <= $2 AND status = 'completed'`;
      const totalRevenueQuery = `SELECT SUM(total_amount) as total FROM bookings WHERE scheduled_time >= $1 AND scheduled_time <= $2 AND status = 'completed'`;
      
      const bookingsCount = (await query(totalBookingsQuery, [startDate, endDate])).rows[0].count;
      const revenue = (await query(totalRevenueQuery, [startDate, endDate])).rows[0].total || 0;

      doc.fontSize(12).text(`Total Completed Bookings: ${bookingsCount}`);
      doc.text(`Total Revenue (Bookings): NGN ${revenue}`);
      doc.moveDown();

      // --- 5. Anomalies/Exceptions ---
      doc.fontSize(16).text('5. Anomalies & Exceptions', { underline: true });
      doc.moveDown();

      const anomaliesQuery = `
        SELECT u.name, a.date, a.status, a.check_in_time, a.check_out_time
        FROM attendance a
        JOIN users u ON a.worker_id = u.id
        WHERE a.date >= $1 AND a.date <= $2
        AND (status = 'late' OR status = 'absent' OR status = 'flagged' OR location_verification_status = 'rejected')
      `;
      const anomaliesResult = await query(anomaliesQuery, [startDate, endDate]);

      if (anomaliesResult.rows.length === 0) {
          doc.fontSize(12).text('No anomalies detected.');
      } else {
          anomaliesResult.rows.forEach(row => {
              const date = new Date(row.date).toDateString();
              doc.fontSize(12).text(`${row.name} - ${date}: ${row.status.toUpperCase()}`);
          });
      }

      // Footer
      const footerText = `Generated automatically on ${new Date().toLocaleString()}`;
      doc.fontSize(8).text(footerText, 50, doc.page.height - 50, { align: 'center', color: 'grey' });

      doc.end();

    } catch (error) {
      reject(error);
    }
  });
};
