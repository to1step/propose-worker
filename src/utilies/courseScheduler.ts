import schedule from "node-schedule";
import Redis from './redis';
import WinstonLogger from './logger';
import DayjsKR from "./dayjsKR";
import { CourseScoreModel } from "../database/models/courseScore";

const logger = WinstonLogger.getInstance();
const redis = Redis.getInstance().getClient();
const dayjsKR = DayjsKR.getInstance();

const courseScheduler = (): void => {
  // 매주 토요일 11시 50분에 이벤트 발생
  const rule = new schedule.RecurrenceRule();
  rule.dayOfWeek = 6;
  rule.hour = 23;
  rule.minute = 50;
  rule.tz = 'Asia/Seoul';

  schedule.scheduleJob(rule, async () => {
    try {
      const [sunStart, satEnd] = dayjsKR.getWeek();

      // 이번주의 상위 5개 코스들을 가져오기
      const courses = await CourseScoreModel.find({
        date: { $gt: sunStart, $lt: satEnd },
      }).sort({ score: -1 }).limit(5);

      // 가져온 데이터들을 redis에 삽입
      courses.map(async (course) => {
        await redis.del("top-course"); // 먼저 지난 번의 데이터 모두 삭제
        await redis.rPush("top-course", course.course);
      });

      logger.info('Top courses saved on redis');
    } catch (err: any) {
      const errorMessage = err.stack.toString();

      logger.error(errorMessage);
    }
  });
};

export { courseScheduler }
