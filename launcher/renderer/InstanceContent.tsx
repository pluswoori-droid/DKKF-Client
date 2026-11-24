import { useI18n } from './i18n';
import { useEffect, useState } from 'react';
import type { ContentItem, Instance, PresetReport } from '../../shared/types';
type Run = (method: string, args?: unknown) => Promise<any>;
export function PresetOverview({
  instance,
  run,
  epoch,
  disabled,
}: {
  instance: Instance;
  run: Run;
  epoch: number;
  disabled: boolean;
}) {
  const t = useI18n();
  const [report, setReport] = useState<PresetReport>();
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    setReport(undefined);
    setError('');
    void window.dkkf
      .call<PresetReport>('preset.status', instance.id)
      .then((r) => {
        if (alive) setReport(r);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [instance.id, epoch]);
  const labels = {
    installed: '설치 완료',
    preserved: '서버 버전 일치',
    disabled: '설치됨 · 비활성',
    unsupported: '지원 대기',
    error: '설치 실패',
  };
  return (
    <section className="panel preset-panel">
      <div className="toolbar">
        <div>
          <span className="eyebrow">{t('DKKF 서버 전용 구성')}</span>
          <h2>{t('모드팩을 설치하면 서버 모드까지 자동 준비.')}</h2>
        </div>
        <button
          disabled={disabled || instance.version !== '26.3' || instance.loader !== 'fabric'}
          onClick={() => void run('preset.install', instance.id)}
        >
          {t('서버 구성 복구 / 재시도')}
        </button>
      </div>
      <p className="muted">
        {t(
          'Fabric API · Xaero’s Minimap · Dkkf Loot를 자동 준비합니다. DKKF HUD는 제외합니다.',
        )}
      </p>

      {error && <p className="error">{t(error)}</p>}
      {report?.items.length ? (
        <div className="preset-list">
          {report.items.map((item) => (
            <div className="preset-row" key={item.project}>
              <b>{item.name}</b>
              <span className={'tag ' + (item.status === 'error' ? 'warning' : '')}>
                {t(labels[item.status])}
              </span>
              <small className="muted">{t(item.message)}</small>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">
          {t(
            '새 인스턴스는 생성 후, 기존 인스턴스는 첫 실행 전에 기본 구성을 준비합니다. 준비 상태는 이곳에 표시됩니다.',
          )}
        </p>
      )}
    </section>
  );
}
export function LocalContent({
  instance,
  kind,
  run,
  epoch,
  disabled,
}: {
  instance: Instance;
  kind: 'resourcepack' | 'shader' | 'world';
  run: Run;
  epoch: number;
  disabled: boolean;
}) {
  const t = useI18n();
  const [items, setItems] = useState<ContentItem[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [updates, setUpdates] = useState<
      {
        item: ContentItem;
        version: {
          id: string;
          name: string;
        };
      }[]
    >();
  const labels = { resourcepack: '리소스팩', shader: '쉐이더팩', world: '월드' },
    label = labels[kind];
  useEffect(() => {
    let alive = true;
    setItems([]);
    setUpdates(undefined);
    setLoading(true);
    setError('');
    void window.dkkf
      .call<ContentItem[]>('content.list', { id: instance.id, kind })
      .then((r) => {
        if (alive) setItems(r);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [instance.id, kind, epoch]);
  return (
    <>
      <div className="toolbar">
        <span className="muted">
          {items.length}
          {t('개 ')}
          {t(label)}
        </span>
        <div className="button-row">
          {kind !== 'world' && (
            <button
              disabled={disabled || loading}
              onClick={async () => {
                setError('');
                try {
                  const found = [];
                  for (const item of items) {
                    if (!item.source) continue;
                    const d = await window.dkkf.call('content.detail', {
                      instance: instance.id,
                      kind,
                      project: item.source.project,
                    });
                    if (d.versions[0] && d.versions[0].id !== item.source.version)
                      found.push({ item, version: d.versions[0] });
                  }
                  setUpdates(found);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {t('업데이트 확인')}
            </button>
          )}
          <button onClick={() => void run('content.folder', { id: instance.id, kind })}>
            {t('폴더 열기')}
          </button>
          {kind === 'world' && (
            <button
              disabled={disabled}
              onClick={() => void run('content.import', { id: instance.id, kind, directory: true })}
            >
              {t('폴더 가져오기')}
            </button>
          )}
          <button
            className="primary"
            disabled={disabled}
            onClick={() => void run('content.import', { id: instance.id, kind })}
          >
            {t('＋ ZIP 가져오기')}
          </button>
        </div>
      </div>
      <p className="hint">
        {kind === 'world'
          ? t(
              'Java Edition 월드 ZIP 또는 폴더를 가져오세요. 기존 월드를 덮어쓰지 않으며, 플레이는 게임의 싱글플레이 화면에서 시작합니다. 월드의 게임 버전은 직접 확인하세요.',
            )
          : kind === 'shader'
            ? t(
                '쉐이더팩을 선택하면 Iris 설정에 적용됩니다. 활성화에는 설치된 Iris가 필요하며, 쉐이더팩은 한 번에 하나만 사용할 수 있습니다.',
              )
            : t(
                '활성화한 리소스팩은 다음 게임 실행에 적용됩니다. 로컬 ZIP의 게임 버전과 필요한 모드는 제작자 안내를 확인하세요.',
              )}
      </p>
      {error && <p className="error">{t(error)}</p>}
      {loading ? (
        <p className="muted">{t('콘텐츠를 읽고 있습니다…')}</p>
      ) : items.length ? (
        <div className="content-table">
          <div className="content-table-heading">
            <span>{t('이름')}</span>
            <span>{t('버전 / 출처')}</span>
            <span>{t('관리')}</span>
          </div>
          {items.map((item) => (
            <div className="content-table-row" key={item.file}>
              <div>
                <b>{item.name}</b>
                <small>{item.file}</small>
                {item.warnings.map((w) => (
                  <small className="error" key={w}>
                    {t(w)}
                  </small>
                ))}
              </div>
              <div>
                <span>{item.version || t('로컬 파일')}</span>
                <small>
                  {item.source ? 'Modrinth' : t('직접 가져옴')}
                  {item.size ? ' · ' + (item.size / 1024 / 1024).toFixed(1) + ' MB' : ''}
                </small>
              </div>
              <div className="button-row">
                {kind !== 'world' && (
                  <button
                    className={item.enabled ? 'content-enabled' : ''}
                    disabled={disabled}
                    aria-pressed={!!item.enabled}
                    onClick={() =>
                      void run('content.activate', {
                        id: instance.id,
                        kind,
                        file: item.file,
                        enabled: !item.enabled,
                      })
                    }
                  >
                    {item.enabled ? t('✓ 활성화됨') : t('활성화')}
                  </button>
                )}
                <button
                  disabled={disabled}
                  title={t('파일을 콘텐츠 보관함으로 이동합니다')}
                  onClick={() =>
                    void run('content.remove', { id: instance.id, kind, file: item.file })
                  }
                >
                  {t('제거')}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="content-empty">
          <span className="eyebrow">YOUR INSTANCE · YOUR CONTENT</span>
          <h3>
            {t('아직 ')}
            {t(label)}
            {t('이 없습니다.')}
          </h3>
          <p>
            {kind === 'world'
              ? t('월드 ZIP이나 폴더를 가져와 모험을 이어가세요.')
              : t('콘텐츠 추가에서 찾아보거나 직접 ZIP 파일을 가져오세요.')}
          </p>
        </div>
      )}
      {updates && (
        <section className="panel">
          <h3>{t('수동 업데이트')}</h3>
          {updates.length ? (
            updates.map(({ item, version }) => (
              <div className="instance-row" key={item.file}>
                <div>
                  <b>{item.name}</b>
                  <small>{version.name}</small>
                </div>
                <button
                  disabled={disabled}
                  onClick={() =>
                    void run('content.install', {
                      id: instance.id,
                      kind,
                      project: item.source!.project,
                      version: version.id,
                    })
                  }
                >
                  {t('이 버전 설치')}
                </button>
              </div>
            ))
          ) : (
            <p className="muted">{t('연결된 프로젝트의 새 호환 버전이 없습니다.')}</p>
          )}
        </section>
      )}
    </>
  );
}
