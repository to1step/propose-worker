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
  rule.dayOfWeek = 0;
  rule.hour = 23;
  rule.minute = 50;
  rule.tz = 'Asia/Seoul';


  schedule.scheduleJob(rule, async () => {
    try {
      const storesData: { [key:string]: string[] } = { };

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


      stores.map((store) => {
        if(!storesData.hasOwnProperty(store.shortLocation)) {
          storesData[store.shortLocation] = [store.data.store];
        } else {
          storesData[store.shortLocation].push(store.data.store)
        }
      })


      for(const shortLocation in storesData) {
        // 지난번의 데이터
        const originData:string[] = await redis.lRange(shortLocation, 0, -1);

        // 먼저 지난 번의 데이터 모두 삭제
        await redis.del(shortLocation);

        // 새로운 데이터
        const newData:string[] = storesData[shortLocation];

        // 새로운 데이터 redis에 삽입
        newData.map(async (storeUUID:string) => {
          await redis.rPush(shortLocation, storeUUID);
        })

        // 새로운 데이터가 5개가 되지 않는다면 기존의 데이터를 남은 개수만큼 뒤에 삽입 (단, 겹치지 않아야 함)
        const restData = originData.slice(0, 5 - newData.length);

        restData.map(async (storeUUID:string) => {
          if(!newData.includes(storeUUID)) {
            await redis.rPush(shortLocation, storeUUID);
          }
        })
      }

      logger.info('Top stores saved on redis');
    } catch (err: any) {
      const errorMessage = err.stack.toString();

      logger.error(errorMessage);
    }
  });
};

export { storeScheduler };
