import {
  Controller,
  Provide,
  Inject,
  Post,
  Body,
  ALL,
} from '@midwayjs/decorator';

import { Context } from 'egg';
import { JudgeService } from '../service/judge';

@Provide()
@Controller('/')
export class ProblemController {
  @Inject()
  ctx: Context;

  @Inject()
  judgeService: JudgeService;

  @Post('/judge')
  async delete(@Body(ALL) body) {
    console.log(body);
    this.ctx.body = '123';
  }
}
