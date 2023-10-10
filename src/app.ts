import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';

import Mongo from './utilies/mongo';
import Redis from './utilies/redis';
import WinstonLogger from './utilies/logger';
import { needEnv } from './utilies/envList';
import { runStoreScheduler } from './utilies/storeScheduler';
import { runCourseScheduler } from './utilies/courseScheduler';


dotenv.config();

class Server {
	private app = express();

	private mongo = Mongo.getInstance();

	private redis = Redis.getInstance();

	private logger = WinstonLogger.getInstance();

	constructor() {
		this.validateEnv();
		this.initializeDatabase();
		this.initializeRedis();
		this.initializeMiddleware();
		this.scheduler();
	}

	private validateEnv() {
		const missingVariables: string[] = [];

		needEnv.forEach((envVariable) => {
			if (!process.env[envVariable]) {
				missingVariables.push(envVariable);
			}
		});

		if (missingVariables.length > 0) {
			missingVariables.forEach((variable) => {
				this.logger.error(`${variable} is missing`);
			});
			process.exit(1);
		} else {
			this.logger.info('All required environment variables are present.');
		}
	}

	private async initializeDatabase() {
		await this.mongo.connect();
	}

	private async initializeRedis() {
		await this.redis.connect();
	}

	private initializeMiddleware() {
		this.app.set('port', process.env.PORT || 8080);
		this.app.use(helmet({ contentSecurityPolicy: false }));
		this.app.use(express.json());
	}

	private scheduler() {
		runStoreScheduler();
		runCourseScheduler();
	}

	// server-listen
	public listen(): void {
		this.app.listen(this.app.get('port'), () => {
			this.logger.info(
				`Scheduler Server is running on port ${this.app.get('port')}`
			);
		});
	}
}

try {
	const appServer = new Server();

	appServer.listen();
} catch (error) {
	console.error(error);
}
