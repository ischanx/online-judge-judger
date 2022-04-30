const fs = require('fs');
const child_process = require('child_process');
const startTime = Date.now();
// 获取当前环境信息
let config = {};
config = JSON.parse(fs.readFileSync('./config.json').toString());

// 预设环境执行命令
const env = () => {
  const preCompile = config.clear ? `rm -rf ${config.fileName}.run;` : '';
  const preExecute = config.clear ? 'rm -rf output;mkdir output;' : '';
  const preset = {
    c: {
      compileCMD: `/usr/bin/time -f ::run-info%S-%U-%M-%e::run-info gcc ${config.fileName}.c -o ${config.fileName}.run -O2 -DONLINE_JUDGE -w -lm -fmax-errors=3 -std=c11`,
      // compileCMD: `gcc ${config.problemId}/${config.fileName}.c -o ${config.problemId}/${config.fileName}.run -O2 -DONLINE_JUDGE -w -lm -fmax-errors=3 -std=c11`,
      // executeCMD: `${config.problemId}/${config.fileName}.run < data/${config.problemId}/${testNumber}.in > ${config.problemId}/user-${testNumber}.out;`,
      executeCMD: `/usr/bin/time -f ::run-info%S-%U-%M-%e::run-info ./${config.fileName}.run < ./sample/${process.env.SAMPLE_NAME}.in > output/${process.env.SAMPLE_NAME}.out;`,
    },
    cpp: {
      compileCMD: `/usr/bin/time -f ::run-info%S-%U-%M-%e::run-info g++ ${config.fileName}.cpp -o ${config.fileName}.run -DONLINE_JUDGE -O2 -w -lm -fmax-errors=3`,
      executeCMD: `/usr/bin/time -f ::run-info%S-%U-%M-%e::run-info ./${config.fileName}.run < ./sample/${process.env.SAMPLE_NAME}.in > output/${process.env.SAMPLE_NAME}.out;`,
    },
    jsNode: {
      executeCMD: `/usr/bin/time -f ::run-info%S-%U-%M-%e::run-info node ./${config.fileName}.js < ./sample/${process.env.SAMPLE_NAME}.in > output/${process.env.SAMPLE_NAME}.out;`,
    },
  };
  return {
    compileCMD: preCompile + preset[config.language].compileCMD,
    executeCMD: preExecute + preset[config.language].executeCMD,
  };
};

if (process.env.CURRENT_STEP === 'compile') {
  const compile_process = child_process.exec(
    env().compileCMD,
    {
      timeout: config.compileTime,
    },
    (err, stdout, stderr) => {
      // console.log(err,stdout,stderr)
      const stderrParser = stderr.split('::run-info');
      const stderrStr =
        stderrParser.length > 2
          ? (stderrParser[0] || '') +
            ((stderrParser[2] === '\n' ? '' : stderrParser[2]) || '')
          : stderrParser[0];
      let statistics = null;
      if (compile_process.signalCode === 'SIGTERM') {
        statistics = {};
      } else {
        const status = stderrParser[1].split('-');
        statistics = {
          cpuTime: Number(status[0]) * 1000 + Number(status[1]) * 1000,
          memory: Number(status[2]),
          cmdTime: Number(status[3]) * 1000,
        };
      }
      const endTime = Date.now();
      const runResult = {
        step: process.env.CURRENT_STEP,
        startTime,
        endTime,
        duration: endTime - startTime,
        stderr: stderrStr,
        stdout: stdout || '',
        err: err || '',
        exitCode: compile_process.exitCode,
        signalCode: compile_process.signalCode,
        ...statistics,
      };
      console.log(JSON.stringify(runResult));
    }
  );
} else {
  const execute_process = child_process.exec(
    env().executeCMD,
    {
      timeout: config.executeTime,
    },
    (err, stdout, stderr) => {
      const stderrParser = stderr.split('::run-info');
      const stderrStr =
        stderrParser.length > 2
          ? (stderrParser[0] || '') +
            ((stderrParser[2] === '\n' ? '' : stderrParser[2]) || '')
          : stderrParser[0];
      let statistics = null;
      if (execute_process.signalCode === 'SIGTERM') {
        statistics = {};
      } else {
        const status = stderrParser[1].split('-');
        statistics = {
          cpuTime: Number(status[0]) * 1000 + Number(status[1]) * 1000,
          memory: Number(status[2]),
          cmdTime: Number(status[3]) * 1000,
        };
      }
      const endTime = Date.now();
      const runResult = {
        step: process.env.CURRENT_STEP,
        sampleName: process.env.SAMPLE_NAME,
        startTime,
        endTime,
        duration: endTime - startTime,
        stderr: stderrStr,
        stdout: stdout || '',
        err: err || '',
        exitCode: execute_process.exitCode,
        signalCode: execute_process.signalCode,
        ...statistics,
      };
      console.log(JSON.stringify(runResult));
    }
  );
}

// const execute_process = child_process.exec('ulimit -a',{
//   timeout: 10000,
// } ,function (err, std,out){
//   console.log("err",err);
//   console.log("stdout", std);
//   console.log("stderr", out);
// });
// execute_process.on("exit", function (code, signal){
//   const map = {
//     152: "[OJ-152] TLE",
//     153: "[OJ-153] RE",
//     136: "[OJ-136] SIGFPE算术异常",
//     137: "[OJ-137] MLE",
//     139: "[OJ-139] MLE",
//   }
//   const res = map[code] ? map[code] : `[OJ-${code}] ${signal}`;
//   console.log(res)
// });
