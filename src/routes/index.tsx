import { LiveDashboard } from '../components/LiveDashboard'
import { runSsh } from '../server/ssh.functions'
import { createFileRoute } from '@tanstack/react-router'
import { FormEvent, useMemo, useState } from 'react'
import {
  Activity,
  Bell,
  Box,
  Boxes,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Clock3,
  Command,
  Copy,
  Cpu,
  Database,
  Download,
  Files,
  Folder,
  Gauge,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  MemoryStick,
  Menu,
  Network,
  PackageCheck,
  Play,
  Plus,
  Power,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Square,
  TerminalSquare,
  UserRoundCog,
  Users,
  X,
  Zap,
} from 'lucide-react'

export const Route = createFileRoute('/')({ component: ServerManager })

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error'
type DashboardView =
  | 'Overview'
  | 'Terminal'
  | 'Containers'
  | 'Tasks'
  | 'Files'
  | 'Firewall'
  | 'Storage'
  | 'Users & groups'
  | 'Updates'
  | 'Settings'

const navigation: Array<{
  label: DashboardView
  icon: typeof LayoutDashboard
  badge?: string
}> = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Terminal', icon: TerminalSquare },
  { label: 'Containers', icon: Boxes, badge: '5' },
  { label: 'Tasks', icon: Activity },
  { label: 'Files', icon: Folder },
  { label: 'Firewall', icon: ShieldCheck },
  { label: 'Storage', icon: Database },
  { label: 'Users & groups', icon: Users },
  { label: 'Updates', icon: PackageCheck, badge: '12' },
  { label: 'Settings', icon: Settings },
]

const containers = [
  { name: 'traefik-edge', image: 'traefik:v3.1', ports: '80, 443', state: 'running' },
  { name: 'paperless-web', image: 'ghcr.io/paperless:2.11', ports: '8000', state: 'running' },
  { name: 'postgres-main', image: 'postgres:16-alpine', ports: '5432', state: 'running' },
  { name: 'redis-cache', image: 'redis:7.4-alpine', ports: '6379', state: 'running' },
  { name: 'nightly-backup', image: 'restic/restic:latest', ports: '—', state: 'stopped' },
]

const processes = [
  { name: 'dockerd', user: 'root', cpu: '8.7%', memory: '642 MB', pid: '1184' },
  { name: 'postgres', user: 'postgres', cpu: '4.2%', memory: '1.18 GB', pid: '2319' },
  { name: 'paperless', user: 'svc-web', cpu: '2.8%', memory: '384 MB', pid: '5082' },
  { name: 'systemd-journal', user: 'root', cpu: '1.4%', memory: '92 MB', pid: '412' },
  { name: 'traefik', user: 'root', cpu: '0.9%', memory: '76 MB', pid: '3491' },
]

function ServerManager() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')
  const [host, setHost] = useState('192.168.1.24')
  const [port, setPort] = useState('22')
  const [username, setUsername] = useState('ubuntu')
  const [activeView, setActiveView] = useState<DashboardView>('Overview')

  const [demo, setDemo] = useState(false)
  const [liveOutput, setLiveOutput] = useState('')
  const [connectionError, setConnectionError] = useState('')

  const connect = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setConnectionState('connecting')
    setConnectionError('')
    if (!demo) {
      try {
        const result = await runSsh({ data: { host: host.trim(), port, username: username.trim(), operation: 'overview' } })
        if (!result.ok) throw new Error(result.output)
        setLiveOutput(result.output)
        setConnectionState('connected')
      } catch (error) {
        setConnectionError(error instanceof Error ? error.message : 'Connection failed.')
        setConnectionState('idle')
      }
      return
    }
    window.setTimeout(() => {
      const shouldFail = /404|offline|invalid|fail/i.test(host)
      setConnectionState(shouldFail ? 'error' : 'connected')
    }, 1100)
  }

  if (connectionState === 'connected' && !demo) return <LiveDashboard coordinates={{ host: host.trim(), port, username: username.trim() }} initialOutput={liveOutput} disconnect={() => setConnectionState('idle')} />

  if (connectionState === 'connected') {
    return (
      <Dashboard
        activeView={activeView}
        host={host}
        setActiveView={setActiveView}
        disconnect={() => setConnectionState('idle')}
      />
    )
  }

  if (connectionState === 'error') {
    return <ConnectionError host={host} retry={() => setConnectionState('idle')} />
  }

  return (
    <ConnectionScreen
      demo={demo}
      setDemo={setDemo}
      connectionError={connectionError}
      connectionState={connectionState}
      host={host}
      port={port}
      username={username}
      setHost={setHost}
      setPort={setPort}
      setUsername={setUsername}
      connect={connect}
    />
  )
}

function Brand() {
  return (
    <div className="brand-lockup">
      <div className="brand-mark"><Command size={19} strokeWidth={2.6} /></div>
      <div>
        <strong>Northstar</strong>
        <span>Ubuntu control</span>
      </div>
    </div>
  )
}

function ConnectionScreen({
  demo, setDemo, connectionError,
  connectionState,
  host,
  port,
  username,
  setHost,
  setPort,
  setUsername,
  connect,
}: {
  demo: boolean
  setDemo: (value: boolean) => void
  connectionError: string
  connectionState: ConnectionState
  host: string
  port: string
  username: string
  setHost: (value: string) => void
  setPort: (value: string) => void
  setUsername: (value: string) => void
  connect: (event: FormEvent<HTMLFormElement>) => void
}) {
  const isConnecting = connectionState === 'connecting'

  return (
    <main className="connection-shell">
      <div className="grid-texture" />
      <header className="connection-header">
        <Brand />
        <div className="secure-label"><LockKeyhole size={14} /> Local SSH gateway</div>
      </header>

      <section className="connection-layout">
        <div className="connection-intro">
          <div className="eyebrow"><span /> Remote operations console</div>
          <h1>Your server,<br /><em>within reach.</em></h1>
          <p>Connect to an Ubuntu host and manage its entire stack from one focused workspace.</p>
          <div className="trust-row">
            <div><ShieldCheck size={18} /><span><strong>SSH tunnel</strong>Encrypted session</span></div>
            <div><Clock3 size={18} /><span><strong>Local keys</strong>Keys stay on this PC</span></div>
          </div>
        </div>

        <form className="connection-card" onSubmit={connect}>
          <div className="card-index">01 / CONNECT</div>
          <div className="connection-card-title">
            <div className="server-glyph"><Server size={24} /></div>
            <div>
              <h2>Server coordinates</h2>
              <p>Enter the SSH endpoint for your Ubuntu server.</p>
            </div>
          </div>

          <label className="field-label" htmlFor="host">Host address</label>
          <div className="input-shell">
            <Network size={17} />
            <input disabled={isConnecting} id="host" value={host} onChange={(event) => setHost(event.target.value)} placeholder="server.example.com" required />
          </div>

          <div className="field-pair">
            <div>
              <label className="field-label" htmlFor="port">SSH port</label>
              <div className="input-shell compact"><span className="port-symbol">:</span><input disabled={isConnecting} id="port" value={port} onChange={(event) => setPort(event.target.value)} inputMode="numeric" required /></div>
            </div>
            <div>
              <label className="field-label" htmlFor="username">Username</label>
              <div className="input-shell compact"><UserRoundCog size={17} /><input disabled={isConnecting} id="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></div>
            </div>
          </div>

          <div className="auth-row">
            <div><KeyRound size={17} /><span><strong>SSH key / agent</strong>Uses this PC?s OpenSSH credentials</span></div>
            <ChevronDown size={17} />
          </div>

          <button className="connect-button" type="submit" disabled={isConnecting}>
            {isConnecting ? <><RefreshCw className="spin" size={18} /> Negotiating secure session</> : <>Connect to server <Zap size={18} fill="currentColor" /></>}
          </button>
          <label className="connection-hint"><input type="checkbox" checked={demo} disabled={isConnecting} onChange={event => setDemo(event.target.checked)} /> Demo mode (simulated data)</label>
          {connectionError && <p className="live-error" role="alert">{connectionError}</p>}
          <p className="connection-hint">First set up SSH key access and verify the VM host key from PowerShell. For NAT port forwarding, use 127.0.0.1 and your forwarded port (for example 2222).</p>
        </form>
      </section>
      <footer className="connection-footer"><span>Northstar Console v2.4</span><span>Designed for Ubuntu Server 22.04+</span></footer>
    </main>
  )
}

function ConnectionError({ host, retry }: { host: string; retry: () => void }) {
  return (
    <main className="error-shell">
      <div className="error-orbit orbit-one" />
      <div className="error-orbit orbit-two" />
      <header className="connection-header"><Brand /><div className="secure-label error-status"><CircleAlert size={14} /> Connection failed</div></header>
      <section className="error-content">
        <div className="error-code">404</div>
        <div className="error-copy">
          <div className="eyebrow error-eyebrow"><span /> Host unreachable</div>
          <h1>We couldn't find<br />your server.</h1>
          <p>The host <code>{host}</code> did not answer on the requested SSH port. The address may be incorrect, or the server may be offline.</p>
          <div className="error-checklist">
            <span><CircleCheck size={15} /> Verify the hostname or IP address</span>
            <span><CircleCheck size={15} /> Confirm port 22 is open</span>
            <span><CircleCheck size={15} /> Check that the server is powered on</span>
          </div>
          <button className="retry-button" onClick={retry}><RotateCcw size={17} /> Check coordinates</button>
        </div>
      </section>
      <div className="error-log"><span>CONNECTION_LOG</span><code>ssh: connect to host {host} port 22: Connection refused</code></div>
    </main>
  )
}

function Dashboard({
  activeView,
  host,
  setActiveView,
  disconnect,
}: {
  activeView: DashboardView
  host: string
  setActiveView: (view: DashboardView) => void
  disconnect: () => void
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <main className="dashboard-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'open' : ''}`}>
        <div className="sidebar-top"><Brand /><button className="mobile-close" onClick={() => setMobileNavOpen(false)} aria-label="Close menu"><X size={20} /></button></div>
        <div className="server-switcher">
          <div className="server-avatar"><Server size={18} /></div>
          <div><strong>atlas-production</strong><span><i /> {host}</span></div>
          <ChevronDown size={16} />
        </div>
        <nav className="main-nav" aria-label="Server tools">
          <span className="nav-heading">Workspace</span>
          {navigation.map((item) => (
            <button
              key={item.label}
              className={activeView === item.label ? 'active' : ''}
              onClick={() => { setActiveView(item.label); setMobileNavOpen(false) }}
            >
              <item.icon size={18} /> {item.label} {item.badge && <span className="nav-badge">{item.badge}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="operator"><div className="operator-avatar">AK</div><div><strong>Alex Kimani</strong><span>Administrator</span></div><button aria-label="Sign out" onClick={disconnect}><LogOut size={17} /></button></div>
          <div className="connection-pulse"><span><i /> Secure session</span><code>42ms</code></div>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="breadcrumb"><span>atlas-production</span><b>/</b><strong>{activeView}</strong></div>
          <div className="topbar-actions">
            {searchOpen && <div className="quick-search"><Search size={15} /><input autoFocus placeholder="Search server…" /></div>}
            <button onClick={() => setSearchOpen(!searchOpen)} aria-label="Search"><Search size={18} /></button>
            <button className="notification-button" aria-label="Notifications"><Bell size={18} /><i /></button>
            <button className="uptime-chip"><i /> Online · 14d 06h</button>
          </div>
        </header>
        <div className="dashboard-content">
          {activeView === 'Overview' ? <Overview setActiveView={setActiveView} /> : <ToolView view={activeView} />}
        </div>
      </section>
    </main>
  )
}

function Overview({ setActiveView }: { setActiveView: (view: DashboardView) => void }) {
  const [period, setPeriod] = useState('Last 24 hours')
  const cpuBars = useMemo(() => [34, 42, 38, 50, 46, 58, 44, 61, 54, 49, 57, 64, 52, 60, 47, 43, 51, 56, 48, 45, 39, 44, 41, 38], [])

  return (
    <>
      <div className="page-heading">
        <div><div className="eyebrow dashboard-eyebrow"><span /> System overview</div><h1>Good morning, Alex.</h1><p>Everything on atlas-production is running normally.</p></div>
        <div className="heading-actions"><button className="period-button" onClick={() => setPeriod(period === 'Last 24 hours' ? 'Last 7 days' : 'Last 24 hours')}><Clock3 size={16} /> {period} <ChevronDown size={15} /></button><button className="primary-action" onClick={() => setActiveView('Terminal')}><TerminalSquare size={16} /> Open terminal</button></div>
      </div>

      <section className="metrics-grid">
        <MetricCard icon={Cpu} label="CPU load" value="38%" detail="8 cores · 2.4 GHz" progress={38} tone="orange" />
        <MetricCard icon={MemoryStick} label="Memory" value="6.2" suffix="/ 16 GB" detail="9.8 GB available" progress={39} tone="green" />
        <MetricCard icon={HardDrive} label="Disk usage" value="71%" detail="164.7 / 232 GB" progress={71} tone="amber" />
        <MetricCard icon={Network} label="Network" value="12.8" suffix="MB/s" detail="↑ 2.1 · ↓ 10.7" progress={53} tone="blue" />
      </section>

      <section className="overview-grid">
        <article className="panel performance-panel">
          <div className="panel-header"><div><span className="panel-kicker">Performance</span><h2>CPU activity</h2></div><span className="panel-value"><b>38%</b> average</span></div>
          <div className="chart-wrap">
            <div className="chart-labels"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div>
            <div className="bar-chart">{cpuBars.map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}</div>
          </div>
          <div className="chart-times"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>Now</span></div>
        </article>

        <article className="panel disk-panel">
          <div className="panel-header"><div><span className="panel-kicker">Storage</span><h2>Disk space</h2></div><button onClick={() => setActiveView('Storage')}>View all</button></div>
          <div className="disk-visual"><div className="disk-ring"><div><strong>71%</strong><span>used</span></div></div><div className="disk-total"><strong>164.7 GB</strong><span>of 232 GB</span></div></div>
          <div className="storage-legend"><span><i className="system" /> System <b>38.2 GB</b></span><span><i className="docker" /> Docker <b>72.4 GB</b></span><span><i className="files" /> Files <b>54.1 GB</b></span></div>
        </article>

        <article className="panel containers-panel">
          <div className="panel-header"><div><span className="panel-kicker">Docker</span><h2>Containers</h2></div><button onClick={() => setActiveView('Containers')}>Manage all <span>→</span></button></div>
          <div className="container-summary"><div><Boxes size={20} /><span><b>4</b> running</span></div><div><Square size={17} /><span><b>1</b> stopped</span></div><button><Plus size={16} /> New container</button></div>
          <div className="container-list">
            {containers.slice(0, 4).map((container) => <div key={container.name}><span className="container-icon"><Box size={16} /></span><span><strong>{container.name}</strong><small>{container.image}</small></span><code>{container.ports}</code><i className={container.state} /></div>)}
          </div>
        </article>

        <article className="panel quick-panel">
          <div className="panel-header"><div><span className="panel-kicker">Shortcuts</span><h2>Quick actions</h2></div></div>
          <div className="quick-actions">
            <button onClick={() => setActiveView('Files')}><Files size={19} /><span><strong>Browse files</strong><small>Open file manager</small></span><b>→</b></button>
            <button onClick={() => setActiveView('Users & groups')}><UserRoundCog size={19} /><span><strong>Add user</strong><small>Manage access</small></span><b>→</b></button>
            <button onClick={() => setActiveView('Firewall')}><ShieldCheck size={19} /><span><strong>Firewall rule</strong><small>Control a port</small></span><b>→</b></button>
            <button onClick={() => setActiveView('Updates')}><Download size={19} /><span><strong>Install updates</strong><small>12 packages ready</small></span><b>→</b></button>
          </div>
        </article>
      </section>

      <section className="panel activity-panel">
        <div className="panel-header"><div><span className="panel-kicker">System log</span><h2>Recent activity</h2></div><button>View journal</button></div>
        <div className="activity-row"><span className="activity-icon success"><CircleCheck size={16} /></span><div><strong>Backup completed successfully</strong><span>restic · /srv/data → s3:atlas-backups</span></div><time>08:42</time></div>
        <div className="activity-row"><span className="activity-icon update"><PackageCheck size={16} /></span><div><strong>12 package updates are available</strong><span>3 security updates included</span></div><time>07:15</time></div>
        <div className="activity-row"><span className="activity-icon login"><KeyRound size={16} /></span><div><strong>Administrator login</strong><span>alex · 10.0.0.42 via SSH</span></div><time>06:58</time></div>
      </section>
    </>
  )
}

function MetricCard({ icon: Icon, label, value, suffix, detail, progress, tone }: { icon: typeof Cpu; label: string; value: string; suffix?: string; detail: string; progress: number; tone: string }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}><Icon size={19} /></div>
      <div className="metric-label">{label}<span className="good-dot" /></div>
      <div className="metric-value">{value} {suffix && <small>{suffix}</small>}</div>
      <div className="metric-progress"><span className={tone} style={{ width: `${progress}%` }} /></div>
      <div className="metric-detail">{detail}<span>Normal</span></div>
    </article>
  )
}

function ToolView({ view }: { view: DashboardView }) {
  if (view === 'Terminal') return <TerminalView />
  if (view === 'Containers') return <ContainersView />
  if (view === 'Tasks') return <TasksView />

  const toolDetails: Record<Exclude<DashboardView, 'Overview' | 'Terminal' | 'Containers' | 'Tasks'>, { icon: typeof Folder; description: string; stat: string; statLabel: string }> = {
    Files: { icon: Folder, description: 'Browse, edit, upload, and manage files across the server.', stat: '18,492', statLabel: 'indexed files' },
    Firewall: { icon: ShieldCheck, description: 'Control inbound traffic and review active UFW rules.', stat: '7', statLabel: 'active rules' },
    Storage: { icon: Database, description: 'Inspect mounted volumes, partitions, and disk allocation.', stat: '67.3 GB', statLabel: 'space available' },
    'Users & groups': { icon: Users, description: 'Manage accounts, groups, SSH keys, and permissions.', stat: '12', statLabel: 'user accounts' },
    Updates: { icon: PackageCheck, description: 'Review Ubuntu packages and apply security updates.', stat: '12', statLabel: 'updates ready' },
    Settings: { icon: Settings, description: 'Configure the host, session security, and notifications.', stat: 'Healthy', statLabel: 'system status' },
  }
  const details = toolDetails[view as keyof typeof toolDetails]
  const Icon = details.icon
  return (
    <div className="tool-page">
      <div className="page-heading"><div><div className="eyebrow dashboard-eyebrow"><span /> Server tool</div><h1>{view}</h1><p>{details.description}</p></div><button className="primary-action"><Plus size={16} /> New action</button></div>
      <section className="tool-hero panel"><div className="tool-hero-icon"><Icon size={30} /></div><div><span>atlas-production</span><strong>{details.stat}</strong><small>{details.statLabel}</small></div><div className="tool-health"><i /> Service operational</div></section>
      <section className="panel empty-browser"><div className="browser-toolbar"><div className="fake-breadcrumb"><Folder size={16} /><span>/</span><strong>{view.toLowerCase().replace(' & ', '/')}</strong></div><button><RefreshCw size={15} /> Refresh</button></div><div className="browser-placeholder"><Icon size={38} /><h2>{view} workspace is ready</h2><p>Select an item or create a new action to begin managing this server.</p><button className="secondary-action"><Plus size={16} /> Create new</button></div></section>
    </div>
  )
}

function TerminalView() {
  const [commands, setCommands] = useState(['Welcome to Ubuntu 24.04.2 LTS', 'Last login: Fri Jul 17 08:58:12 2026 from 10.0.0.42', '', 'ubuntu@atlas-production:~$ systemctl is-system-running', 'running'])
  const [command, setCommand] = useState('')
  const runCommand = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!command.trim()) return
    setCommands([...commands, `ubuntu@atlas-production:~$ ${command}`, command === 'docker ps' ? 'CONTAINER ID   IMAGE                    STATUS' : `Command completed: ${command}`])
    setCommand('')
  }
  return (
    <div className="tool-page terminal-page">
      <div className="page-heading"><div><div className="eyebrow dashboard-eyebrow"><span /> Interactive shell</div><h1>Terminal</h1><p>SSH session connected as ubuntu.</p></div><button className="period-button"><Plus size={16} /> New session</button></div>
      <section className="terminal-window"><div className="terminal-toolbar"><div><i /><i /><i /></div><span><LockKeyhole size={13} /> ubuntu@atlas-production</span><button><Copy size={15} /></button></div><div className="terminal-body">{commands.map((line, index) => <div key={`${line}-${index}`} className={line === 'running' ? 'terminal-success' : ''}>{line || '\u00a0'}</div>)}<form onSubmit={runCommand}><span>ubuntu@atlas-production:~$</span><input value={command} onChange={(event) => setCommand(event.target.value)} autoFocus aria-label="Terminal command" /></form></div></section>
    </div>
  )
}

function ContainersView() {
  const [items, setItems] = useState(containers)
  const toggleContainer = (name: string) => setItems(items.map((item) => item.name === name ? { ...item, state: item.state === 'running' ? 'stopped' : 'running' } : item))
  return (
    <div className="tool-page">
      <div className="page-heading"><div><div className="eyebrow dashboard-eyebrow"><span /> Docker engine</div><h1>Containers</h1><p>Manage images, ports, runtime state, and logs.</p></div><button className="primary-action"><Plus size={16} /> Create container</button></div>
      <section className="panel data-panel"><div className="data-toolbar"><div className="table-search"><Search size={15} /><input placeholder="Filter containers" /></div><span><i /> Engine 27.1.1 running</span></div><div className="data-table"><div className="data-row data-head"><span>Name</span><span>Image</span><span>Ports</span><span>Status</span><span>Action</span></div>{items.map((item) => <div className="data-row" key={item.name}><span className="data-name"><Box size={16} /><strong>{item.name}</strong></span><code>{item.image}</code><code>{item.ports}</code><span className={`status-pill ${item.state}`}><i /> {item.state}</span><button onClick={() => toggleContainer(item.name)} aria-label={`${item.state === 'running' ? 'Stop' : 'Start'} ${item.name}`}>{item.state === 'running' ? <Square size={15} /> : <Play size={15} />}</button></div>)}</div></section>
    </div>
  )
}

function TasksView() {
  return (
    <div className="tool-page">
      <div className="page-heading"><div><div className="eyebrow dashboard-eyebrow"><span /> Task manager</div><h1>Processes</h1><p>Live process activity and resource consumption.</p></div><button className="period-button"><RefreshCw size={16} /> Refresh</button></div>
      <section className="metrics-grid compact-metrics"><MetricCard icon={Cpu} label="CPU" value="38%" detail="Load avg 1.82" progress={38} tone="orange" /><MetricCard icon={MemoryStick} label="RAM" value="6.2 GB" detail="39% utilized" progress={39} tone="green" /><MetricCard icon={Gauge} label="Processes" value="284" detail="2 running" progress={24} tone="blue" /><MetricCard icon={Power} label="Uptime" value="14d" detail="6 hours" progress={62} tone="amber" /></section>
      <section className="panel data-panel"><div className="data-toolbar"><div className="table-search"><Search size={15} /><input placeholder="Search processes" /></div><span>Updated just now</span></div><div className="data-table process-table"><div className="data-row data-head"><span>Process</span><span>User</span><span>CPU</span><span>Memory</span><span>PID</span></div>{processes.map((item) => <div className="data-row" key={item.pid}><span className="data-name"><Activity size={16} /><strong>{item.name}</strong></span><span>{item.user}</span><strong>{item.cpu}</strong><span>{item.memory}</span><code>{item.pid}</code></div>)}</div></section>
    </div>
  )
}
