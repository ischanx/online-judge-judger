import {
  Controller,
  Provide,
  Inject,
  Get,
  Post,
  Body,
  ALL,
  Config,
} from '@midwayjs/decorator';

import { Context } from 'egg';
import { JudgeService } from '../service/judger';
import { getCPUUsage } from '../utils/os-utils';
const os = require('os');
@Provide()
@Controller('/')
export class ProblemController {
  @Inject()
  ctx: Context;

  @Inject()
  judgeService: JudgeService;

  @Config('version')
  version: string;

  index = 0;

  @Get('/ping')
  async getServerInfo() {
    const cpus = os.cpus();
    const freemem = os.freemem();
    const totalmem = os.totalmem();
    const cpuUsage = await getCPUUsage();
    const server = {
      judger_version: this.version, // 评测机版本
      hostname: os.hostname(), // 主机名称
      cpu_core: cpus.length, // cpu的核心数，决定并发任务的数量
      cpu_model: cpus[0].model, // cpu名称
      cpu_usage: cpuUsage, // cpu 使用率
      memory_free: freemem, // 空闲内存
      memory_total: totalmem, // 总内存
      memory_usage: (100 * (totalmem - freemem)) / totalmem, // 内存使用率
    };
    this.ctx.body = server;
  }

  @Post('/judge')
  async judge(@Body(ALL) body) {
    const res = await this.judgeService.run(body);
    this.ctx.body = res;
  }
}
