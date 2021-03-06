import { getLogger, setTransactionCallBlockNumber, TotalValueLocked } from '../util';
import { BlocksOfInterest } from './blocksOfInterest';
import { getUserTVL, GetUserTVLConfig } from './tvlCalculator';
import CancellationToken from 'cancellationtoken';

export interface AccountScoreDataPoint {
  tvl: TotalValueLocked;
}

export interface ScoreDataPoint {
  [account: string]: AccountScoreDataPoint;
}

export interface ScoreDataHistory {
  [blockNumber: number]: {
    data: ScoreDataPoint;
  };
}

export interface ScoreDataHistoryResult {
  error: any;
  data: ScoreDataHistory;
  lastBlock: number;
}

const logger = getLogger('Logic::gatherDataPoints');

export const gatherDataPoints = async (
  blocksToQuery: BlocksOfInterest,
  cachedConfig: GetUserTVLConfig,
  earlyCancelToken?: CancellationToken
): Promise<ScoreDataHistoryResult> => {
  const dataPoints: ScoreDataHistory = {};

  const queryBlocks = Object.keys(blocksToQuery)
    .map((v) => parseInt(v))
    .sort();

  let lastBlock = 0;
  try {
    for (const blockNumber of queryBlocks) {
      //logger.log(`Getting data from block number ${blockNumber}`);
      setTransactionCallBlockNumber(blockNumber);

      const blockDataPoints: ScoreDataPoint = {};
      const blockParticipants = blocksToQuery[blockNumber].accounts;

      if (blockParticipants.length == 0) {
        logger.warn(`Block ${blockNumber} doesn't have any participants, this shouldn't happen.`);
      }

      for (const account of blockParticipants) {
        const userTVLAtBlock = await getUserTVL(account, cachedConfig);
        logger.log(`Calculated ${account} TVL as ${userTVLAtBlock.tvl.toFixed(2)} at block ${blockNumber}`);

        blockDataPoints[account] = {
          tvl: userTVLAtBlock,
        };
      }

      dataPoints[blockNumber] = {
        data: blockDataPoints,
      };
      lastBlock = blockNumber;

      if (earlyCancelToken) {
        earlyCancelToken.throwIfCancelled();
      }
    }
  } catch (e) {
    return {
      error: e,
      data: dataPoints,
      lastBlock,
    };
  }

  return {
    error: undefined,
    data: dataPoints,
    lastBlock,
  };
};
