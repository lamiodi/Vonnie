import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;

const client = new Client({
  connectionString
});

async function findBookingServiceLink() {
  await client.connect();
  try {
     const res1 = await client.query("SELECT id FROM booking_services LIMIT 1");
     console.log("booking_services exists!");
  } catch (e) {
     console.log("booking_services does not exist.");
  }
  
  try {
     const res2 = await client.query("SELECT * FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'service_id'");
     if (res2.rows.length > 0) {
        console.log("bookings.service_id exists!");
     } else {
        console.log("bookings.service_id does not exist.");
     }
  } catch (e) {
     console.error(e.message);
  }
  await client.end();
}

findBookingServiceLink();
