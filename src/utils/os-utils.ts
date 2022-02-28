const os = require('os');
export const getCPUUsage = async (free = false) => {
  const stats1 = getCPUInfo();
  const startIdle = stats1.idle;
  const startTotal = stats1.total;

  return new Promise(resolve => {
    setTimeout(() => {
      const stats2 = getCPUInfo();
      const endIdle = stats2.idle;
      const endTotal = stats2.total;

      const idle = endIdle - startIdle;
      const total = endTotal - startTotal;
      const perc = idle / total;

      if (free === true) resolve(perc * 100);
      else resolve((1 - perc) * 100);
    }, 1000);
  });
};

export const getCPUInfo = () => {
  const cpus = os.cpus();

  let user = 0;
  let nice = 0;
  let sys = 0;
  let idle = 0;
  let irq = 0;

  for (const cpu in cpus) {
    if (!cpus[cpu]) continue;
    user += cpus[cpu].times.user;
    nice += cpus[cpu].times.nice;
    sys += cpus[cpu].times.sys;
    irq += cpus[cpu].times.irq;
    idle += cpus[cpu].times.idle;
  }

  const total = user + nice + sys + idle + irq;

  return {
    idle: idle,
    total: total,
  };
};
