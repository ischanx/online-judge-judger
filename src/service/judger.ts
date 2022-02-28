import { Provide } from '@midwayjs/decorator';
import { Worker } from 'worker_threads';
const os = require('os');
const taskPool = [];
const cpuCore = os.cpus().length;
let count = 0;

@Provide()
export class JudgeService {
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
        fileName: problemId,
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
      const parser = origin => {
        const res = {
          pass: false,
          memory: 1,
          time: 12,
          stdin: '',
          stdout: '',
          // expectedStdout: "",
          stderr: '',
          status: 'ac',
        };
        if (origin.compile.exitCode !== 0) {
          res.status = 'asdasd';
          res.stdin = origin.compile.err;
          res.stderr = origin.compile.stderr;
          res.stdout = origin.compile.stdout;
        } else {
          let time = 0;
          let memory = 0;
          let index = 0;
          for (; index < origin.execute.length; index++) {
            time = Math.max(origin.execute[index].cpuTime, time);
            memory = Math.max(origin.execute[index].memory, memory);
            if (origin.execute[index].exitCode !== 0) {
              res.status = origin.execute[index].exitCode;
              res.stdin = origin.compile.err;
              res.stderr = origin.compile.stderr;
              res.stdout = origin.compile.stdout;
              res.time = time;
              res.memory = memory;
              break;
            }
          }
        }

        return res;
      };

      console.log({
        result: parser(data),
        runInfo: JSON.stringify(data),
        status: 'success',
      });

      count--;
      this.remove();
    });
  }
}
