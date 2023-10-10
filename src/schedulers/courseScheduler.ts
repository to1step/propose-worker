import schedule from 'node-schedule';
import Redis from '../utilies/redis';
import WinstonLogger from '../utilies/logger';
import DayjsKR from '../utilies/dayjsKR';
import { CourseScoreModel } from '../database/models/courseScore';

const logger = WinstonLogger.getInstance();
const redis = Redis.getInstance().getClient();
const dayjsKR = DayjsKR.getInstance();

const courseScheduler = async () => {
	try {
		const [sunStart, satEnd] = dayjsKR.getWeek();

		// 이번주의 상위 5개 코스들을 가져오기
		const courses = await CourseScoreModel.find({
			date: { $gt: sunStart, $lt: satEnd },
		})
			.sort({ score: -1 })
			.limit(5);

		const newDataLength = courses.length;

		// 기존의 데이터
		const redisData = await redis.lRange('top-course', 0, -1);

		// 만약 새로운 데이터가 5개가 되지 않을 시 추가할 기존의 데이터
		const plusData: string[] = redisData.slice(
			0,
			redisData.length - newDataLength
		);

		// 먼저 지난 번의 데이터 모두 삭제
		await redis.del('top-course');

		// 가져온 데이터들을 redis에 삽입
		courses.map(async (course) => {
			await redis.rPush('top-course', course.course);
		});

		// 추가 데이터들을 redis에 삽기
		plusData.map(async (course) => {
			await redis.rPush('top-course', course);
		});

		await redis.set(`${sunStart}-${satEnd}`, 'true');
		logger.info('Top courses saved on redis');
	} catch (err: any) {
		const errorMessage = err.stack.toString();

		logger.error(errorMessage);
	}
};

const runCourseScheduler = (): void => {
	// 매주 토요일 11시 50분에 이벤트 발생
	const rule = new schedule.RecurrenceRule();
	rule.dayOfWeek = 0;
	rule.hour = 23;
	rule.minute = 50;
	rule.tz = 'Asia/Seoul';

	schedule.scheduleJob(rule, async () => courseScheduler());
};

export { courseScheduler, runCourseScheduler };
