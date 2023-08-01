import schedule from 'node-schedule';
import { StoreScoreModel } from '../database/models/storeScore';
import Redis from './redis';
import WinstonLogger from './logger';
import DayjsKR from "./dayjsKR";

const logger = WinstonLogger.getInstance();
const redis = Redis.getInstance().getClient();
const dayjsKR = DayjsKR.getInstance();

type LocationAggregateStore = {
  shortLocation: string;
  data: {
    store: string;
    shortLocation: string;
    date: number;
    score: number;
    createdAt: Date;
    updatedAt: Date;
  };
};

const storeScheduler = (): void => {
  // 매주 토요일 11시 50분에 이벤트 발생
  const rule = new schedule.RecurrenceRule();
  rule.dayOfWeek = 6;
  rule.hour = 23;
  rule.minute = 50;
  rule.tz = 'Asia/Seoul';

  schedule.scheduleJob(rule, async () => {
    try {
      const [sunStart, satEnd] = dayjsKR.getWeek();

      // 이번주의 지역마다(구) 상위 5개 가게들을 가져오기
      const stores: LocationAggregateStore[] = await StoreScoreModel.aggregate([
        { $match: { date: { $gt: sunStart, $lt: satEnd } } }, // 이번주에 대한 데이터 get
        { $sort: { score: -1 } }, // score로 내림차순 정렬
        {
          $group: {
            _id: '$shortLocation', // shortLocation으로 그룹화
            data: { $push: '$$ROOT' },
          },
        },
        {
          $project: {
            shortLocation: '$_id', // _id를 shortLocation으로 변경
            _id: 0, // _id field 삭제
            data: { $slice: ['$data', 5] }, // 상위 5개 추출
          },
        },
        { $unwind: '$data' },
      ]);

      // 가져온 데이터들을 redis에 삽입
      stores.map(async (store: LocationAggregateStore) => {
        await redis.del(store.shortLocation); // 먼저 지난 번의 데이터 모두 삭제
        await redis.rPush(store.shortLocation, store.data.store);
      });

      logger.info('Top stores saved on redis');
    } catch (err: any) {
      const errorMessage = err.stack.toString();

      logger.error(errorMessage);
    }
  });
};

export { storeScheduler };