import { EggAppConfig, EggAppInfo, PowerPartial } from 'egg';
const packageJSON = require('../../package.json');
export type DefaultConfig = PowerPartial<EggAppConfig>;

export default (appInfo: EggAppInfo) => {
  const config = {} as DefaultConfig;

  // use for cookie sign key, should change to your own and keep security
  config.keys = appInfo.name + '_1641210158431_5686';

  // add your config here
  config.middleware = ['validateMiddleware'];

  config.midwayFeature = {
    // true 代表使用 midway logger
    // false 或者为空代表使用 egg-logger
    replaceEggLogger: true,
  };

  config.JUDGE_TOKEN = 'preset token for authentication'; // 提前配置的评测机token，后端评测机管理需要
  config.JUDGE_VERSION = packageJSON.version; // 评测机的版本，跟随项目版本号
  config.JUDGE_URL = 'http://127.0.0.1:9001'; // 需要配置的评测机地址，优先使用内网
  config.BACKEND_URL = 'http://127.0.0.1:8001'; // 需要配置的后端服务地址，优先使用内网

  // config.security = {http.ts
  //   csrf: false,
  // };

  return config;
};
