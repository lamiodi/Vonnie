// Simple time logic test
const now = new Date();
console.log('Current time:', now.toLocaleString());
console.log('Current hour:', now.getHours());

// Test today's date
const date = new Date().toISOString().split('T')[0]; // Today's date
console.log('Testing for date:', date);

// Test the logic from our backend code
const today = new Date();
today.setHours(0, 0, 0, 0);
const selectedDate = new Date(date);
selectedDate.setHours(0, 0, 0, 0);
const isToday = today.getTime() === selectedDate.getTime();

console.log('Is selected date today?', isToday);

// Test various time slots
const testSlots = [
  { time: '10:00 AM', hour: 10, minute: 0 },
  { time: '2:00 PM', hour: 14, minute: 0 },
  { time: '6:30 PM', hour: 18, minute: 30 },
  { time: '11:00 PM', hour: 23, minute: 0 }
];

console.log('\nTesting time slots:');
testSlots.forEach(slot => {
  const slotTime = new Date(date);
  slotTime.setHours(slot.hour, slot.minute, 0, 0);
  
  const isPast = slotTime < now;
  const shouldShow = !(isToday && isPast);
  
  console.log(`${slot.time} - ${shouldShow ? 'SHOW' : 'HIDE'} (${isPast ? 'past' : 'future'})`);
});

console.log('\nLogic test complete!');