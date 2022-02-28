import { Config, Provide } from '@midwayjs/decorator';
import { IWebMiddleware, IMidwayWebNext } from '@midwayjs/web';
import { Context } from 'egg';
// eslint-disable-next-line node/no-extraneous-import
import { ValidationError } from 'joi';

@Provide()
export class validateMiddleware implements IWebMiddleware {
  @Config('judgerToken')
  token: string;

  resolve() {
    return async (ctx: Context, next: IMidwayWebNext) => {
      const requestToken = ctx.request.headers['x-judge-server-token'];
      if (requestToken !== this.token) {
        ctx.body = {
          code: 400,
          message: '评测机token不一致，请检查配置',
        };
        return;
      }
      // 控制器前执行的逻辑
      const startTime = Date.now();
      ctx.body = {
        code: 0,
        message: 'success',
      };
      // 执行下一个 Web 中间件，最后执行到控制器
      try {
        await next();
      } catch (err) {
        if (err?.code) {
          ctx.body = {
            ...ctx.body,
            ...err,
          };
        } else if (err instanceof ValidationError) {
          ctx.body = {
            code: 4001,
            message: err.message,
          };
        } else {
          console.log(err);
          ctx.body = {
            code: 500,
            message: 'server error',
          };
        }
      }

      // 控制器之后执行的逻辑
      console.log(`${ctx.request.url} 耗时 ${Date.now() - startTime} ms`);
    };
  }
}
