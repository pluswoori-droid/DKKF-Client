import { useI18n, useLanguage, LanguageProvider } from './i18n';
import React, { useEffect, useState, createContext, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import type { Snapshot, Instance, Loader, Mod, Progress } from '../../shared/types';
import './style.css';
import target from '../../shared/target.json';
import { AccountIdentity, PlayerFace } from './AccountIdentity';
import logo from './assets/logo.png';
import { LocalContent, PresetOverview } from './InstanceContent';
type State = Snapshot & {
  packs: string[];
  activeAccount: string;
};
type Ctx = {
  s: State;
  run: <T = any>(method: string, args?: unknown) => Promise<T | undefined>;
  reload: () => Promise<void>;
  toast: (s: string) => void;
  epoch: number;
  pending: boolean;
};
const Context = createContext<Ctx>(null!);
const useApp = () => useContext(Context);
const pages = [
  ['Home', '홈'],
  ['Instances', '인스턴스'],
  ['Update Center', '업데이트'],
  ['Settings', '설정'],
  ['Account', '계정'],
];
function pageLabel(page: string) {
  return pages.find(([id]) => id === page)?.[1] || page;
}
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const t = useI18n();
  const paths: Record<string, React.ReactNode> = {
    Home: (
      <>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v11h5v-7h4v7h5V10" />
      </>
    ),
    Instances: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    'Mod Hub': (
      <>
        <path d="m12 3 9 5v9l-9 5-9-5V8Z" />
        <path d="m3 8 9 5 9-5M12 13v9" />
      </>
    ),
    'My Mods': (
      <>
        <path d="M4 5h16v15H4zM8 5V3h8v2M8 10h8M8 14h5" />
      </>
    ),
    Modpacks: (
      <>
        <rect x="3" y="7" width="18" height="14" rx="2" />
        <path d="m7 7 2-4h6l2 4M3 12h18M10 12v3h4v-3" />
      </>
    ),
    'Upload Center': (
      <>
        <path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6" />
      </>
    ),
    'Update Center': (
      <>
        <path d="M20 8a8 8 0 1 0 0 9M20 3v6h-6M12 8v5l3 2" />
      </>
    ),
    Settings: (
      <>
        <path d="m9 3-1 3-3 1-2 4 2 3v4l4 2 3-1 3 1 4-2v-4l2-3-2-4-3-1-1-3Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    Account: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 22v-3a8 8 0 0 1 16 0v3" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] || <path d="m8 5 10 7-10 7Z" />}
    </svg>
  );
}
function App() {
  const t = useI18n();
  const [s, setS] = useState<State>();
  const [page, setPage] = useState('Home');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [progress, setProgress] = useState<Progress>();
  const [logs, setLogs] = useState('');
  const [epoch, setEpoch] = useState(0);
  const [pending, setPending] = useState(false);
  const { setLanguage } = useLanguage();
  useEffect(() => {
    if (s) setLanguage(s.settings.language);
  }, [s?.settings.language]);
  const [showLogs, setShowLogs] = useState(false);
  const reload = async () => {
    const data = await window.dkkf.call<State>('state');
    setS(data);
    setEpoch((n) => n + 1);
  };
  useEffect(() => {
    if (!window.dkkf) {
      setError('Electron 연결이 없습니다. Dkkf Launcher 데스크톱 앱으로 실행하세요.');
      return;
    }
    void reload().catch((e) => setError(e.message));
    return window.dkkf.onEvent((e) => {
      if (e.type === 'state') {
        setS(e.data);
        setEpoch((n) => n + 1);
        if (!e.data.busy) setProgress(undefined);
      }
      if (e.type === 'progress') setProgress(e.data);
      if (e.type === 'notice') setToast(e.data);
      if (e.type === 'log') setLogs((l) => (l + e.data).slice(-70000));
      if (e.type === 'update') {
        setS((current) => (current ? { ...current, update: e.data } : current));
        if (e.data.status === 'available')
          setToast('새 런처 버전이 있습니다. 업데이트 센터에서 확인하세요.');
        if (e.data.status === 'ready')
          setToast('업데이트 다운로드 완료. 업데이트 센터에서 설치 프로그램을 열 수 있습니다.');
      }
    });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 7000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const account = s?.accounts.find((a) => a.id === s.activeAccount);
    if (!account || account.skinFace) return;
    let alive = true;
    void window.dkkf
      .call('auth.avatar')
      .then(() => {
        if (alive) void reload().catch(() => {});
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [s?.activeAccount]);
  const run = async <T,>(method: string, args?: unknown): Promise<T | undefined> => {
    setPending(true);
    try {
      const r = await window.dkkf.call<T>(method, args);
      await reload();
      return r;
    } catch (e) {
      setToast((e as Error).message);
      return undefined;
    } finally {
      setPending(false);
    }
  };
  if (!s)
    return (
      <div className="boot">
        <img className="brandmark brand-image" src={logo} alt={t('Dkkf Launcher 로고')} />
        <h1>Dkkf Launcher</h1>
        <p>{t(error) || t('보안 저장소를 준비하고 있습니다…')}</p>
      </div>
    );
  const selected = s.instances.find((i) => i.id === s.selected);
  const account = s.accounts.find((a) => a.id === s.activeAccount);
  return (
    <Context.Provider value={{ s, run, reload, toast: setToast, epoch, pending }}>
      <div className="app">
        <aside className="app-sidebar">
          <a className="brand" onClick={() => setPage('Home')}>
            <img className="brandmark brand-image" src={logo} alt={t('Dkkf Launcher 로고')} />
            <div>
              <b>
                Dkkf<span>Launcher</span>
              </b>
            </div>
          </a>
          <div className="navlabel">{t('작업 공간')}</div>
          <nav>
            {pages.map(([p, k], n) => (
              <React.Fragment key={p}>
                {n === 5 && <div className="navlabel">{t('관리')}</div>}
                <button className={page === p ? 'active' : ''} onClick={() => setPage(p)}>
                  <Icon name={p} />
                  <span>{t(k)}</span>
                  {page === p && <i />}
                </button>
              </React.Fragment>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="channel">
              <i className="dot" /> {s.settings.channel.toUpperCase()} <span>v{s.version}</span>
            </div>
            <button className="profile" onClick={() => setPage('Account')}>
              <div className="avatar">{account?.name.slice(0, 1).toUpperCase() || '?'}</div>
              <div>
                <b>{account?.name || t('계정 연결')}</b>
                <small>{account ? t('Microsoft 계정') : t('Microsoft 로그인 필요')}</small>
              </div>
              <span>↗</span>
            </button>
          </div>
        </aside>
        <div className="workspace">
          <header className="app-header">
            <div className="crumb">
              Dkkf Launcher <span>/</span> <b>{t(pageLabel(page))}</b>
            </div>
            <div className="header-right">
              {page === 'Home' && <AccountIdentity account={account} />}
              <span className={'status ' + (s.running ? 'cyan' : '')}>
                <i className="dot" />
                {s.running
                  ? t('게임 실행 중')
                  : s.busy
                    ? t('작업 중')
                    : account
                      ? t('실행 준비')
                      : t('로그인 필요')}
              </span>
              <button
                className="iconbutton"
                title={t('실행 로그')}
                onClick={() => setShowLogs(!showLogs)}
              >
                ⌘
              </button>
            </div>
          </header>
          <main key={page}>
            <div className="pageheading">
              <div>
                <div className="eyebrow">{t('나만의 마인크래프트')}</div>
                <h1>
                  {page === 'Home'
                    ? account
                      ? t('반가워요, {0}.', account.name)
                      : t('반가워요.')
                    : t(pageLabel(page))}
                </h1>
                <p>
                  {page === 'Home'
                    ? t('다음 모험을 시작할 준비가 되었나요?')
                    : t('{0} 관리', t(pageLabel(page)))}
                </p>
              </div>
              {page !== 'Settings' && page !== 'Account' && (
                <div className="instance-picker">
                  <small>{t('선택한 인스턴스')}</small>
                  <select
                    value={s.selected || ''}
                    onChange={(e) => void run('instances.select', e.target.value)}
                  >
                    <option value="" disabled>
                      {t('인스턴스 선택')}
                    </option>
                    {s.instances.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {page === 'Home' && <Home go={setPage} selected={selected} />}
            {page === 'Instances' && <Instances />}

            {page === 'Update Center' && <Updates />}
            {page === 'Settings' && <Settings />}
            {page === 'Account' && <Account />}
          </main>
          <footer>
            <div className="footer-status">
              <span>
                <i className="dot" /> Dkkf Launcher
              </span>
              <span>
                {s.running
                  ? t('게임 실행 중')
                  : s.busy
                    ? t('작업 진행 중')
                    : t('모험을 위한 나만의 공간')}
              </span>
            </div>
            <p className="product-disclaimer">
              NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR
              MICROSOFT.
            </p>
          </footer>
        </div>
      </div>
      {progress && (
        <div className="progress-dock">
          <div>
            <b>{t(progress.message)}</b>
            <button onClick={() => void run('task.cancel')}>{t('취소')}</button>
          </div>
          <progress
            max={progress.total || 1}
            value={progress.total ? progress.current : undefined}
          />
          <small>
            {progress.total
              ? Math.min(100, Math.floor((progress.current / progress.total) * 100)) + '%'
              : t('처리 중…')}
          </small>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <span>{t(toast)}</span>
          <button onClick={() => setToast('')}>×</button>
        </div>
      )}
      {showLogs && (
        <Modal title={t('실행 로그')} close={() => setShowLogs(false)}>
          <pre className="logs">{logs || t('아직 게임 실행 로그가 없습니다.')}</pre>
          <button onClick={() => void run('settings.data')}>{t('로그 폴더 열기')}</button>
        </Modal>
      )}
    </Context.Provider>
  );
}
function Empty({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  const t = useI18n();
  return (
    <div className="empty">
      <div className="empty-icon">◇</div>
      <h3>{title}</h3>
      <p>{body}</p>
      {children}
    </div>
  );
}
function Modal({
  title,
  close,
  children,
  wide = false,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const t = useI18n();
  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        className={'modal' + (wide ? ' wide' : '')}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button onClick={close} aria-label={t('닫기')}>
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Home({ go, selected }: { go: (p: string) => void; selected?: Instance }) {
  const t = useI18n();
  const { s, run, pending } = useApp();
  const [history, setHistory] = useState<any[]>([]);
  useEffect(() => {
    window.dkkf
      .call<any[]>('history')
      .then(setHistory)
      .catch(() => {});
  }, [s.running]);
  const recent = [...s.instances]
    .filter((i) => i.lastPlayed && Number.isFinite(Date.parse(i.lastPlayed)))
    .sort((a, b) => Date.parse(b.lastPlayed!) - Date.parse(a.lastPlayed!))[0];
  const heroInstance = recent ?? selected ?? s.instances[0];
  return (
    <>
      <section className="hero">
        <div className="hero-grid" />
        <div className="terrain">
          <div className="voxel v1" />
          <div className="voxel v2" />
          <div className="voxel v3" />
          <div className="orbit" />
        </div>
        <div className="hero-content">
          <div className="pill">
            {recent ? t('최근 플레이한 인스턴스') : t('선택한 인스턴스')} <i>✦</i>
          </div>
          <h2>
            <span>{heroInstance?.name || t('인스턴스 만들기')}</span>
          </h2>
          <p>
            {heroInstance
              ? t('이 인스턴스로 DKKF 서버에 접속하세요.')
              : t('첫 인스턴스를 만들고 DKKF 서버를 시작하세요.')}
          </p>
          <div className="hero-actions">
            <button
              className="primary large"
              disabled={pending || s.busy || !!s.running}
              onClick={() =>
                heroInstance
                  ? void run(
                      heroInstance.installed ? 'game.launch' : 'game.install',
                      heroInstance.id,
                    )
                  : go('Instances')
              }
            >
              <Icon name="play" size={18} />
              {heroInstance
                ? heroInstance.installed
                  ? t('게임 실행')
                  : t('게임 설치')
                : t('인스턴스 만들기')}
            </button>
            <button className="glass" onClick={() => go('Instances')}>
              {t('인스턴스 관리 ↗')}
            </button>
          </div>
          <div className="hero-meta">
            <i className="dot" />
            {heroInstance
              ? heroInstance.version + ' · ' + heroInstance.loader.toUpperCase() + ' · '
              : ''}
            {heroInstance
              ? heroInstance.limitRam === false
                ? t('JVM 자동 관리')
                : heroInstance.ram / 1024 + ' GB RAM'
              : t('인스턴스를 만든 뒤 Microsoft 계정을 연결하세요.')}
          </div>
        </div>
        <span className="hero-corner">MINECRAFT 26.3 · FABRIC</span>
      </section>
      <div className="stats">
        <Stat
          label={t('내 인스턴스')}
          value={String(s.instances.length)}
          sub={t('독립된 게임 환경')}
          icon="Instances"
        />
        <Stat
          label={t('선택한 로더')}
          value={selected?.loader.toUpperCase() || '—'}
          sub={selected?.loaderVersion || t('선택된 로더 없음')}
          icon="Mod Hub"
        />
        <Stat
          label={t('메모리')}
          value={
            selected ? (selected.limitRam === false ? t('자동') : selected.ram / 1024 + ' GB') : '—'
          }
          sub={t('인스턴스별 메모리 할당')}
          icon="Settings"
        />
      </div>
      <div className="twocol">
        <section className="panel">
          <div className="sectiontitle">
            <h2>{t('바로 이어서 플레이')}</h2>
            <button className="textbutton" onClick={() => go('Instances')}>
              {t('모두 보기 ↗')}
            </button>
          </div>
          {s.instances.length ? (
            s.instances.slice(0, 3).map((i) => (
              <div className="instance-row" key={i.id}>
                <div className={'game-icon ' + i.loader}>
                  <Icon name="Mod Hub" size={25} />
                </div>
                <div>
                  <b>{i.name}</b>
                  <small>
                    {i.version} · {i.loader}
                  </small>
                </div>
                <span className="tag">{i.installed ? 'INSTALLED' : 'NEW'}</span>
                <button
                  className="square"
                  disabled={s.busy || !!s.running || pending}
                  title={i.installed ? t('실행') : t('설치')}
                  onClick={() => void run(i.installed ? 'game.launch' : 'game.install', i.id)}
                >
                  ▶
                </button>
              </div>
            ))
          ) : (
            <Empty
              title={t('첫 번째 세계를 준비하세요')}
              body={t('Minecraft 버전과 로더를 자유롭게 선택할 수 있어요.')}
            />
          )}
        </section>
        <section className="panel discover">
          <span className="eyebrow">{t('플레이에 나만의 설정을')}</span>
          <h2>{t('플레이에 가능성을 더하다.')}</h2>
          <p>
            {t('Modrinth와 CurseForge에서')}
            <br />
            {t('내 버전에 맞는 모드를 찾아보세요.')}
          </p>
          <div className="mod-shapes">
            <span>◈</span>
            <span>⌘</span>
            <span>⬡</span>
          </div>
          <button className="secondary" onClick={() => go('Instances')}>
            {t('인스턴스 모드 관리 ↗')}
          </button>
        </section>
      </div>
      <section className="panel">
        <div className="sectiontitle">
          <h2>{t('최근 플레이 기록')}</h2>
          <span className="muted">{t('최근 실행 기록')}</span>
        </div>
        {history.length ? (
          history.slice(0, 5).map((h, n) => (
            <div className="history" key={n}>
              <b>{s.instances.find((i) => i.id === h[0])?.name || h[0]}</b>
              <span>{new Date(h[1]).toLocaleString(t.locale)}</span>
              <span>
                {t('종료 코드 ')}
                {h[2] ?? '—'}
              </span>
            </div>
          ))
        ) : (
          <p className="muted">{t('실제로 실행을 완료한 게임의 기록이 여기에 표시됩니다.')}</p>
        )}
      </section>
      <div className="notice-inline">
        {t(
          'DKKF 서버 · dkkf.mc-hosting.xyz 자동 접속 · Fabric 26.3. 비공식 Minecraft 런처이며 Mojang 또는 Microsoft와 제휴하지 않습니다.',
        )}
      </div>
    </>
  );
}
function Stat({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon: string;
}) {
  const t = useI18n();
  return (
    <div className="stat">
      <div>
        <small>{t(label)}</small>
        <h2>{value}</h2>
        <p>{sub}</p>
      </div>
      <div className="stat-icon">
        <Icon name={icon} size={25} />
      </div>
    </div>
  );
}
function Instances() {
  const t = useI18n();
  const { s, run, pending } = useApp();
  const [create, setCreate] = useState(false);
  const [edit, setEdit] = useState<Instance>();
  const [query, setQuery] = useState('');
  if (edit) return <EditInstance i={edit} close={() => setEdit(undefined)} />;
  return (
    <>
      <div className="toolbar">
        <span className="muted">
          {s.instances.length}
          {t('개의 독립된 환경')}
        </span>
        <input
          className="instance-search"
          aria-label={t('인스턴스 검색')}
          placeholder={t('인스턴스 검색…')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="primary" onClick={() => setCreate(true)}>
          {t('＋ 새 인스턴스')}
        </button>
      </div>
      {!s.instances.length ? (
        <Empty
          title={t('모험의 시작점을 만드세요')}
          body={t('공식 Minecraft 파일로 버전마다 독립된 인스턴스를 설치합니다.')}
        >
          <button onClick={() => setCreate(true)}>{t('인스턴스 만들기')}</button>
        </Empty>
      ) : (
        <div className="cards">
          {s.instances
            .filter((i) =>
              (i.name + ' ' + i.version + ' ' + i.loader)
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((i) => (
              <section
                className={'panel instance-card ' + (i.id === s.selected ? 'selected' : '')}
                key={i.id}
              >
                <div className="card-top">
                  <div className={'game-icon ' + i.loader}>
                    <img className="instance-logo" src={logo} alt={t('인스턴스')} />
                  </div>
                  <span className="tag">{i.loader.toUpperCase()}</span>
                </div>
                <h2>{i.name}</h2>
                <p>Minecraft {i.version}</p>
                {i.installationError && <p className="error">{t(i.installationError)}</p>}
                <div className="specs">
                  <span>
                    {i.limitRam === false ? t('RAM 자동 관리') : i.ram / 1024 + ' GB RAM'}
                  </span>
                  <span>
                    {i.installed
                      ? t('설치됨')
                      : i.installationError
                        ? t('설치 실패')
                        : t('설치 중')}
                  </span>
                </div>
                <div className="button-row">
                  <button
                    className="primary"
                    disabled={s.busy || pending || !!s.running}
                    onClick={() => void run(i.installed ? 'game.launch' : 'game.install', i.id)}
                  >
                    {i.installed ? t('▶ 실행') : t('설치 재시도')}
                  </button>
                  <button
                    disabled={s.selected === i.id}
                    onClick={() => void run('instances.select', i.id)}
                  >
                    {s.selected === i.id ? t('선택됨') : t('선택')}
                  </button>
                </div>
                <div className="card-tools">
                  <button disabled={s.busy || !!s.running} onClick={() => setEdit(i)}>
                    {t('편집')}
                  </button>
                  <button
                    disabled={s.busy || !!s.running}
                    onClick={() => void run('instances.clone', i.id)}
                  >
                    {t('복제')}
                  </button>
                  <button onClick={() => void run('instances.folder', i.id)}>{t('폴더')}</button>
                  <button
                    className="danger"
                    disabled={s.busy || !!s.running}
                    onClick={() => void run('instances.delete', i.id)}
                  >
                    {t('삭제')}
                  </button>
                </div>
              </section>
            ))}
        </div>
      )}
      {create && <CreateInstance close={() => setCreate(false)} />}{' '}
    </>
  );
}
function CreateInstance({ close }: { close: () => void }) {
  const t = useI18n();
  const { s, run, pending, toast } = useApp();
  const [mode, setMode] = useState<'direct' | 'import' | undefined>();
  const [limitRam, setLimitRam] = useState(s.settings.limitRam);
  const [defaultContent, setDefaultContent] = useState(true);
  const [name, setName] = useState('나의 Minecraft');
  const [versions, setVersions] = useState<any[]>([]);
  const [version, setVersion] = useState('');
  const [snap, setSnap] = useState(false);
  const [loader, setLoader] = useState<Loader>('fabric');
  const [loaders, setLoaders] = useState<any[]>([]);
  const [lv, setLV] = useState('');
  const [ram, setRam] = useState(s.settings.ram);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  useEffect(() => {
    window.dkkf
      .call('versions')
      .then((d) => {
        setVersions(d.versions);
        setVersion(
          d.versions.some((v: any) => v.id === target.minecraft)
            ? target.minecraft
            : d.latest.release,
        );
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    setLoaders([]);
    setLV('');
    setErr('');
    if (!version || loader === 'vanilla') {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    window.dkkf
      .call('loaders', { version, loader })
      .then((d) => {
        if (alive) {
          setLoaders(d);
          setLV(
            (version === target.minecraft && loader === 'fabric'
              ? d.find((v: any) => v.version === target.loaderVersion)?.version
              : undefined) ||
              d.find((v: any) => v.stable)?.version ||
              d[0]?.version ||
              '',
          );
          if (!d.length)
            setErr(
              `Minecraft ${version}에 맞는 ${loader} 로더가 없습니다. 다른 버전 또는 로더를 선택하세요.`,
            );
        }
      })
      .catch((e) => alive && setErr(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [version, loader]);
  return (
    <Modal title={t('새 인스턴스')} close={close}>
      {!mode ? (
        <div className="creation-options">
          <button className="creation-option" onClick={() => setMode('direct')}>
            <b>{t('직접 만들기')}</b>
            <span>{t('게임 버전과 로더를 선택하면 자동 설치됩니다.')}</span>
          </button>
          <button
            className="creation-option"
            disabled={pending}
            onClick={async () => {
              setMode('import');
              const result = await run('packs.import');
              if (result) close();
              else setMode(undefined);
            }}
          >
            <b>{t('업로드하기')}</b>
            <span>{t('26.3 Fabric 모드팩 가져오기 · 서버 필수 모드 자동 추가')}</span>
          </button>
        </div>
      ) : mode === 'import' ? (
        <p>{t('모드팩을 가져오고 게임을 자동 설치하고 있습니다…')}</p>
      ) : (
        <>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const i = await run('instances.create', {
                name,
                version,
                loader,
                loaderVersion: lv,
                ram,
                limitRam,
                defaultContent,
              });
              if (i) close();
            }}
          >
            <label>
              {t('이름')}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={70}
                required
              />
            </label>
            <label className="check">
              <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
              {t('스냅샷·과거 버전 포함')}
            </label>
            <p className="hint">
              {t(
                'Fabric API · Xaero’s Minimap · Dkkf Loot를 자동 준비합니다. DKKF HUD·Locator Bar는 제외하며 dkkf.mc-hosting.xyz로 접속합니다.',
              )}
            </p>
            <div className="formgrid">
              <label>
                {t('Minecraft 버전')}
                <select
                  aria-label={t('Minecraft 버전')}
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  required
                >
                  {versions
                    .filter((v) => v.id === target.minecraft)
                    .map((v) => (
                      <option key={v.id}>{v.id}</option>
                    ))}
                </select>
              </label>
              <label>
                {t('모드 로더')}
                <select
                  aria-label={t('모드 로더')}
                  value={loader}
                  onChange={(e) => setLoader(e.target.value as Loader)}
                >
                  {['fabric'].map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
            </div>
            {loader !== 'vanilla' && (
              <label>
                {t('호환 로더 버전')}
                <select value={lv} onChange={(e) => setLV(e.target.value)} required>
                  <option value="">{loading ? t('조회 중…') : t('버전 선택')}</option>
                  {loaders.map((l) => (
                    <option key={l.version}>{l.version}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="check">
              <input
                type="checkbox"
                checked={limitRam}
                onChange={(e) => setLimitRam(e.target.checked)}
              />
              {t('RAM 상한 직접 설정')}
            </label>
            <label>
              RAM: {limitRam ? (ram / 1024).toFixed(1) + ' GB' : t('JVM 자동 관리')}
              <input
                type="range"
                min="1024"
                max="32768"
                step="512"
                value={ram}
                disabled={!limitRam}
                onChange={(e) => setRam(Number(e.target.value))}
              />
            </label>
            {err && (
              <div role="alert">
                <p className="error">{t(err)}</p>
                {(version !== target.minecraft || loader !== 'fabric') && (
                  <button
                    type="button"
                    onClick={() => {
                      setVersion(target.minecraft);
                      setLoader('fabric');
                    }}
                  >
                    {target.minecraft}
                    {t(' Fabric 선택')}
                  </button>
                )}
              </div>
            )}
            <p className="hint">
              {t(
                '생성 후 설치 버튼으로 공식 게임 파일을 다운로드합니다. 버전에 맞는 Java는 Settings에서 지정하세요.',
              )}
            </p>
            <button
              className="primary full"
              disabled={pending || loading || !!err || !version || (loader !== 'vanilla' && !lv)}
            >
              {pending ? t('생성 및 자동 설치 중…') : t('생성 및 자동 설치')}
            </button>
          </form>
        </>
      )}
    </Modal>
  );
}
function EditInstance({ i, close }: { i: Instance; close: () => void }) {
  const t = useI18n();
  const { s, run, pending, toast, epoch } = useApp();
  const [name, setName] = useState(i.name),
    [ram, setRam] = useState(i.ram),
    [limitRam, setLimitRam] = useState(i.limitRam !== false);
  const [defaultContent, setDefaultContent] = useState(i.defaultContent !== false);
  const [tab, setTab] = useState('개요');
  const current = s.instances.find((item) => item.id === i.id) || i;
  const disabled = pending || s.busy || !!s.running;
  return (
    <section className="instance-workspace">
      <button className="textbutton" onClick={close}>
        {t('← 모든 인스턴스')}
      </button>
      <header className="workspace-header">
        <img src={logo} alt="" />
        <div>
          <span className="eyebrow">INSTANCE LIBRARY</span>
          <h1>{current.name}</h1>
          <p>
            Minecraft {current.version}{' '}
            <span className="tag">
              {current.loader.toUpperCase()} {current.loaderVersion}
            </span>
          </p>
        </div>
        <div className="button-row">
          <button onClick={() => void run('instances.folder', current.id)}>{t('폴더 열기')}</button>
          <button
            className="primary"
            disabled={disabled}
            onClick={() => void run(current.installed ? 'game.launch' : 'game.install', current.id)}
          >
            {current.installed ? t('▶ 플레이') : t('설치 재시도')}
          </button>
        </div>
      </header>
      <div className="workspace-layout">
        <aside className="workspace-nav" role="tablist" aria-label={t('인스턴스 메뉴')}>
          {['개요', '콘텐츠', '월드', '모드팩', '설정'].map((label) => (
            <button
              key={label}
              role="tab"
              aria-selected={tab === label}
              onClick={() => setTab(label)}
            >
              {t(label)}
            </button>
          ))}
        </aside>
        <div className="workspace-main">
          {tab === '개요' && (
            <>
              <div className="workspace-stats">
                <div>
                  <small>{t('게임 버전')}</small>
                  <b>{current.version}</b>
                </div>
                <div>
                  <small>{t('메모리')}</small>
                  <b>{current.limitRam === false ? t('자동') : current.ram / 1024 + ' GB'}</b>
                </div>
                <div>
                  <small>{t('마지막 플레이')}</small>
                  <b>
                    {current.lastPlayed
                      ? new Date(current.lastPlayed).toLocaleDateString(t.locale)
                      : t('아직 플레이하지 않음')}
                  </b>
                </div>
              </div>
              {current.installationError && <p className="error">{t(current.installationError)}</p>}
              <PresetOverview instance={current} run={run} epoch={epoch} disabled={disabled} />
            </>
          )}
          {tab === '설정' && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const saved = await run('instances.edit', {
                  id: i.id,
                  name,
                  ram,
                  limitRam,
                  defaultContent,
                });
                if (saved) toast('인스턴스 설정을 저장했습니다.');
              }}
            >
              <h2>{t('인스턴스 설정')}</h2>
              <label>
                {t('이름')}
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={70}
                />
              </label>
              <p className="muted">
                Minecraft {current.version} · {current.loader} ·{' '}
                {current.installed ? t('설치 완료') : t('설치 준비 필요')}
              </p>
              <p className="hint">
                {t(
                  '서버 필수 모드와 Dkkf Loot·Xaero 미니맵을 자동 준비합니다. DKKF HUD는 제외합니다.',
                )}
              </p>
              <label className="check">
                <input
                  type="checkbox"
                  checked={limitRam}
                  onChange={(e) => setLimitRam(e.target.checked)}
                />
                {t('RAM 상한 직접 설정')}
              </label>
              <label>
                RAM: {limitRam ? ram / 1024 + ' GB' : t('JVM 자동 관리')}
                <input
                  type="range"
                  min="1024"
                  max="32768"
                  step="512"
                  disabled={!limitRam}
                  value={ram}
                  onChange={(e) => setRam(Number(e.target.value))}
                />
              </label>
              <button className="primary" disabled={disabled}>
                {t('설정 저장')}
              </button>
            </form>
          )}
          {tab === '콘텐츠' && <WorkspaceContent instance={current} />}
          {tab === '월드' && (
            <LocalContent
              instance={current}
              kind="world"
              run={run}
              epoch={epoch}
              disabled={disabled}
            />
          )}
          {tab === '모드팩' && <Modpacks instance={current} />}
        </div>
      </div>
    </section>
  );
}
function WorkspaceContent({ instance }: { instance: Instance }) {
  const t = useI18n();
  const { s, run, epoch, pending } = useApp();
  const [kind, setKind] = useState<'mod' | 'resourcepack' | 'shader'>('mod');
  const [browse, setBrowse] = useState(false);
  return (
    <>
      <div className="toolbar">
        <div className="content-kind-tabs" role="tablist" aria-label={t('콘텐츠 유형')}>
          {(
            [
              ['mod', '모드'],
              ['resourcepack', '리소스팩'],
              ['shader', '쉐이더팩'],
            ] as const
          ).map(([key, label]) => (
            <button role="tab" aria-selected={kind === key} key={key} onClick={() => setKind(key)}>
              {t(label)}
            </button>
          ))}
        </div>
        <button className={browse ? '' : 'primary'} onClick={() => setBrowse(!browse)}>
          {browse ? t('← 설치된 콘텐츠') : t('＋ 콘텐츠 추가')}
        </button>
      </div>
      {browse ? (
        <Hub key={kind} selected={instance} kind={kind} />
      ) : kind === 'mod' ? (
        <MyMods selected={instance} />
      ) : (
        <LocalContent
          instance={instance}
          kind={kind}
          run={run}
          epoch={epoch}
          disabled={pending || s.busy || !!s.running}
        />
      )}
    </>
  );
}
type Hit = {
  id: string;
  title: string;
  description: string;
  author: string;
  downloads: number;
  icon?: string;
  provider: string;
};
function Hub({
  selected,
  kind = 'mod',
}: {
  selected?: Instance;
  kind?: 'mod' | 'resourcepack' | 'shader';
}) {
  const t = useI18n();
  const { epoch } = useApp();
  const [installedMods, setInstalledMods] = useState<
    {
      source?: Mod['source'];
      enabled?: boolean;
      version?: string;
    }[]
  >([]);
  const [installedError, setInstalledError] = useState('');
  useEffect(() => {
    let alive = true;
    setInstalledMods([]);
    setInstalledError('');
    if (selected)
      void window.dkkf
        .call<Mod[]>(
          kind === 'mod' ? 'mods.list' : 'content.list',
          kind === 'mod' ? selected.id : { id: selected.id, kind },
        )
        .then((mods) => {
          if (alive) setInstalledMods(mods);
        })
        .catch(() => {
          if (alive) setInstalledError('설치된 모드 상태를 불러오지 못했습니다.');
        });
    return () => {
      alive = false;
    };
  }, [selected?.id, kind, epoch]);
  const installedMod = (hit: Hit) =>
    installedMods.find(
      (mod) => mod.source?.provider === hit.provider && String(mod.source.project) === hit.id,
    );
  const [provider, setProvider] = useState('modrinth');
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [pageNumber, setPageNumber] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [sort, setSort] = useState('relevance');
  const [category, setCategory] = useState('');
  const [hits, setHits] = useState<Hit[]>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<Hit>();
  const search = () => {
    setSubmittedQuery(query);
    setPageNumber(0);
    setRefresh((n) => n + 1);
  };
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    void window.dkkf
      .call(kind === 'mod' ? 'mods.search' : 'content.search', {
        kind,
        provider,
        query: submittedQuery,
        sort,
        category,
        instance: selected?.id,
        offset: pageNumber * 30,
      })
      .then((d) => {
        if (!alive) return;
        setHits(d.hits);
        setTotal(d.total);
        setHasMore(d.hasMore);
      })
      .catch((e) => {
        if (alive) {
          setError(e.message);
          setHasMore(false);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [provider, sort, selected?.id, category, kind, pageNumber, submittedQuery, refresh]);
  return (
    <>
      <div className="platforms">
        <button
          className={provider === 'modrinth' ? 'chosen' : ''}
          onClick={() => setProvider('modrinth')}
        >
          <span className="platform-dot mr" />
          Modrinth
        </button>
        {kind === 'mod' && (
          <button
            className={provider === 'curseforge' ? 'chosen' : ''}
            onClick={() => setProvider('curseforge')}
          >
            <span className="platform-dot cf" />
            CurseForge
          </button>
        )}
        <span className="muted">
          {provider === 'curseforge'
            ? t('Overwolf 승인 대기 · API 키 필요')
            : t('공식 API · 원본 파일 검증')}
        </span>
      </div>
      <form
        className="searchbar"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <span>⌕</span>
        <input
          aria-label={t('콘텐츠 검색')}
          placeholder={
            kind === 'mod'
              ? t('모드 검색…')
              : kind === 'resourcepack'
                ? t('리소스팩 검색…')
                : t('쉐이더팩 검색…')
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="primary" disabled={loading}>
          {t('검색')}
        </button>
      </form>
      <div className="toolbar">
        <div className="chips">
          <span className="tag">{selected?.version || t('모든 버전')}</span>
          <span className="tag">{selected?.loader.toUpperCase() || t('모든 로더')}</span>
          <span className="muted">
            {hits?.length ?? 0}
            {t('개 표시')}
          </span>
        </div>
        <div className="button-row">
          {kind === 'mod' && provider === 'modrinth' && (
            <select
              aria-label={t('카테고리')}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">{t('모든 카테고리')}</option>
              {[
                'optimization',
                'utility',
                'adventure',
                'technology',
                'magic',
                'decoration',
                'worldgen',
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
          <select aria-label={t('정렬')} value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="relevance">{t('인기순')}</option>
            <option value="downloads">{t('다운로드순')}</option>
            <option value="newest">{t('최신순')}</option>
          </select>
        </div>
      </div>
      {error ? (
        <Empty title={t('검색을 완료하지 못했습니다')} body={t(error)}>
          <button onClick={() => void search()}>{t('다시 시도')}</button>
        </Empty>
      ) : loading ? (
        <div className="cards">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div className="skeleton" key={n} />
          ))}
        </div>
      ) : hits?.length ? (
        <div className="cards modcards">
          {hits.map((h) => {
            const installed = installedMod(h);
            return (
              <button
                className={`panel modcard${installed ? ' modcard-installed' : ''}`}
                key={h.id}
                onClick={() => setDetail(h)}
              >
                <div className="card-top">
                  {h.icon ? (
                    <img src={h.icon} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="game-icon">
                      <Icon name="Mod Hub" size={30} />
                    </div>
                  )}
                  <span className={`tag${installed ? ' installed-badge' : ''}`}>
                    {installed
                      ? installed.enabled
                        ? t('✓ 설치됨')
                        : t('✓ 설치됨 · 비활성')
                      : h.provider}
                  </span>
                </div>
                <h3>{h.title}</h3>
                <small>by {h.author}</small>
                <p>{h.description}</p>
                <div className="mod-bottom">
                  <span>
                    ↓ {Intl.NumberFormat('en', { notation: 'compact' }).format(h.downloads)}
                  </span>
                  <b>{t('자세히 ↗')}</b>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <Empty
          title={t('검색 결과가 없습니다')}
          body={t('다른 검색어나 인스턴스 버전을 선택하세요.')}
        />
      )}
      <nav className="pagination" aria-label={t('콘텐츠 검색 페이지')}>
        <button disabled={loading || pageNumber === 0} onClick={() => setPageNumber((n) => n - 1)}>
          {t('← 이전 페이지')}
        </button>
        <span>
          {t('페이지 ')}
          {pageNumber + 1} / {Math.max(1, Math.ceil(total / 30))}
        </span>
        <button disabled={loading || !hasMore} onClick={() => setPageNumber((n) => n + 1)}>
          {t('다음 페이지 →')}
        </button>
      </nav>
      {installedError && <p className="error">{t(installedError)}</p>}
      {detail && (
        <ModDetail
          hit={detail}
          selected={selected}
          installed={installedMod(detail)}
          kind={kind}
          close={() => setDetail(undefined)}
        />
      )}
    </>
  );
}
function ModDetail({
  hit,
  selected,
  installed,
  close,
  kind = 'mod',
}: {
  hit: Hit;
  selected?: Instance;
  installed?: {
    source?: Mod['source'];
    version?: string;
    enabled?: boolean;
  };
  close: () => void;
  kind?: 'mod' | 'resourcepack' | 'shader';
}) {
  const t = useI18n();
  const { run, s, pending } = useApp();
  const [d, setD] = useState<any>();
  const [v, setV] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!selected) return;
    window.dkkf
      .call(kind === 'mod' ? 'mods.detail' : 'content.detail', {
        provider: hit.provider,
        project: hit.id,
        instance: selected.id,
        kind,
      })
      .then((d) => {
        setD(d);
        setV(d.versions[0]?.id || '');
      })
      .catch((e) => setErr(e.message));
  }, [hit.id, selected?.id, kind]);
  return (
    <Modal title={hit.title} close={close}>
      {installed && (
        <p className="installed-badge">
          {t('✓ 설치됨 · ')}
          {installed.version}
          {!installed.enabled && t(' · 비활성')}
        </p>
      )}
      <p>{hit.description}</p>
      <p className="muted">
        {t('제작자 · ')}
        {hit.author}
      </p>
      {!selected ? (
        <p className="error">{t('호환성을 확인하려면 인스턴스를 선택하세요.')}</p>
      ) : err ? (
        <p className="error">{t(err)}</p>
      ) : !d ? (
        <p>{t('호환 버전 조회 중…')}</p>
      ) : (
        <>
          <p>
            {t('라이선스 · ')}
            {d.license || t('프로젝트 페이지에서 확인')}
          </p>
          <button className="textbutton" onClick={() => void run('external', d.url)}>
            {t('공식 프로젝트 페이지 ↗')}
          </button>
          <label>
            {t('설치할 버전')}
            <select value={v} onChange={(e) => setV(e.target.value)}>
              {!d.versions.length && <option value="">{t('호환 버전 없음')}</option>}
              {d.versions.map((x: any) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <div className="hint">
            {kind === 'mod'
              ? t('필수 의존성을 함께 설치하며 원본 파일 해시를 검증합니다.')
              : t(
                  '원본 ZIP 파일의 해시와 게임 버전을 검증합니다. 설치 후 콘텐츠 목록에서 활성화할 수 있습니다.',
                )}
          </div>
          <button
            className="primary full"
            disabled={!v || s.busy || !!s.running || pending || installed?.source?.version === v}
            onClick={async () => {
              const r = await run(kind === 'mod' ? 'mods.install' : 'content.install', {
                id: selected!.id,
                provider: hit.provider,
                project: hit.id,
                version: v,
                kind,
              });
              if (r) close();
            }}
          >
            {installed?.source?.version === v
              ? t('✓ 이미 설치된 버전')
              : kind === 'mod'
                ? t('↓ 모드 설치')
                : kind === 'resourcepack'
                  ? t('↓ 리소스팩 설치')
                  : t('↓ 쉐이더팩 설치')}
          </button>
        </>
      )}
    </Modal>
  );
}
function MyMods({ selected }: { selected?: Instance }) {
  const t = useI18n();
  const { s, run, epoch, pending, toast } = useApp();
  const [mods, setMods] = useState<Mod[]>([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [backups, setBackups] = useState<string[]>();
  const [updates, setUpdates] = useState<any[]>();
  useEffect(() => {
    setError('');
    if (selected)
      window.dkkf
        .call<Mod[]>('mods.list', selected.id)
        .then(setMods)
        .catch((e) => setError(e.message));
  }, [selected?.id, epoch]);
  if (!selected)
    return (
      <Empty
        title={t('\uC778\uC2A4\uD134\uC2A4\uB97C \uC120\uD0DD\uD558\uC138\uC694')}
        body={t(
          '\uC778\uC2A4\uD134\uC2A4\uB9C8\uB2E4 \uBAA8\uB4DC\uB97C \uB3C5\uB9BD\uC801\uC73C\uB85C \uAD00\uB9AC\uD569\uB2C8\uB2E4.',
        )}
      />
    );
  const disabled = s.busy || !!s.running || pending;
  const normalized = filter.trim().toLocaleLowerCase();
  const visible = mods.filter((m) =>
    [m.name, m.id, m.file, m.version, ...m.authors]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalized),
  );
  return (
    <>
      <div className="toolbar">
        <span className="muted">
          {mods.filter((m) => m.enabled).length}
          {t(' 활성 · ')}
          {mods.length}
          {t('개 파일')}
        </span>
        <div className="button-row">
          <button
            disabled={disabled}
            onClick={async () => {
              const report = await run('mods.dependencies', selected.id);
              if (report) {
                setError([...report.unresolved, ...report.warnings].join(' / '));
                toast('필수 의존성 확인 완료');
              }
            }}
          >
            {t('의존성 확인 / 복구')}
          </button>
          <button
            disabled={disabled}
            onClick={async () => {
              const r = await run('mods.updates', selected.id);
              if (r) setUpdates(r);
            }}
          >
            {t('업데이트 확인')}
          </button>
          <button
            disabled={disabled}
            onClick={async () => {
              const name = await run('mods.backup', selected.id);
              if (name) toast('백업 완료: ' + name);
            }}
          >
            {t('백업')}
          </button>
          <button
            disabled={disabled}
            onClick={async () => setBackups(await run('mods.backups', selected.id))}
          >
            {t('복원')}
          </button>
          <button
            className="primary"
            disabled={disabled}
            onClick={() => void run('mods.import', selected.id)}
          >
            {t('＋ JAR 가져오기')}
          </button>
        </div>
      </div>
      <div className="notice-inline">
        {t(
          'JAR 파일은 신뢰할 수 있는 제작자에게서 받으세요. 누락 의존성·동일 ID/해시 중복을 표시하며, 버전 범위 충돌의 완전한 분석은 지원하지 않습니다.',
        )}
      </div>
      {error && <p className="error">{t(error)}</p>}
      <div className="searchbar">
        <input
          aria-label={t('설치된 모드 검색')}
          placeholder={t('모드 이름, 파일명, 제작자, 버전으로 검색…')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button onClick={() => setFilter('')}>{t('검색 지우기')}</button>
      </div>
      {visible.length ? (
        <div className="panel tablepanel">
          <table>
            <thead>
              <tr>
                <th>{t('모드')}</th>
                <th>{t('버전 / 제작자')}</th>
                <th>{t('검사')}</th>
                <th>{t('상태')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((m) => (
                <tr key={m.file}>
                  <td>
                    <b>{m.name}</b>
                    <small>{m.file}</small>
                  </td>
                  <td>
                    {m.version}
                    <small>{m.authors.join(', ') || t('알 수 없음')}</small>
                  </td>
                  <td>
                    {m.warnings.length ? (
                      <span className="warning" title={m.warnings.join('\n')}>
                        {t(m.warnings.join(' · '))}
                      </span>
                    ) : (
                      <span className="muted">{t('기본 검사 통과')}</span>
                    )}
                  </td>
                  <td>
                    <button
                      className={'toggle ' + (m.enabled ? 'on' : '')}
                      aria-label={m.enabled ? t('비활성화') : t('활성화')}
                      disabled={disabled}
                      onClick={() => void run('mods.toggle', { id: selected.id, file: m.file })}
                    >
                      <i />
                    </button>
                  </td>
                  <td>
                    <button
                      className="danger"
                      disabled={disabled}
                      onClick={() => void run('mods.remove', { id: selected.id, file: m.file })}
                    >
                      {t('삭제')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title={t('아직 설치된 모드가 없습니다')}
          body={t('Mod Hub에서 검색하거나 로컬 JAR를 가져오세요.')}
        />
      )}
      {backups && (
        <Modal title={t('모드 백업 복원')} close={() => setBackups(undefined)}>
          {backups.length ? (
            backups.map((b) => (
              <button
                className="backup-item"
                key={b}
                disabled={disabled}
                onClick={async () => {
                  await run('mods.restore', { id: selected.id, name: b });
                  setBackups(undefined);
                }}
              >
                {b} ↶
              </button>
            ))
          ) : (
            <p>{t('백업이 없습니다.')}</p>
          )}
        </Modal>
      )}
      {updates && (
        <Modal title={t('모드 업데이트')} close={() => setUpdates(undefined)}>
          {updates.length ? (
            updates.map((u) => (
              <div className="instance-row" key={u.file}>
                <div>
                  <b>{u.name}</b>
                  <small>{u.latest.name}</small>
                </div>
                <button
                  disabled={disabled}
                  onClick={() =>
                    void run('mods.install', {
                      id: selected.id,
                      provider: u.source.provider,
                      project: u.source.project,
                      version: u.latest.id,
                    })
                  }
                >
                  {t('업데이트')}
                </button>
              </div>
            ))
          ) : (
            <p>{t('공식 플랫폼에서 더 새로운 호환 버전을 찾지 못했습니다.')}</p>
          )}
        </Modal>
      )}
    </>
  );
}
function Modpacks({
  instance,
}: {
  instance?: Instance;
} = {}) {
  const t = useI18n();
  const { s, run, pending } = useApp();
  const items = instance ? [instance] : s.instances.filter((i) => s.packs.includes(i.id));
  const disabled = s.busy || !!s.running || pending;
  return (
    <>
      <div className="toolbar">
        <span className="muted">{t('JAR를 재배포하지 않는 플랫폼 참조 방식')}</span>
        <div className="button-row">
          <button
            disabled={!s.selected || disabled}
            onClick={() => void run('packs.mark', s.selected)}
          >
            {t('현재 인스턴스를 모드팩으로 등록')}
          </button>
          <button className="primary" disabled={disabled} onClick={() => void run('packs.import')}>
            {t('↓ 모드팩 가져오기')}
          </button>
        </div>
      </div>
      <div className="notice-inline">
        {t(
          'MRPACK 및 CurseForge ZIP을 새 인스턴스로 가져옵니다. 내보내기는 선택한 플랫폼에서 출처가 확인된 모드만 지원합니다. 설정·월드·개인 파일은 공유 파일에 포함하지 않습니다.',
        )}
      </div>
      {items.length ? (
        <div className="cards">
          {items.map((i) => (
            <section className="panel instance-card" key={i.id}>
              <Icon name="Modpacks" size={36} />
              <h2>{i.name}</h2>
              <p>
                {i.version} · {i.loader}
              </p>
              <div className="button-row">
                <button
                  disabled={disabled}
                  onClick={() => void run('packs.export', { id: i.id, format: 'mrpack' })}
                >
                  {t('MRPACK 내보내기')}
                </button>
                <button
                  disabled={disabled}
                  onClick={() => void run('packs.export', { id: i.id, format: 'curseforge' })}
                >
                  CF ZIP
                </button>
              </div>
              <div className="card-tools">
                <button onClick={() => void run('instances.select', i.id)}>{t('선택')}</button>
                <button disabled={disabled} onClick={() => void run('instances.clone', i.id)}>
                  {t('복제')}
                </button>
                <button
                  className="danger"
                  disabled={disabled}
                  onClick={() => void run('instances.delete', i.id)}
                >
                  {t('삭제')}
                </button>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Empty
          title={t('나만의 모드팩을 구성하세요')}
          body={t('현재 인스턴스를 등록하거나 MRPACK / CurseForge ZIP을 가져오세요.')}
        />
      )}
    </>
  );
}
function Updates() {
  const t = useI18n();
  const { run, s, pending } = useApp();
  const status = s.update;
  const disabled = pending || s.busy || !!s.running;
  return (
    <>
      <section className="panel update-hero">
        <div className="update-symbol">
          <Icon name="Update Center" size={58} />
        </div>
        <div>
          <span className="eyebrow">{t('안전한 런처 업데이트')}</span>
          <h2>
            Dkkf Launcher <span className="cyan">v{s.version}</span>
          </h2>
          <p>
            {t('채널: ')}
            {s.settings.channel}
            {t(' · 자동 업데이트 ')}
            {s.settings.autoUpdate ? t('활성화 (5분 간격)') : t('비활성화')}
          </p>
          <p>
            {t(
              '새 버전을 자동 다운로드합니다. 런처를 닫거나 아래 설치 버튼을 누르면 업데이트 설치 창이 열립니다.',
            )}
          </p>
          <button className="primary" disabled={disabled} onClick={() => void run('update.check')}>
            {t('업데이트 확인')}
          </button>
        </div>
      </section>
      {status && (
        <section className="panel">
          <h2>
            {t(
              (
                {
                  checking: '업데이트 확인 중…',
                  downloading: '업데이트 다운로드 중…',
                  installing: '설치 프로그램 여는 중…',
                  unconfigured: '배포 설정 필요',
                  current: '최신 버전입니다',
                  available: '새 버전',
                  ready: '설치 준비 완료',
                  error: '업데이트 안내',
                } as Record<string, string>
              )[status.status],
            )}
          </h2>
          <p>{status.message || status.notes}</p>
          {status.status === 'available' && (
            <button disabled={disabled} onClick={() => void run('update.download')}>
              {t('검증 후 다운로드')}
            </button>
          )}
          {status.status === 'ready' && (
            <button
              className="primary"
              disabled={disabled}
              onClick={() => void run('update.install')}
            >
              {t('설치 창 열기 및 런처 종료')}
            </button>
          )}
          <p>
            {t(
              '설치 프로그램이 열리지 않으면 다운로드 폴더에서 설치 파일을 직접 실행할 수 있습니다.',
            )}
          </p>
          <button onClick={() => void run('update.folder')}>{t('업데이트 파일 폴더 열기')}</button>
        </section>
      )}
      <section className="panel">
        <h3>{t('검증된 업데이트')}</h3>
        <p>
          {t(
            '신뢰한 Ed25519 키로 매니페스트를 검증하고 SHA-256·파일 크기를 검사합니다. 검증 실패 시 현재 설치 파일을 유지합니다.',
          )}
        </p>
      </section>
    </>
  );
}
function Settings() {
  const t = useI18n();
  const { s, run, pending, toast } = useApp();
  const [v, setV] = useState(s.settings);
  useEffect(
    () => setV((current) => ({ ...current, language: s.settings.language })),
    [s.settings.language],
  );
  const [secret, setSecret] = useState('');
  const [key, setKey] = useState('curseforge');
  const [saved, setSaved] = useState<any>({});
  useEffect(() => {
    window.dkkf
      .call('settings.secrets')
      .then(setSaved)
      .catch(() => {});
  }, [pending]);
  const change = (k: keyof typeof v, x: any) => setV((a) => ({ ...a, [k]: x }));
  return (
    <>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await run('settings.save', v);
        }}
      >
        <div className="twocol">
          <section className="panel">
            <h2>{t('게임 환경')}</h2>
            <label>
              {t('언어 / Language / Хэл')}
              <select
                aria-label={t('언어 / Language / Хэл')}
                value={s.settings.language}
                disabled={pending}
                onChange={(e) => void run('settings.language', e.target.value)}
              >
                <option value="ko">{t('한국어')}</option>
                <option value="en">English</option>
                <option value="mn">Монгол хэл</option>
              </select>
            </label>
            <label>
              {t('Java 실행 파일')}
              <div className="inputbutton">
                <input
                  value={v.javaPath}
                  onChange={(e) => change('javaPath', e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={async () => {
                    const p = await run<string>('settings.java');
                    if (p) change('javaPath', p);
                  }}
                >
                  {t('찾기')}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={async () => {
                    const found = await run<{
                      path: string;
                      major: number;
                    }>('settings.javaAuto');
                    if (found) {
                      change('javaPath', found.path);
                      toast(`Java ${found.major} 발견. 설정 저장을 눌러 적용하세요.`);
                    }
                  }}
                >
                  {t('자동 검색')}
                </button>
              </div>
            </label>
            <p className="hint">
              Minecraft {target.minecraft}
              {t(' Fabric 기준 Java ')}
              {target.java}
              {t(
                ' 이상이 필요합니다. 자동 검색으로 설치된 Java를 찾거나 java.exe 경로를 지정하세요.',
              )}
            </p>
            <label className="check">
              <input
                type="checkbox"
                checked={v.limitRam}
                onChange={(e) => change('limitRam', e.target.checked)}
              />
              {t('새 인스턴스의 RAM 상한 직접 설정')}
            </label>
            <label>
              {t('기본 RAM: ')}
              {v.ram / 1024} GB
              <input
                type="range"
                min="1024"
                max="32768"
                step="512"
                disabled={!v.limitRam}
                value={v.ram}
                onChange={(e) => change('ram', Number(e.target.value))}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={v.limitResolution}
                onChange={(e) => change('limitResolution', e.target.checked)}
              />
              {t('게임 해상도 직접 설정')}
            </label>
            <div className="formgrid">
              <label>
                {t('해상도 너비')}
                <input
                  type="number"
                  min="640"
                  max="7680"
                  disabled={!v.limitResolution}
                  value={v.width}
                  onChange={(e) => change('width', Number(e.target.value))}
                />
              </label>
              <label>
                {t('해상도 높이')}
                <input
                  type="number"
                  min="480"
                  max="4320"
                  disabled={!v.limitResolution}
                  value={v.height}
                  onChange={(e) => change('height', Number(e.target.value))}
                />
              </label>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={v.fullscreen}
                onChange={(e) => change('fullscreen', e.target.checked)}
              />
              {t('전체 화면')}
            </label>
            <button type="button" onClick={() => void run('settings.data')}>
              {t('게임·다운로드·로그 데이터 폴더 열기 ↗')}
            </button>
          </section>
          <section className="panel">
            <h2>{t('인증 및 업데이트')}</h2>
            <label className="check">
              <input
                type="checkbox"
                checked={v.discordRichPresence}
                disabled={pending}
                onChange={async (e) => {
                  const result = await run('settings.discordPresence', e.target.checked);
                  if (result) change('discordRichPresence', result.enabled);
                }}
              />
              {t('Discord Rich Presence 표시 · 즉시 적용')}
            </label>
            <p className="hint">
              {t(
                'Discord 데스크톱 앱에 런처 사용·게임 버전·로더·경과 시간을 표시합니다. 닉네임, 인스턴스 이름, 월드와 서버 주소는 표시하지 않습니다.',
              )}
            </p>

            <label>
              {t('업데이트 서버 URL')}
              <input
                type="url"
                value={v.updateUrl}
                onChange={(e) => change('updateUrl', e.target.value)}
                placeholder="https://updates.example.com"
              />
            </label>
            <label>
              {t('Ed25519 공개키 (PEM)')}
              <textarea
                rows={4}
                value={v.updateKey}
                onChange={(e) => change('updateKey', e.target.value)}
                placeholder="-----BEGIN PUBLIC KEY-----"
              />
            </label>
            <label>
              {t('업데이트 채널')}
              <select value={v.channel} onChange={(e) => change('channel', e.target.value)}>
                <option value="stable">Stable</option>
                <option value="beta">Beta</option>
              </select>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={v.autoUpdate}
                onChange={(e) => change('autoUpdate', e.target.checked)}
              />
              {t('런처 자동 업데이트 · 시작 시/5분마다 다운로드, 종료할 때 적용')}
            </label>
          </section>
        </div>
        <div className="toolbar right">
          <button className="primary" disabled={pending || s.busy || !!s.running}>
            {t('설정 저장')}
          </button>
        </div>
      </form>
      <section className="panel">
        <h2>{t('플랫폼 비밀키')}</h2>
        <p className="muted">
          {t(
            'Windows 계정에 연결된 암호화 저장소에 보관합니다. 저장된 값은 화면으로 다시 보내지 않습니다.',
          )}
        </p>
        <div className="formgrid">
          <label>
            {t('플랫폼')}
            <select
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setSecret('');
              }}
            >
              <option value="curseforge">CurseForge API Key</option>
            </select>
          </label>
          <label>
            {t('비밀키 ')}
            {saved[key] ? t('· 저장됨') : t('· 설정 안 됨')}
            <input
              type="password"
              autoComplete="off"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
          </label>
        </div>
        <div className="button-row">
          <button
            disabled={!secret || pending}
            onClick={async () => {
              await run('settings.secret', { key, value: secret });
              setSecret('');
            }}
          >
            {t('암호화 저장')}
          </button>
          <button
            className="danger"
            disabled={!saved[key] || pending}
            onClick={() => void run('settings.secret', { key, value: '' })}
          >
            {t('저장된 키 삭제')}
          </button>
        </div>
      </section>
    </>
  );
}
function Account() {
  const t = useI18n();
  const { s, run, toast, pending } = useApp();
  const active = s.accounts.find((a) => a.id === s.activeAccount);
  const [device, setDevice] = useState<any>();
  const [error, setError] = useState('');
  useEffect(() => {
    if (!device) return;
    let stopped = false;
    let timeout: ReturnType<typeof setTimeout>;
    const end = Date.now() + device.expires * 1000;
    const poll = async () => {
      if (stopped) return;
      if (Date.now() > end) {
        setError('로그인 코드가 만료되었습니다.');
        setDevice(undefined);
        return;
      }
      try {
        const r = await window.dkkf.call('auth.poll');
        if (stopped) return;
        if (!r.pending) {
          await run('state');
          setDevice(undefined);
          toast('Microsoft 계정 연결 완료');
          return;
        }
        timeout = setTimeout(poll, (r.interval || 5) * 1000);
      } catch (e) {
        if (!stopped) {
          setError((e as Error).message);
          setDevice(undefined);
        }
      }
    };
    timeout = setTimeout(poll, (device.interval || 5) * 1000);
    return () => {
      stopped = true;
      clearTimeout(timeout);
    };
  }, [device]);
  return (
    <>
      <section className="panel account-hero">
        {active ? (
          <PlayerFace account={active} size={80} />
        ) : (
          <div className="avatar big">
            <Icon name="Account" size={42} />
          </div>
        )}
        <div>
          <h2>
            {active
              ? t('{0}님으로 연결되었습니다.', active.name)
              : t('Microsoft 계정으로 연결하세요.')}
          </h2>
          <p>
            {t('Minecraft Java Edition의 실제 이용 권한과 프로필을 확인합니다.')}
            <br />
            {t('비밀번호는 브라우저의 Microsoft 공식 페이지에서만 입력하세요.')}
          </p>
          <button
            className="primary"
            disabled={pending || !!device || !!s.running}
            onClick={async () => {
              setError('');
              const d = await run('auth.begin');
              if (d) setDevice(d);
            }}
          >
            {active ? t('＋ 다른 Microsoft 계정 연결') : t('＋ Microsoft 로그인')}
          </button>
          {active && (
            <button disabled={pending || !!s.running} onClick={() => void run('auth.avatar')}>
              {t('스킨 새로고침')}
            </button>
          )}
        </div>
      </section>
      <div className="notice-inline">
        {t(
          'Dkkf Launcher의 Microsoft 로그인으로 연결합니다. 브라우저 인증과 Minecraft 이용 권한 확인이 완료된 뒤 계정이 추가됩니다.',
        )}
      </div>
      {error && <p className="error">{t(error)}</p>}
      {device && (
        <section className="panel">
          <h2>{t('브라우저에서 로그인 완료')}</h2>
          <p>{t('아래 코드를 Microsoft 공식 페이지에 입력하세요.')}</p>
          <div className="device-code">{device.code}</div>
          <div className="button-row">
            <button className="primary" onClick={() => void run('external', device.url)}>
              {t('Microsoft 인증 페이지 열기 ↗')}
            </button>
            <button
              onClick={() => {
                setDevice(undefined);
                void run('auth.cancel');
              }}
            >
              {t('취소')}
            </button>
          </div>
          <p className="muted">
            {t(
              '인증 완료를 기다리고 있습니다. 성공 응답 및 게임 소유권 확인 전까지 계정을 추가하지 않습니다.',
            )}
          </p>
        </section>
      )}
      <section className="panel">
        <h2>{t('연결된 계정')}</h2>
        {s.accounts.length ? (
          s.accounts.map((a) => (
            <div className="instance-row" key={a.id}>
              <PlayerFace account={a} size={40} />
              <div>
                <b>{a.name}</b>
                <small>{a.id}</small>
              </div>
              <button
                disabled={!!s.running || s.activeAccount === a.id}
                onClick={() => void run('auth.select', a.id)}
              >
                {s.activeAccount === a.id ? t('사용 중') : t('선택')}
              </button>
              <button
                className="danger"
                disabled={!!s.running}
                onClick={() => void run('auth.logout', a.id)}
              >
                {t('로그아웃')}
              </button>
            </div>
          ))
        ) : (
          <p className="muted">{t('연결된 계정이 없습니다.')}</p>
        )}
      </section>
    </>
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>,
);
