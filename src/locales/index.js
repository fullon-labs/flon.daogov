import fr from './fr.js';
import ja from './ja.js';
import ko from './ko.js';
import es from './es.js';
import zhTW from './zh-TW.js';
import {helpCenterTerms} from './help-center.js';
import discussionTerms from './discussions.js';

const discussionDetailTerms={
  fr:{'View proposal':'Voir la proposition','Loading discussion details…':'Chargement de la discussion…','Community replies':'Réponses de la communauté','No replies yet':'Aucune réponse','Reply to discussion':'Répondre à la discussion','Publish reply':'Publier la réponse','Reply published':'Réponse publiée','Could not load the discussion. Try again later':'Impossible de charger la discussion. Réessayez plus tard','Could not publish the reply. Try again later':'Impossible de publier la réponse. Réessayez plus tard'},
  ja:{'View proposal':'提案を見る','Loading discussion details…':'議論の詳細を読み込み中…','Community replies':'コミュニティの返信','No replies yet':'返信はまだありません','Reply to discussion':'議論に返信','Publish reply':'返信を公開','Reply published':'返信を公開しました','Could not load the discussion. Try again later':'議論を読み込めませんでした。後でもう一度お試しください','Could not publish the reply. Try again later':'返信を公開できませんでした。後でもう一度お試しください'},
  ko:{'View proposal':'제안 보기','Loading discussion details…':'토론 상세 불러오는 중…','Community replies':'커뮤니티 답글','No replies yet':'아직 답글이 없습니다','Reply to discussion':'토론에 답글','Publish reply':'답글 게시','Reply published':'답글이 게시되었습니다','Could not load the discussion. Try again later':'토론을 불러오지 못했습니다. 잠시 후 다시 시도하세요','Could not publish the reply. Try again later':'답글을 게시하지 못했습니다. 잠시 후 다시 시도하세요'},
  es:{'View proposal':'Ver propuesta','Loading discussion details…':'Cargando detalles de la discusión…','Community replies':'Respuestas de la comunidad','No replies yet':'Aún no hay respuestas','Reply to discussion':'Responder a la discusión','Publish reply':'Publicar respuesta','Reply published':'Respuesta publicada','Could not load the discussion. Try again later':'No se pudo cargar la discusión. Inténtalo de nuevo más tarde','Could not publish the reply. Try again later':'No se pudo publicar la respuesta. Inténtalo de nuevo más tarde'},
  'zh-TW':{'View proposal':'查看提案','Loading discussion details…':'正在讀取討論詳情…','Community replies':'社區回覆','No replies yet':'暫無回覆','Reply to discussion':'回覆討論','Publish reply':'發布回覆','Reply published':'回覆已發布','Could not load the discussion. Try again later':'讀取討論詳情失敗，請稍後重試','Could not publish the reply. Try again later':'發布回覆失敗，請稍後重試'}
};

export const generatedLocaleTerms={
  fr:{...fr,...helpCenterTerms.fr,...discussionTerms.fr,...discussionDetailTerms.fr},
  ja:{...ja,...helpCenterTerms.ja,...discussionTerms.ja,...discussionDetailTerms.ja},
  ko:{...ko,...helpCenterTerms.ko,...discussionTerms.ko,...discussionDetailTerms.ko},
  es:{...es,...helpCenterTerms.es,...discussionTerms.es,...discussionDetailTerms.es},
  'zh-TW':{...zhTW,...discussionTerms['zh-TW'],...discussionDetailTerms['zh-TW']}
};
