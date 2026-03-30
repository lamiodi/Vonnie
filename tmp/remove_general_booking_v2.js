import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;

const client = new Client({
  connectionString
});

async function removeGeneralBookingService() {
  await client.connect();
  try {
    // Find the service first
    const searchRes = await client.query(
      "SELECT id, name FROM services WHERE name = 'General Booking' AND is_active = true"
    );
    
    if (searchRes.rows.length === 0) {
      console.log("No active 'General Booking' service found to remove.");
    } else {
      for (const service of searchRes.rows) {
        console.log(`\nAttempting to remove service: [${service.id}] ${service.name}`);
        
        // Before deleting, check if it has links in booking_services
        const bookingsResult = await client.query(
          'SELECT COUNT(*) FROM booking_services WHERE service_id = $1',
          [service.id]
        );
        
        const count = parseInt(bookingsResult.rows[0].count);
        if (count > 0) {
          console.log(`Service has ${count} bookings linked via junction table. Archiving...`);
          await client.query(
            'UPDATE services SET is_active = false WHERE id = $1',
            [service.id]
          );
        } else {
          console.log(`Service has no bookings. Deleting permanently...`);
          await client.query(
            'DELETE FROM services WHERE id = $1',
            [service.id]
          );
        }
      }
      console.log("\nService removal successful.");
    }
    
  } catch (err) {
    console.error('Error during removal:', err.message);
  }
  await client.end();
}

removeGeneralBookingService().catch(err => {
  console.error(err);
  process.exit(1);
});
