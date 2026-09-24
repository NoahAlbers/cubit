import { localConfig } from '../dev/config';

export const environment = {
  jwtSecret: localConfig.jwtSecret,
  jwtExpiration: 60 * 60,
};
