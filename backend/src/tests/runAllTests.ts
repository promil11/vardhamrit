import { execSync } from 'child_process';

console.log('🧪 Running All Backend Integration Tests...\n');

try {
  console.log('▶️ Executing Phase 2 Tests (Auth, Products, Cart, Addresses)...');
  execSync('npx ts-node src/tests/phase2.test.ts', { stdio: 'inherit' });

  console.log('\n▶️ Executing Phase 3 Tests (Coupons, Orders, Lifecycle, Restock)...');
  execSync('npx ts-node src/tests/phase3.test.ts', { stdio: 'inherit' });

  console.log('\n▶️ Executing Phase 4 Tests (Razorpay, Webhook, Tamper Protection, Auto-Refund)...');
  execSync('npx ts-node src/tests/phase4.test.ts', { stdio: 'inherit' });

  console.log('\n▶️ Executing Phase 5 Tests (Invoice PDF, Push Notifications, Moderation, Admin API)...');
  execSync('npx ts-node src/tests/phase5.test.ts', { stdio: 'inherit' });

  console.log('\n🎉 ALL BACKEND SUITES PASSED FLAWLESSLY! 🎉\n');
} catch (err) {
  console.error('\n❌ Test suite failure\n');
  process.exit(1);
}
