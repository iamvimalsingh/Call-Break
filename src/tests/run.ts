import { buildCompleteTestSuite } from './index';

async function main() {
  const runner = buildCompleteTestSuite();
  const summary = await runner.runAll();
  console.log(`\n========================================`);
  console.log(`CALL BREAK TEST RESULTS`);
  console.log(`Passed: ${summary.passed}/${summary.total} (Failed: ${summary.failed})`);
  console.log(`Duration: ${summary.totalDurationMs}ms`);
  console.log(`========================================\n`);

  if (summary.failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
