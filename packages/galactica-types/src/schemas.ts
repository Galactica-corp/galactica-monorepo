import cex from '../schema/certificate_content/cex.json';
import dex from '../schema/certificate_content/dex.json';
import kyc from '../schema/certificate_content/kyc.json';
import rey from '../schema/certificate_content/rey.json';
import simpleJson from '../schema/certificate_content/simple_json.json';
import telegram from '../schema/certificate_content/telegram.json';
import twitter from '../schema/certificate_content/twitter.json';

/**
 * Content schemas for different certificate types.
 */
export const contentSchemas = {
  kyc,
  rey,
  twitter,
  telegram,
  dex,
  cex,
  simpleJson,
};
