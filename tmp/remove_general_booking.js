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
      
      // Let's search a bit more broadly just in case the name varies slightly
      const fuzzyRes = await client.query(
        "SELECT id, name FROM services WHERE name ILIKE '%General Booking%' AND is_active = true"
      );
      if (fuzzyRes.rows.length > 0) {
        console.log("Found similar services that might be it:");
        fuzzyRes.rows.forEach(r => console.log(`- [${r.id}] ${r.name}`));
      }
      
    } else {
      for (const service of searchRes.rows) {
        console.log(`Attempting to remove service: [${service.id}] ${service.name}`);
        
        // Before deleting, check if it has bookings
        const bookingsResult = await client.query(
          'SELECT COUNT(*) FROM bookings WHERE service_id = $1',
          [service.id]
        );
        
        if (parseInt(bookingsResult.rows[0].count) > 0) {
          console.log(`Service has ${bookingsResult.rows[0].count} bookings. Archiving (setting is_active = false) instead of deleting...`);
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
      console.log("\nCleanup completed.");
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
