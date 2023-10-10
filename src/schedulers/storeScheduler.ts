import schedule from 'node-schedule';
import Redis from '../utilies/redis';
import { StoreScoreModel } from '../database/models/storeScore';
import WinstonLogger from '../utilies/logger';
import DayjsKR from '../utilies/dayjsKR';

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

// 이번 주 상위 5개 가게 데이터를 가져옵니다.
const getTopStoresData = async () => {
	const [sunStart, satEnd] = dayjsKR.getWeek();

	return StoreScoreModel.aggregate([
		{ $match: { date: { $gt: sunStart, $lt: satEnd } } },
		{ $sort: { score: -1 } },
		{
			$group: {
				_id: '$shortLocation',
				data: { $push: '$$ROOT' },
			},
		},
		{
			$project: {
				shortLocation: '$_id',
				_id: 0,
				data: { $slice: ['$data', 5] },
			},
		},
		{ $unwind: '$data' },
	]);
};

// 가게 데이터를 지역별로 그룹화하여 저장합니다.
const groupStoresByLocation = (stores: LocationAggregateStore[]) => {
	const storesData: { [key: string]: string[] } = {};

	stores.forEach((store) => {
		if (!storesData[store.shortLocation]) {
			storesData[store.shortLocation] = [store.data.store];
		} else {
			storesData[store.shortLocation].push(store.data.store);
		}
	});

	return storesData;
};

const saveDataToRedis = async (storesData: { [x: string]: any }) => {
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
};

const storeScheduler = async () => {
	try {
		const stores = await getTopStoresData();
		const storesData = groupStoresByLocation(stores);
		await saveDataToRedis(storesData);

		const [sunStart, satEnd] = dayjsKR.getWeek();

		await redis.set(`${sunStart}-${satEnd}`, 'true');
		logger.info('Top stores saved on redis');
	} catch (err: any) {
		const errorMessage = err.stack.toString();
		logger.error(errorMessage);
	}
};

const runStoreScheduler = (): void => {
	const rule = new schedule.RecurrenceRule();
	rule.dayOfWeek = 0;
	rule.hour = 23;
	rule.minute = 50;
	rule.tz = 'Asia/Seoul';

	schedule.scheduleJob(rule, async () => storeScheduler());
};

export { storeScheduler, runStoreScheduler };
