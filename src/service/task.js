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
    this.samples = config.samples;
    const baseDir = '/www/wwwroot/judge';
    this.workDir = `${baseDir}/${config.taskId}`;
    this.sampleDir = `${baseDir}/sample/${config.questionId}`;
    this.compileCMD =
      `docker run --mount type=bind,source=${this.workDir},target=/judge -v ${this.sampleDir}:/judge/sample:ro ` +
      `--ulimit fsize=${Math.round(config.fileSize * 1024)} --ulimit cpu=${
        Math.round(config.compileTime / 1000) + 2
      }:${Math.round(config.compileTime / 1000) + 3} -m ${Math.round(
        config.compileMemory / 1024
      )}M --memory-swap=${Math.round(
        config.compileMemory / 1024
      )}M --ulimit core=5600000:6600000 ` +
      '-e CURRENT_STEP=compile demo';

    this.executeCMD = num =>
      `docker run --mount type=bind,source=${this.workDir},target=/judge -v ${this.sampleDir}:/judge/sample:ro ` +
      `--ulimit fsize=${Math.round(config.fileSize * 1024)} --ulimit cpu=${
        Math.round(config.executeTime / 1000) + 2
      }:${Math.round(config.executeTime / 1000) + 3} -m ${Math.round(
        config.executeMemory / 1024
      )}M --memory-swap=${Math.round(
        config.executeMemory / 1024
      )}M --ulimit core=5600000:6600000 ` +
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
        resolve(JSON.parse(stdout));
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
            // console.log("err",error);
            // console.log("stdout", stdout);
            // console.log("stderr", stderr);
            const res = JSON.parse(stdout);
            const code = res.exitCode;
            const signal = res.signalCode;
            const map = {
              152: '[OJ-152] TLE运行超时',
              153: '[OJ-153] RE运行错误',
              136: '[OJ-136] SIGFPE算术异常',
              137: '[OJ-137] MLE超出内存限制',
              139: '[OJ-139] MLE栈溢出',
            };
            res.status = map[code] ? map[code] : `[OJ-${code}] ${signal}`;
            if (code === 0 && signal === null) resolve(res);
            else reject(res);
          }
        );
      });

    const exeAll = [];
    for (let i = 1; i <= this.config.sampleNum; i++) {
      exeAll.push(exeOne(i));
    }

    try {
      const res = await Promise.all(exeAll);
      res.sort((a, b) => a.timestamp - b.timestamp);
      return res;
    } catch (e) {
      console.log(e);
      return e;
    }
  }

  /**
   * 比较输出结果进行评测
   * @returns {Promise<*[]>}
   */
  async judge(executeResult) {
    const computeMD5 = path => {
      const fs = require('fs');
      const crypto = require('crypto');
      const buffer = fs.readFileSync(path);
      const hash = crypto.createHash('md5');
      hash.update(buffer, 'utf8');
      return hash.digest('hex');
    };
    const judgeRes = [];
    for (let i = 1; i <= this.config.sampleNum; i++) {
      const item = executeResult[i - 1];
      if (item.cpuTime > this.config.executeTime) {
        judgeRes.push('TLE');
      } else if (item.executeMemory > this.config.executeMemory) {
        judgeRes.push('MLE');
      } else if (
        computeMD5(`${this.sampleDir}/${i}.out`) ===
        computeMD5(`${this.workDir}/output/${i}.out`)
      ) {
        judgeRes.push('AC');
      } else judgeRes.push('WA');
    }
    return judgeRes;
  }

  /**
   * 判题机入口
   * @returns {Promise<void>}
   */
  async runner() {
    await this.created();
    const c = await this.compile();
    const e = await this.execute();
    let res = {};
    if (Array.isArray(e)) {
      const j = await this.judge(e);
      res = {
        compile: c,
        execute: e,
        judge: j,
      };
      // console.log(res);
    } else {
      res = {
        compile: c,
        execute: e,
      };
      // console.log(res);
    }
    return res;
  }
}

const fn = async () => {
  const res = await new Manager(workerData).runner();
  parentPort.postMessage(res);
};

if (!isMainThread) {
  fn();
}
