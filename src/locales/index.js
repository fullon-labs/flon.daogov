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

const governanceListTerms={
  fr:{'Community sentiment is for discussion only and does not replace on-chain governance voting.':'Les réactions communautaires servent uniquement à la discussion et ne remplacent pas le vote de gouvernance on-chain.','Load more':'Charger plus'},
  ja:{'Community sentiment is for discussion only and does not replace on-chain governance voting.':'コミュニティの反応は議論専用であり、オンチェーンのガバナンス投票に代わるものではありません。','Load more':'さらに読み込む'},
  ko:{'Community sentiment is for discussion only and does not replace on-chain governance voting.':'커뮤니티 반응은 토론용이며 온체인 거버넌스 투표를 대체하지 않습니다.','Load more':'더 보기'},
  es:{'Community sentiment is for discussion only and does not replace on-chain governance voting.':'Las reacciones de la comunidad son solo para debatir y no sustituyen la votación de gobernanza on-chain.','Load more':'Cargar más'},
  'zh-TW':{'Community sentiment is for discussion only and does not replace on-chain governance voting.':'社區表態僅用於討論，不代替鏈上治理投票。','Load more':'載入更多'}
};

const walletProviderTerms={
  fr:{'Choose a connection method':'Choisissez une méthode de connexion','HuFu browser extension':'Extension de navigateur HuFu','Use the wallet installed in this browser':'Utiliser le portefeuille installé dans ce navigateur','Connect with QR code':'Connexion par code QR','Scan with the HuFu mobile wallet':'Scanner avec le portefeuille mobile HuFu'},
  ja:{'Choose a connection method':'接続方法を選択','HuFu browser extension':'HuFu ブラウザ拡張機能','Use the wallet installed in this browser':'このブラウザにインストールされたウォレットを使用','Connect with QR code':'QRコードで接続','Scan with the HuFu mobile wallet':'HuFu モバイルウォレットでスキャン'},
  ko:{'Choose a connection method':'연결 방법 선택','HuFu browser extension':'HuFu 브라우저 확장 프로그램','Use the wallet installed in this browser':'이 브라우저에 설치된 지갑 사용','Connect with QR code':'QR 코드로 연결','Scan with the HuFu mobile wallet':'HuFu 모바일 지갑으로 스캔'},
  es:{'Choose a connection method':'Elige un método de conexión','HuFu browser extension':'Extensión de navegador HuFu','Use the wallet installed in this browser':'Usar la cartera instalada en este navegador','Connect with QR code':'Conectar con código QR','Scan with the HuFu mobile wallet':'Escanear con la cartera móvil HuFu'},
  'zh-TW':{'Choose a connection method':'選擇連接方式','HuFu browser extension':'HuFu 瀏覽器擴充套件','Use the wallet installed in this browser':'使用此瀏覽器已安裝的錢包','Connect with QR code':'使用二維碼連接','Scan with the HuFu mobile wallet':'使用 HuFu 手機錢包掃碼'}
};

export const generatedLocaleTerms={
  fr:{...fr,...helpCenterTerms.fr,...discussionTerms.fr,...discussionDetailTerms.fr,...governanceListTerms.fr,...walletProviderTerms.fr},
  ja:{...ja,...helpCenterTerms.ja,...discussionTerms.ja,...discussionDetailTerms.ja,...governanceListTerms.ja,...walletProviderTerms.ja},
  ko:{...ko,...helpCenterTerms.ko,...discussionTerms.ko,...discussionDetailTerms.ko,...governanceListTerms.ko,...walletProviderTerms.ko},
  es:{...es,...helpCenterTerms.es,...discussionTerms.es,...discussionDetailTerms.es,...governanceListTerms.es,...walletProviderTerms.es},
  'zh-TW':{...zhTW,...discussionTerms['zh-TW'],...discussionDetailTerms['zh-TW'],...governanceListTerms['zh-TW'],...walletProviderTerms['zh-TW']}
};
