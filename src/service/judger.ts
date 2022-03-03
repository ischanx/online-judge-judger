import { Config, Provide } from '@midwayjs/decorator';
import { Worker } from 'worker_threads';
import axios from 'axios';
const os = require('os');
const taskPool = [];
const cpuCore = os.cpus().length;
let count = 0;

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
    taskPool.push(submission);
  }

  async remove() {
    if (count >= cpuCore || taskPool.length === 0) return;
    const task = taskPool.shift();
    await this.run(task);
  }

  async run(submission) {
    submission.time = Date.now();

    if (count < cpuCore) {
      if (submission.executeMemory * 1.2 < os.freemem() && count > 0) {
        taskPool.unshift(submission);
        return;
      }
      count++;
      this.judge(submission);
    } else await this.add(submission);
    return {
      run: count,
      wait: taskPool.length,
    };
  }

  async finishTask(submissionId, data) {
    const { log, ...result } = data;
    return axios.post(
      `${this.BACKEND_URL}/api/submission/update`,
      {
        submissionId,
        result,
        log,
      },
      {
        headers: {
          'x-judge-server-token': this.JUDGE_TOKEN,
        },
        responseType: 'json',
      }
    );
  }

  async judge(data) {
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
      },
    });

    th.on('message', async data => {
      try {
        const res = await this.finishTask(submissionId, data);
        if (res.data.code !== 0) throw res.data;
      } catch (e) {
        console.log(e);
      }
      count--;
      this.remove();
    });
  }
}
