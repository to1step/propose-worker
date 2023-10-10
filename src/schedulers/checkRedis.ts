import schedule from 'node-schedule';
import Redis from '../utilies/redis';
import WinstonLogger from '../utilies/logger';
import DayjsKR from '../utilies/dayjsKR';
import { storeScheduler } from "./storeScheduler";
import { courseScheduler } from "./courseScheduler";

const logger = WinstonLogger.getInstance();
const redis = Redis.getInstance().getClient();
const dayjsKR = DayjsKR.getInstance();


const checkRedis = (): void => {
  // 10분마다 redis 데이터 체크
  const rule = new schedule.RecurrenceRule();
  rule.minute = new schedule.Range(0, 59, 10);
  schedule.scheduleJob(rule, async () => {
    const [sunStart, satEnd] = dayjsKR.getWeek();

    logger.info('Check redis data..');

    const flag = await redis.get(`${sunStart}-${satEnd}`);

    if(flag !== 'true') {
    	logger.error('Redis data has been deleted. Re-creating the data."');

      await Promise.all([storeScheduler(), courseScheduler()])
    }
  });
};

export { checkRedis };
