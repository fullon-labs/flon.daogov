import fr from './fr.js';
import ja from './ja.js';
import ko from './ko.js';
import es from './es.js';
import zhTW from './zh-TW.js';
import {helpCenterTerms} from './help-center.js';

export const generatedLocaleTerms={
  fr:{...fr,...helpCenterTerms.fr},
  ja:{...ja,...helpCenterTerms.ja},
  ko:{...ko,...helpCenterTerms.ko},
  es:{...es,...helpCenterTerms.es},
  'zh-TW':zhTW
};
