const keys=[
  'Governance Help Center','Loading on-chain parameters…','Learn node voting, DAO decisions, epochs, and reward claims','FLON, GLON, and governance power',
  'Users lock FLON for node voting and receive an equal amount of non-transferable GLON. GLON measures DAO governance power; proposals and votes do not transfer or consume it.',
  'Current on-chain parameters','These values are read live from the current network contract tables. Each FLON block slot is 0.5 seconds, so an epoch lasts epoch_slots × 0.5 seconds. Governance proposal phases use separate durations and are not reward epochs.','GAS reward epoch',
  'Node voting and epochs','Each BP can receive a different FLON allocation, with up to 30 candidates. Changes enter pending state and take effect at the next epoch boundary. An epoch is the on-chain window for ranking, snapshots, performance, and rewards.',
  'Proposal lifecycle and Timelock','The full flow is: proposal creation → endorsement → voting delay → formal voting → finalization → Timelock → execution grace period → executed or expired. Endorsement decides whether a proposal advances, formal voting grants or rejects community authorization, and Timelock is the mandatory safety delay after approval but before execution.',
  'An endorsement never becomes a For vote automatically. The voting delay provides review time and fixes the GLON snapshot at activation. During Timelock, voting is closed and frozen actions cannot be replaced. Once it expires, any account may permissionlessly call execute during the grace period; otherwise expire marks the proposal expired.',
  'Testnet may use short 5–30 minute periods to validate the state machine; a displayed 5-minute value is a test configuration. Suggested mainnet starting values are 2–3 days for endorsement, 12–24 hours for voting delay, 3–7 days for voting, 2 days of Timelock for ordinary parameters, 5–7 days for high-risk actions, and a 7-day execution grace period. Mainnet must be configured separately through governance.',
  'activate, finalize, queue, execute, and expire are permissionless. A caller may only advance state and cannot modify actions or parameters frozen when the proposal was created.',
  'L1-L4 governance safety tiers','Every executable action needs both an execution allowlist rule and a risk tier. activate checks the tier minimum network GLON power and freezes its rules; finalize checks turnout, approval, and absolute support. A multi-action proposal uses its highest tier. Only flon authority may call setriskcfg or setactrisk, so the DAO cannot lower its own safety floor.',
  'minimum network power','approval','absolute support','The contract has no L1-L4 risk policies yet. Unclassified executable actions must not enter voting.',
  'Rewards are claimed, not airdropped','BP block and GAS rewards first become on-chain claim records. They accumulate across epochs and do not expire merely because they were not claimed immediately. Voters claim through voter.reward::claimrewards.',
  'The Keeper program associated with epoch.keeper periodically triggers permissionless operations such as epoch closing and BP reward claims. It does not hold BP keys, custody rewards, or change recipients; rewards always go to the BP recorded on-chain.',
  'Keeper is a convenience, not a single point of failure. If it is offline, the BP or any user may manually call flon::claimrewards from this DApp; the reward still goes directly to the BP.',
  'Before signing','Verify the network, Chain ID, account, contract, action, parameters, and recipient. Help content is not transaction authorization; only the actual transaction shown by the wallet is signed.','Open node voting','Trigger BP claim',
  'BP self-stake and unlock settings','Enforce self-stake requirement in scheduling','Minimum BP self-stake','Self-stake unlock period (seconds)','Enter the unlock period in seconds; 21 days is 1814400 seconds. The new value only affects unstake requests created after it takes effect; existing pending refunds are unchanged.'
];

const values={
  fr:[
    'Centre d’aide à la gouvernance','Chargement des paramètres on-chain…','Comprendre le vote des nœuds, les décisions DAO, les Epochs et la réclamation des récompenses','FLON, GLON et pouvoir de gouvernance',
    'Les utilisateurs verrouillent des FLON pour voter pour les nœuds et reçoivent le même montant de GLON non transférables. Le GLON mesure le pouvoir de gouvernance de la DAO ; les propositions et les votes ne le transfèrent ni ne le consomment.',
    'Paramètres on-chain actuels','Ces valeurs sont lues en direct depuis les tables des contrats du réseau. Chaque slot de bloc FLON dure 0,5 seconde ; une Epoch dure donc epoch_slots × 0,5 seconde. Les phases des propositions ont leurs propres durées et ne sont pas des Epochs de récompense.','Epoch de récompense GAS',
    'Vote des nœuds et Epochs','Chaque BP peut recevoir une allocation FLON différente, pour un maximum de 30 candidats. Les changements passent en attente et prennent effet à la prochaine limite d’Epoch. Une Epoch est la fenêtre on-chain utilisée pour le classement, les instantanés, les performances et les récompenses.',
    'Cycle de vie des propositions et Timelock','Le cycle complet est : création → approbation initiale → délai de vote → vote formel → finalisation → Timelock → délai d’exécution → exécutée ou expirée. L’approbation initiale détermine l’accès au vote, le vote formel accorde ou refuse l’autorisation communautaire, et le Timelock est le délai de sécurité obligatoire avant exécution.',
    'Une approbation initiale ne devient jamais automatiquement un vote Pour. Le délai de vote laisse le temps d’examiner la proposition et fixe l’instantané GLON à l’activation. Pendant le Timelock, le vote est clos et les actions verrouillées ne peuvent plus être remplacées. Ensuite, tout compte peut appeler execute sans permission pendant le délai prévu ; sinon expire marque la proposition comme expirée.',
    'Le testnet peut utiliser des périodes courtes de 5 à 30 minutes pour tester la machine d’états. Pour le mainnet, les valeurs de départ suggérées sont : 2–3 jours d’approbation initiale, 12–24 heures de délai, 3–7 jours de vote, 2 jours de Timelock pour les paramètres ordinaires, 5–7 jours pour les actions à haut risque et 7 jours de délai d’exécution. Le mainnet doit être configuré séparément par gouvernance.',
    'activate, finalize, queue, execute et expire sont sans permission. L’appelant peut seulement faire avancer l’état et ne peut pas modifier les actions ou paramètres verrouillés lors de la création.',
    'Niveaux de sécurité de gouvernance L1–L4','Chaque action exécutable exige une règle de liste blanche et un niveau de risque. activate vérifie le pouvoir GLON minimal du niveau et fige les règles ; finalize vérifie la participation, l’approbation et le soutien absolu. Une proposition multi-action adopte le niveau le plus élevé. Seule l’autorité flon peut appeler setriskcfg ou setactrisk.','pouvoir réseau minimal','approbation','soutien absolu','Le contrat ne possède encore aucune politique de risque L1–L4. Une action exécutable non classée ne doit pas accéder au vote.',
    'Les récompenses doivent être réclamées','Les récompenses de blocs BP et GAS deviennent d’abord des soldes réclamables on-chain. Elles s’accumulent entre les Epochs et n’expirent pas si elles ne sont pas réclamées immédiatement. Les votants utilisent voter.reward::claimrewards.',
    'Le programme Keeper associé à epoch.keeper déclenche périodiquement des opérations sans permission, notamment la clôture des Epochs et la réclamation des récompenses BP. Il ne détient aucune clé BP, ne conserve aucune récompense et ne peut pas changer le bénéficiaire.',
    'Keeper est un service pratique, pas un point de défaillance unique. S’il est hors ligne, le BP ou tout utilisateur peut appeler manuellement flon::claimrewards depuis cette DApp ; la récompense est toujours versée directement au BP.',
    'Avant de signer','Vérifiez le réseau, le Chain ID, le compte, le contrat, l’action, les paramètres et le bénéficiaire. L’aide ne constitue pas une autorisation ; seule la transaction réellement affichée par le portefeuille est signée.','Ouvrir le vote des nœuds','Déclencher la réclamation BP',
    'Paramètres d’auto-staking et de déverrouillage BP','Appliquer l’auto-staking lors de la planification','Auto-staking minimal du BP','Délai de déverrouillage de l’auto-staking (secondes)','Saisissez le délai en secondes ; 21 jours correspondent à 1814400 secondes. La nouvelle valeur ne concerne que les demandes créées après son entrée en vigueur ; les remboursements déjà en attente restent inchangés.'
  ],
  ja:[
    'ガバナンス・ヘルプセンター','オンチェーン設定を読み込み中…','ノード投票、DAO の意思決定、Epoch、報酬受取について学ぶ','FLON、GLON、ガバナンス権',
    'ユーザーはノード投票のために FLON をロックし、同量の譲渡不可 GLON を受け取ります。GLON は DAO のガバナンス権を表し、支払用トークンではありません。提案や投票で GLON が移転・消費されることはありません。',
    '現在のオンチェーン基本設定','値は現在のネットワークのコントラクトテーブルからリアルタイムで取得されます。FLON の各ブロックスロットは 0.5 秒のため、Epoch は epoch_slots × 0.5 秒です。提案の各段階には独立した期間があり、報酬 Epoch とは異なります。','GAS 報酬 Epoch',
    'ノード投票と Epoch','BP ごとに異なる量の FLON を割り当てられ、最大 30 候補まで選択できます。変更は保留状態となり、次の Epoch 境界で有効になります。Epoch はランキング、スナップショット、実績、報酬を確定するオンチェーン期間です。',
    '提案ライフサイクルと Timelock','全体の流れは、提案作成 → エンドース → 投票遅延 → 正式投票 → 確定 → Timelock → 実行猶予 → 実行済みまたは期限切れです。エンドースは投票段階へ進めるかを決め、正式投票はコミュニティ承認を決定し、Timelock は承認後かつ実行前の必須安全待機期間です。',
    'エンドースが自動的に賛成票になることはありません。投票遅延は確認時間を確保し、activate 時点の GLON スナップショットを固定します。Timelock 中は投票が終了し、ロック済みアクションは変更できません。終了後は猶予期間内に任意のアカウントが execute を呼び出せます。期限を超えると expire により期限切れになります。',
    'テストネットでは状態遷移の検証に 5～30 分の短い期間を使用できます。メインネットの初期推奨値は、エンドース 2～3 日、投票遅延 12～24 時間、投票 3～7 日、通常パラメータの Timelock 2 日、高リスク操作 5～7 日、実行猶予 7 日です。メインネットはガバナンスで別途設定する必要があります。',
    'activate、finalize、queue、execute、expire はパーミッションレスです。呼び出し元は状態を進めることしかできず、提案作成時に固定されたアクションやパラメータを変更できません。',
    'L1～L4 ガバナンス安全レベル','実行可能な各アクションには実行許可リストとリスクレベルの両方が必要です。activate は最低 GLON 権限を確認してルールを固定し、finalize は参加率、賛成率、絶対支持を確認します。複数アクションでは最高リスクレベルを採用します。setriskcfg と setactrisk は flon 権限のみが実行できます。','最低ネットワーク権限','賛成率','絶対支持','コントラクトにはまだ L1～L4 リスクポリシーがありません。未分類の実行可能アクションは投票に進めません。',
    '報酬は自動配布ではなく受取が必要','BP ブロック報酬と GAS 報酬は、まずオンチェーンの受取可能残高になります。Epoch をまたいで蓄積され、すぐに受け取らなくても失効しません。投票者は voter.reward::claimrewards で受け取ります。',
    'epoch.keeper の Keeper は、Epoch の終了や BP 報酬受取などのパーミッションレス操作を定期的に実行します。BP キーや報酬を保管せず、受取先も変更できません。報酬は常にオンチェーンに記録された BP に支払われます。',
    'Keeper は利便機能であり単一障害点ではありません。停止時も BP または任意のユーザーがこの DApp から flon::claimrewards を手動実行でき、報酬は BP に直接支払われます。',
    '署名前の確認','ネットワーク、Chain ID、アカウント、コントラクト、アクション、パラメータ、受取先を確認してください。ヘルプは取引承認ではなく、ウォレット確認画面に表示された実際の取引だけが署名されます。','ノード投票を開く','BP 報酬受取を実行',
    'BP 自己ステークとロック解除設定','スケジュールで自己ステーク要件を適用','BP 最低自己ステーク','自己ステークのロック解除期間（秒）','解除期間は秒単位で入力します。21 日は 1814400 秒です。新しい値は発効後に作成された unstake 申請にのみ適用され、既存の保留中の返金は変更されません。'
  ],
  ko:[
    '거버넌스 도움말 센터','온체인 매개변수 불러오는 중…','노드 투표, DAO 의사결정, Epoch 및 보상 수령 알아보기','FLON, GLON 및 거버넌스 권한',
    '사용자는 노드 투표를 위해 FLON을 잠그고 동일한 양의 양도 불가 GLON을 받습니다. GLON은 DAO 거버넌스 권한을 나타내며 결제 토큰이 아닙니다. 제안과 투표로 GLON이 이전되거나 소모되지 않습니다.',
    '현재 온체인 기본 매개변수','값은 현재 네트워크의 컨트랙트 테이블에서 실시간으로 읽습니다. FLON 블록 슬롯은 0.5초이므로 Epoch 길이는 epoch_slots × 0.5초입니다. 거버넌스 제안 단계는 별도 기간을 사용하며 보상 Epoch와 다릅니다.','GAS 보상 Epoch',
    '노드 투표와 Epoch','각 BP에 서로 다른 FLON 수량을 배분할 수 있으며 최대 30개 후보를 선택할 수 있습니다. 변경은 대기 상태로 기록되고 다음 Epoch 경계에서 적용됩니다. Epoch는 순위, 스냅샷, 성과 및 보상을 확정하는 온체인 시간 구간입니다.',
    '제안 수명 주기와 Timelock','전체 절차는 제안 생성 → 지지 → 투표 지연 → 정식 투표 → 확정 → Timelock → 실행 유예 → 실행 또는 만료입니다. 지지는 투표 단계 진입 여부를 결정하고, 정식 투표는 커뮤니티 승인을 결정하며, Timelock은 승인 후 실행 전에 반드시 거쳐야 하는 안전 대기 시간입니다.',
    '지지는 자동으로 찬성표가 되지 않습니다. 투표 지연은 검토 시간을 제공하고 activate 시 GLON 스냅샷을 확정합니다. Timelock 동안 투표는 종료되며 잠긴 액션은 교체할 수 없습니다. 종료 후 유예 기간에는 누구나 execute를 호출할 수 있으며, 기한이 지나면 expire가 제안을 만료 처리합니다.',
    '테스트넷은 상태 머신 검증을 위해 5~30분의 짧은 기간을 사용할 수 있습니다. 메인넷 권장 시작값은 지지 2~3일, 투표 지연 12~24시간, 정식 투표 3~7일, 일반 매개변수 Timelock 2일, 고위험 작업 5~7일, 실행 유예 7일입니다. 메인넷은 거버넌스를 통해 별도로 설정해야 합니다.',
    'activate, finalize, queue, execute, expire는 권한 없이 호출할 수 있습니다. 호출자는 상태만 진행할 수 있고 제안 생성 시 잠긴 액션이나 매개변수를 변경할 수 없습니다.',
    'L1–L4 거버넌스 안전 등급','실행 가능한 각 액션에는 실행 허용 목록과 위험 등급이 모두 필요합니다. activate는 등급별 최소 GLON 권한을 확인하고 규칙을 잠그며, finalize는 참여율, 찬성률, 절대 지지를 확인합니다. 여러 액션은 가장 높은 위험 등급을 적용합니다. setriskcfg와 setactrisk는 flon 권한만 호출할 수 있습니다.','최소 네트워크 권한','찬성률','절대 지지','컨트랙트에 아직 L1–L4 위험 정책이 없습니다. 분류되지 않은 실행 액션은 투표 단계에 들어갈 수 없습니다.',
    '보상은 자동 지급되지 않으며 직접 수령','BP 블록 및 GAS 보상은 먼저 온체인 수령 가능 잔액으로 기록됩니다. Epoch가 지나도 누적되며 즉시 수령하지 않아도 만료되지 않습니다. 투표자는 voter.reward::claimrewards로 수령합니다.',
    'epoch.keeper의 Keeper 프로그램은 Epoch 종료와 BP 보상 수령 같은 무권한 작업을 주기적으로 실행합니다. BP 키나 보상을 보관하지 않고 수령 계정을 변경할 수도 없습니다. 보상은 항상 온체인에 기록된 BP로 지급됩니다.',
    'Keeper는 편의 기능이지 단일 장애점이 아닙니다. 중단되어도 BP 또는 누구나 이 DApp에서 flon::claimrewards를 직접 호출할 수 있으며 보상은 BP 계정으로 직접 지급됩니다.',
    '서명 전 확인','네트워크, Chain ID, 계정, 컨트랙트, 액션, 매개변수와 수령인을 확인하세요. 도움말은 거래 승인이 아니며 지갑 확인 화면에 표시된 실제 거래만 서명됩니다.','노드 투표 열기','BP 보상 수령 실행',
    'BP 자체 스테이킹 및 잠금 해제 설정','스케줄에서 자체 스테이킹 요건 적용','최소 BP 자체 스테이킹','자체 스테이킹 잠금 해제 기간(초)','잠금 해제 기간은 초 단위로 입력합니다. 21일은 1814400초입니다. 새 값은 적용 이후 생성된 unstake 요청에만 적용되며 기존 대기 중 환불은 변경되지 않습니다.'
  ],
  es:[
    'Centro de ayuda de gobernanza','Cargando parámetros on-chain…','Aprende sobre votación de nodos, decisiones DAO, Epochs y cobro de recompensas','FLON, GLON y poder de gobernanza',
    'Los usuarios bloquean FLON para votar por nodos y reciben la misma cantidad de GLON no transferible. GLON representa el poder de gobernanza de la DAO; no es un token de pago y las propuestas o votos no lo transfieren ni consumen.',
    'Parámetros on-chain actuales','Estos valores se leen en tiempo real de las tablas de contratos de la red. Cada slot de bloque FLON dura 0,5 segundos, por lo que una Epoch dura epoch_slots × 0,5 segundos. Las fases de propuestas tienen duraciones independientes y no son Epochs de recompensa.','Epoch de recompensas GAS',
    'Votación de nodos y Epochs','Cada BP puede recibir una asignación FLON distinta, con un máximo de 30 candidatos. Los cambios quedan pendientes y entran en vigor en el siguiente límite de Epoch. Una Epoch es la ventana on-chain para clasificación, instantáneas, rendimiento y recompensas.',
    'Ciclo de propuestas y Timelock','El flujo completo es: creación → respaldo → retraso de votación → votación formal → finalización → Timelock → período de ejecución → ejecutada o vencida. El respaldo decide si la propuesta avanza, la votación formal concede o rechaza la autorización comunitaria y el Timelock es la espera de seguridad obligatoria antes de ejecutar.',
    'Un respaldo nunca se convierte automáticamente en voto a favor. El retraso permite revisar la propuesta y fija la instantánea GLON al activar. Durante el Timelock la votación está cerrada y las acciones bloqueadas no pueden sustituirse. Después, cualquier cuenta puede llamar execute durante el período de gracia; de lo contrario expire marca la propuesta como vencida.',
    'La testnet puede usar períodos cortos de 5–30 minutos para validar la máquina de estados. Para mainnet se sugieren 2–3 días de respaldo, 12–24 horas de retraso, 3–7 días de votación, 2 días de Timelock para parámetros normales, 5–7 días para acciones de alto riesgo y 7 días de gracia de ejecución. Mainnet debe configurarse por separado mediante gobernanza.',
    'activate, finalize, queue, execute y expire no requieren permiso. Quien los llama solo puede avanzar el estado y no puede modificar acciones ni parámetros bloqueados al crear la propuesta.',
    'Niveles de seguridad de gobernanza L1–L4','Cada acción ejecutable necesita una regla de lista permitida y un nivel de riesgo. activate verifica el poder GLON mínimo y congela las reglas; finalize verifica participación, aprobación y apoyo absoluto. Una propuesta con varias acciones usa el nivel más alto. Solo la autoridad flon puede llamar setriskcfg o setactrisk.','poder mínimo de la red','aprobación','apoyo absoluto','El contrato aún no tiene políticas de riesgo L1–L4. Las acciones ejecutables sin clasificar no deben entrar en votación.',
    'Las recompensas se cobran, no se envían automáticamente','Las recompensas de bloques BP y GAS se registran primero como saldos cobrables on-chain. Se acumulan entre Epochs y no vencen por no cobrarlas de inmediato. Los votantes usan voter.reward::claimrewards.',
    'El programa Keeper asociado a epoch.keeper activa periódicamente operaciones sin permiso, como el cierre de Epochs y el cobro de recompensas BP. No guarda claves BP ni recompensas y no puede cambiar el destinatario; las recompensas siempre llegan al BP registrado on-chain.',
    'Keeper es una comodidad, no un punto único de fallo. Si está fuera de línea, el BP o cualquier usuario puede llamar manualmente flon::claimrewards desde esta DApp; la recompensa sigue llegando directamente al BP.',
    'Antes de firmar','Verifica la red, Chain ID, cuenta, contrato, acción, parámetros y destinatario. La ayuda no autoriza una transacción; solo se firma la transacción real mostrada por la cartera.','Abrir votación de nodos','Activar cobro del BP',
    'Configuración de auto-staking y desbloqueo del BP','Aplicar el auto-staking en la programación','Auto-staking mínimo del BP','Período de desbloqueo del auto-staking (segundos)','Introduce el período en segundos; 21 días son 1814400 segundos. El nuevo valor solo afecta a solicitudes creadas después de entrar en vigor; los reembolsos pendientes existentes no cambian.'
  ]
};

export const helpCenterTerms=Object.fromEntries(Object.entries(values).map(([locale,translations])=>{
  if(translations.length!==keys.length)throw new Error(`Help locale ${locale} has ${translations.length} entries; expected ${keys.length}`);
  return [locale,Object.fromEntries(keys.map((key,index)=>[key,translations[index]]))];
}));
