import { generateWeeklyReport } from '../src/services/reportService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const run = async () => {
  try {
    console.log('Generating test report...');
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);

    const pdfBuffer = await generateWeeklyReport(startDate, endDate);
    
    const outputPath = path.join(__dirname, 'test-report.pdf');
    fs.writeFileSync(outputPath, pdfBuffer);
    
    console.log(`✅ Test report generated at: ${outputPath}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error generating report:', error);
    process.exit(1);
  }
};

run();
