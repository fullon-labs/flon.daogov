import fr from './fr.js';
import ja from './ja.js';
import ko from './ko.js';
import es from './es.js';
import zhTW from './zh-TW.js';
import {helpCenterTerms} from './help-center.js';
import discussionTerms from './discussions.js';

export const generatedLocaleTerms={
  fr:{...fr,...helpCenterTerms.fr,...discussionTerms.fr},
  ja:{...ja,...helpCenterTerms.ja,...discussionTerms.ja},
  ko:{...ko,...helpCenterTerms.ko,...discussionTerms.ko},
  es:{...es,...helpCenterTerms.es,...discussionTerms.es},
  'zh-TW':{...zhTW,...discussionTerms['zh-TW']}
};
