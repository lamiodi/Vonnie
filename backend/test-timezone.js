// Test script to check time slots with timezone fix
import axios from 'axios';

const testTimeSlots = async () => {
  try {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    
    console.log('🕐 Current test time:', new Date().toLocaleString());
    console.log('🌍 Nigeria time (WAT):', new Date(Date.now() + (1 * 60 * 60 * 1000)).toLocaleString());
    console.log('📅 Testing date:', dateStr);
    console.log('⏰ Expected: Should show future slots only (after current Nigeria time)');
    
    // Test with a sample service (you may need to adjust this ID)
    const response = await axios.get(`http://localhost:5010/api/public/bookings/available-slots?date=${dateStr}&service_ids=1`);
    
    console.log('\n✅ Available time slots:');
    response.data.forEach(slot => {
      const slotTime = new Date(slot);
      const localTime = slotTime.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      });
      console.log(`  - ${localTime} (${slot})`);
    });
    
    if (response.data.length === 0) {
      console.log('❌ No time slots available - this might be correct if all slots are in the past');
    }
    
  } catch (error) {
    console.error('❌ Error testing time slots:', error.response?.data || error.message);
  }
};

testTimeSlots();