import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

class DayjsKR {
  private static instance: DayjsKR;

  constructor() {
    dayjs.extend(utc);
    dayjs.extend(timezone);
    dayjs.tz.setDefault('Asia/Seoul');
  }

  static getInstance(): DayjsKR {
    if (!DayjsKR.instance) {
      DayjsKR.instance = new DayjsKR();
    }

    return DayjsKR.instance;
  }

  getWeek(): [string, string] {
    const sunStart = dayjs().tz().startOf('week').utc().unix().toString();
    const satEnd = dayjs().tz().endOf('week').endOf('day').utc().unix().toString();
    return [sunStart, satEnd];
  }

  scheduleTime(): any{

  }
}

export default DayjsKR;
