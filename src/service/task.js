const { isMainThread, parentPort, workerData } = require('worker_threads');
const child_process = require('child_process');
const util = require('util');
const fs = require('fs');
const writeFile = util.promisify(fs.writeFile);
const mkdir = util.promisify(fs.mkdir);
const stat = util.promisify(fs.stat);

class Manager {
  constructor(config) {
    this.config = config;
    this.needCompile = ['cpp'].includes(config.language);
    this.samples = config.samples;
    const baseDir = '/www/wwwroot/judge';
    this.workDir = `${baseDir}/${config.taskId}`;
    this.sampleDir = `${baseDir}/sample/${config.questionId}`;
    // docker最小内存6M
    this.compileCMD =
      `docker run --mount type=bind,source=${this.workDir},target=/judge -v ${this.sampleDir}:/judge/sample:ro ` +
      `--ulimit fsize=${Math.round(config.fileSize * 1024)} --ulimit cpu=${
        Math.round(config.compileTime / 1000) + 2
      }:${Math.round(config.compileTime / 1000) + 3} -m ${
        Math.ceil(config.compileMemory / 1024) + 6
      }M --memory-swap=${
        Math.ceil(config.compileMemory / 1024) + 6
      }M --ulimit core=5600000:6600000 ` +
      '-e CURRENT_STEP=compile demo';

    this.executeCMD = num =>
      `docker run --mount type=bind,source=${this.workDir},target=/judge -v ${this.sampleDir}:/judge/sample:ro ` +
      `--ulimit fsize=${Math.round(config.fileSize * 1024)} --ulimit cpu=${
        Math.round(config.executeTime / 1000) + 2
      }:${Math.round(config.executeTime / 1000) + 3} -m ${
        Math.ceil(config.executeMemory / 1024) + 6
      }M --memory-swap=${
        Math.ceil(config.executeMemory / 1024) + 6
      }M --ulimit core=5600000:6600000 ` +
      `-e CURRENT_STEP=execute -e SAMPLE_NAME=${num} demo`;
  }

  /**
   * 更新判题机环境配置
   * @param newConfig
   * @returns {Promise<void>}
   */
  async updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    await writeFile(`${this.workDir}/config.json`, JSON.stringify(this.config));
  }

  /**
   * 拉取测试数据
   */
  async fetchSample() {
    await mkdir(this.sampleDir);
    console.log(`需要下载${this.config.questionId}的测试数据`);
    const arr = [];
    this.samples.forEach((item, index) => {
      arr.push(writeFile(`${this.sampleDir}/${index + 1}.in`, item.input));
      arr.push(writeFile(`${this.sampleDir}/${index + 1}.out`, item.output));
    });
    try {
      await Promise.all(arr);
    } catch (e) {
      console.log('写出测试数据错误', e);
    }
  }

  /**
   * 本地文件初始化
   */
  async created() {
    const deleteFolder = path => {
      let files = [];
      if (fs.existsSync(path)) {
        files = fs.readdirSync(path);
        files.forEach((file, index) => {
          const curPath = path + '/' + file;
          if (fs.statSync(curPath).isDirectory()) {
            deleteFolder(curPath);
          } else {
            fs.unlinkSync(curPath);
          }
        });
        fs.rmdirSync(path);
      }
    };

    try {
      deleteFolder(this.workDir);
      // await rmdir(this.workDir);
      await mkdir(this.workDir);
      await mkdir(`${this.workDir}/output`);
      await this.updateConfig({});

      const haveSample = await stat(this.sampleDir).catch(e => {});
      if (!haveSample) {
        await this.fetchSample();
      } else console.log('测试数据已存在');

      const sourcecode = this.config.code;
      // 写入源代码文件
      await writeFile(
        `${this.workDir}/${this.config.fileName}.${this.config.language}`,
        sourcecode
      );
    } catch (e) {
      console.log(e);
    }
  }
  /**
   * 编译得到可执行文件
   * @returns {Promise<void>}
   */
  async compile() {
    return new Promise((resolve, reject) => {
      child_process.exec(this.compileCMD, {}, (error, stdout, stderr) => {
        error && reject(error);
        let parse = null;
        try {
          parse = JSON.parse(stdout);
          resolve(parse);
        } catch (parseError) {
          reject([error, stdout, stderr, parseError]);
        }
      });
    });
  }

  /**
   * 运行得到输出
   * @returns {Promise<unknown[]>}
   */
  async execute() {
    const exeOne = num =>
      new Promise((resolve, reject) => {
        child_process.exec(
          this.executeCMD(String(num)),
          {},
          (error, stdout, stderr) => {
            if (error?.code)
              resolve({
                exitCode: error.code,
                stderr,
              });
            try {
              const res = JSON.parse(stdout);
              resolve(res);
            } catch (parseError) {
              reject([error, stdout, stderr, parseError]);
            }
          }
        );
      });

    const exeAll = [];
    for (let i = 1; i <= this.config.sampleNum; i++) {
      exeAll.push(exeOne(i));
    }
    return Promise.all(exeAll);
  }

  /**
   * 比较输出结果进行评测
   */
  async compareOutput() {
    const computeMD5 = path => {
      const fs = require('fs');
      const crypto = require('crypto');
      const buffer = fs.readFileSync(path);
      const hash = crypto.createHash('md5');
      hash.update(buffer, 'utf8');
      return hash.digest('hex');
    };
    const totalCount = this.config.sampleNum;
    const detail = new Array(totalCount);
    let totalCorrect = 0;
    for (let i = 1; i <= totalCount; i++) {
      if (
        computeMD5(`${this.sampleDir}/${i}.out`) ===
        computeMD5(`${this.workDir}/output/${i}.out`)
      ) {
        detail[i - 1] = 1;
        totalCorrect++;
      } else {
        detail[i - 1] = 0;
      }
    }
    return {
      compareDetail: detail.join(''),
      pass: totalCount === totalCorrect,
      totalCorrect,
      totalCount,
    };
  }

  /**
   * 判题机入口
   */
  async runner() {
    // 环境初始化
    const startTime = Date.now();
    await this.created();
    let res = {};
    // 编译
    if (this.needCompile) {
      const compileRes = await this.compile();
      if (compileRes.exitCode !== 0) {
        res.error = 'Compile Error';
        res.message = compileRes.stderr;
        res.log = JSON.stringify(compileRes);
      }
      // 编译阶段有错可以直接返回CE
      if (res.error) return res;
    }
    // 运行
    const executeRes = await this.execute();
    for (let i = 1; i <= this.config.sampleNum; i++) {
      //   152: '[OJ-152] TLE运行超时',
      //   153: '[OJ-153] RE运行错误',
      //   136: '[OJ-136] SIGFPE算术异常',
      //   137: '[OJ-137] MLE超出内存限制',
      //   139: '[OJ-139] MLE栈溢出',
      const item = executeRes[i - 1];
      if (
        item.cpuTime > this.config.executeTime ||
        [152].includes(item.exitCode) ||
        (item.exitCode === null && item.error.signal === 'SIGTERM')
      ) {
        res.error = 'Time Limit Exceeded';
      } else if (
        item.executeMemory > this.config.executeMemory ||
        [137, 139].includes(item.exitCode)
      ) {
        res.error = 'Memory Limit Exceeded';
      } else if ([135, 136].includes(item.exitCode)) {
        res.error = 'Runtime Error';
      } else if (item.exitCode !== 0) {
        res.error = 'Unknown Error';
      }
      // 遇到一个错误即可得出判断
      if (res.error) {
        res.message = item.stderr;
        res.log = JSON.stringify(executeRes);
        return res;
      }
    }

    // 没有运行方面的错误就可以进行输出比较
    const compareRes = await this.compareOutput();
    if (!compareRes.pass) {
      res = {
        err: 'Wrong Answer',
        ...compareRes,
      };
    } else {
      res.message = 'Accepted';
      let maxTime = 0;
      let maxMemory = 0;
      const endTime = Date.now();
      executeRes.forEach(e => {
        maxTime = Math.max(maxTime, e.cpuTime);
        maxMemory = Math.max(maxMemory, e.memory);
      });
      res = {
        ...res,
        time: maxTime,
        memory: maxMemory,
        startTime,
        endTime,
        realTime: endTime - startTime,
        ...compareRes,
        log: JSON.stringify(executeRes),
      };
    }

    return res;
  }
}

const fn = async () => {
  let result = {};
  try {
    result = await new Manager(workerData).runner();
  } catch (judgeServerError) {
    console.log(judgeServerError);
    result.error = 'Judge Server Error';
    result.log = judgeServerError.toString();
  }
  parentPort.postMessage(result);
};

if (!isMainThread) {
  fn();
}
