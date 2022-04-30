import { Config, Provide } from '@midwayjs/decorator';
import { Worker } from 'worker_threads';
import axios from 'axios';
const os = require('os');
const taskPool = [];
const cpuCore = os.cpus().length;
let count = 0;
let currentMemory = 0;
const dockerMinMem = 8000; // docker预留最小内存
@Provide()
export class JudgeService {
  @Config('BACKEND_URL')
  BACKEND_URL: string;

  @Config('JUDGE_TOKEN')
  JUDGE_TOKEN: string;

  get currentTaskCount() {
    return taskPool.length;
  }

  async add(submission) {
    if (!['cpp', 'c'].includes(submission.language)) {
      // c/cpp外的语言时间为双倍时间空间
      submission.executeTime = submission.executeTime * 2;
      submission.executeMemory = submission.executeMemory * 2;
    }
    taskPool.push(submission);
  }

  async next() {
    if (count >= cpuCore || taskPool.length === 0) return;
    const task = taskPool.shift();
    await this.run(task);
  }

  async run(submission) {
    submission.time = Date.now();

    if (count < cpuCore) {
      if (
        currentMemory + submission.executeMemory + dockerMinMem >
          os.freemem() &&
        count > 0
      ) {
        taskPool.unshift(submission);
        return;
      }
      count++;
      // 判断内存是否足够并发评测
      const parallelMemory =
        (submission.executeMemory + dockerMinMem) * submission.samples.length;
      const isParallelRun = currentMemory + parallelMemory < os.freemem();
      const taskMemory = isParallelRun
        ? parallelMemory
        : submission.executeMemory + dockerMinMem;
      currentMemory += taskMemory;
      submission.taskMemory = taskMemory;
      this.judge(submission, isParallelRun);
    } else await this.add(submission);
    return {
      run: count,
      wait: taskPool.length,
    };
  }

  async finishTask(submissionId, data, originData) {
    const { log, ...result } = data;
    const updateData = {
      submissionId,
      result,
      log,
      ...originData,
    };
    return axios.post(`${this.BACKEND_URL}/api/submission/update`, updateData, {
      headers: {
        'x-judge-server-token': this.JUDGE_TOKEN,
      },
      responseType: 'json',
    });
  }

  async judge(data, isParallel = false) {
    const {
      submissionId,
      code,
      lang,
      problemId,
      samples,
      compileTime = 3000,
      compileMemory = 524288,
      executeTime = 5000,
      executeMemory = 524288,
      fileSize = 102400,
      taskMemory,
      contestId,
      problemNumber,
    } = data;

    const th = new Worker(__dirname + '/task.js', {
      workerData: {
        taskId: submissionId,
        questionId: problemId,
        fileName: 'main',
        language: lang,
        compileTime,
        compileMemory,
        executeTime,
        executeMemory,
        fileSize,
        code: code,
        samples: samples,
        sampleNum: samples.length,
        isParallel,
      },
    });

    th.on('message', async data => {
      try {
        const res = await this.finishTask(submissionId, data, {
          contestId,
          problemNumber,
        });
        if (res.data.code !== 0) throw res.data;
      } catch (e) {
        console.log(e);
      }
      count--;
      currentMemory -= taskMemory;
      this.next();
    });
  }
}
