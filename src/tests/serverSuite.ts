/**
 * Server & Multiplayer Test Suite Registry (Node.js Only)
 * Contains authoritative server tests that rely on server/src/RoomManager and AuthoritativeGameController.
 * Kept isolated from src/tests/index.ts so server/db code never enters the Vite client bundle.
 */

import { TestHarness } from './testHarness';
import { buildMidGameJoinTestSuite } from './midGameJoin.test';
import { buildRoundLifecycleTestSuite } from './roundLifecycle.test';
import { buildHostTurnTimerTestSuite } from './hostTurnTimer.test';
import { buildCustomRoomIdTestSuite } from './customRoomId.test';
import { buildHostLifecycleTestSuite } from './hostLifecycle.test';
import { buildWaitingTableVsActiveMatchTestSuite } from './waitingTableVsActiveMatch.test';
import { buildActiveTableDiscoveryTestSuite } from './activeTableDiscovery.test';
import { buildJoinerWaitingRoomFlowTestSuite } from './joinerWaitingRoomFlow.test';
import { buildNewTableDraftVsCreationTestSuite } from './newTableDraftVsCreation.test';
import { buildMandatoryNameAndRoomIdPolicyTestSuite } from './mandatoryNameAndRoomIdPolicy.test';

export function buildServerMultiplayerTestSuite(): TestHarness {
  const composite = new TestHarness();
  composite.include(buildMidGameJoinTestSuite());
  composite.include(buildRoundLifecycleTestSuite());
  composite.include(buildHostTurnTimerTestSuite());
  composite.include(buildCustomRoomIdTestSuite());
  composite.include(buildHostLifecycleTestSuite());
  composite.include(buildWaitingTableVsActiveMatchTestSuite());
  composite.include(buildActiveTableDiscoveryTestSuite());
  composite.include(buildJoinerWaitingRoomFlowTestSuite());
  composite.include(buildNewTableDraftVsCreationTestSuite());
  composite.include(buildMandatoryNameAndRoomIdPolicyTestSuite());
  return composite;
}
