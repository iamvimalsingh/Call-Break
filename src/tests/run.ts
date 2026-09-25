import { buildCompleteTestSuite } from './index';
import { buildAdminApiTestSuite } from './adminApi.test';
import { buildWsValidationTestSuite } from './wsValidation.test';
import { buildConnectionReliabilityTestSuite } from './connectionReliability.test';
import { buildOrphanCleanupAndJoinValidationTestSuite } from './orphanCleanupAndJoinValidation.test';
import { buildAdminPanelTestSuite } from './adminPanel.test';
import { buildPersistenceTestSuite } from './persistence.test';
import { buildPlayerProfileTestSuite } from './playerProfile.test';

async function main() {
  const runner = buildCompleteTestSuite();
  runner.include(buildAdminApiTestSuite());
  runner.include(buildWsValidationTestSuite());
  runner.include(buildConnectionReliabilityTestSuite());
  runner.include(buildOrphanCleanupAndJoinValidationTestSuite());
  runner.include(buildAdminPanelTestSuite());
  runner.include(buildPersistenceTestSuite());
  buildPlayerProfileTestSuite(runner);
  const summary = await runner.runAll();
  console.log(`\n========================================`);
  console.log(`CALL BREAK TEST RESULTS`);
  console.log(`Passed: ${summary.passed}/${summary.total} (Failed: ${summary.failed})`);
  console.log(`Duration: ${summary.totalDurationMs}ms`);
  console.log(`========================================\n`);

  if (summary.failed > 0) {
    console.log('FAILED TESTS:');
    for (const r of summary.results) {
      if (r.status === 'FAILED') {
        console.log(`- [${r.category}] ${r.description}: ${r.error}`);
      }
    }
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
