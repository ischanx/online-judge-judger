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

  config.judgerToken = 'judgerToken';

  config.version = packageJSON.version;

  // config.security = {http.ts
  //   csrf: false,
  // };

  return config;
};
