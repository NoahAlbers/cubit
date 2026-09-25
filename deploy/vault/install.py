#!/usr/bin/env python3
"""Run once on the backup VPS with a root-only provision file. Never on the CRM."""
import json,os,pathlib,re,subprocess,sys
def run(*args,input=None,env=None):return subprocess.check_output(args,input=input,env=env)
def write(path,text,mode=0o644):
    p=pathlib.Path(path);p.write_text(text);p.chmod(mode)
if os.geteuid()!=0:raise SystemExit('Operator only')
c=json.loads(pathlib.Path(sys.argv[1]).read_text());host=c['hostname'];ip=c['crmIPv4'];ipv6=c['crmIPv6']
if not re.fullmatch(r'[a-z0-9.-]+',host) or not re.fullmatch(r'[0-9.]+',ip) or not re.fullmatch(r'[a-f0-9:]+',ipv6):raise ValueError('Invalid host configuration')
for user in ('cubit-vault-api','cubit-vault-repo'):
    if subprocess.run(['id',user],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode:run('useradd','--system','--no-create-home','--shell','/usr/sbin/nologin',user)
for path,mode in [('/etc/cubit-vault',0o711),('/opt/cubit-vault',0o755),('/var/lib/cubit-vault',0o755),('/var/lib/cubit-vault/repository',0o700),('/var/lib/cubit-vault/audit',0o700),('/var/lib/cubit-vault/status',0o755),('/var/lib/cubit-vault/operator',0o700)]:
    pathlib.Path(path).mkdir(parents=True,exist_ok=True);os.chmod(path,mode)
run('chown','cubit-vault-api:cubit-vault-api','/var/lib/cubit-vault/audit')
write('/etc/cubit-vault/api.json',json.dumps({k:c[k] for k in ['readToken','writeToken']}),0o640);run('chown','root:cubit-vault-api','/etc/cubit-vault/api.json')
key=pathlib.Path('/etc/cubit-vault/repository.password')
if key.exists() and key.read_text().strip()!=c['repositoryPassword'].strip():raise ValueError('Refusing to replace a recovery key')
write(str(key),c['repositoryPassword'].strip()+'\n',0o600)
write('/etc/cubit-vault/operator.json',json.dumps({'schemas':['cubit_review','cubit_demo'],'database':'cubit_review','restoreImage':c['restoreImage'],'retentionDays':c.get('retentionDays',30)}),0o600)
password=run('htpasswd','-niB','crm',input=(c['repositoryToken']+'\n').encode()).decode();write('/etc/cubit-vault/htpasswd',password,0o640);run('chown','root:cubit-vault-repo','/etc/cubit-vault/htpasswd')
repo=pathlib.Path('/var/lib/cubit-vault/repository/crm')
if not (repo/'config').exists():run('restic','-r',str(repo),'--password-file',str(key),'init')
run('chown','-R','cubit-vault-repo:cubit-vault-repo','/var/lib/cubit-vault/repository')
write('/etc/systemd/system/cubit-vault-repository.service','''[Unit]
Description=Append-only encrypted Cubit backup receiver
After=network.target
[Service]
User=cubit-vault-repo
Group=cubit-vault-repo
ExecStart=/usr/local/bin/rest-server --listen 127.0.0.1:8787 --path /var/lib/cubit-vault/repository --htpasswd-file /etc/cubit-vault/htpasswd --private-repos --append-only --max-size 21474836480
Restart=on-failure
UMask=0077
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/cubit-vault/repository
CapabilityBoundingSet=
[Install]
WantedBy=multi-user.target
''')
write('/etc/systemd/system/cubit-vault-api.service','''[Unit]
Description=Append-only Cubit audit archive and read-only status
After=network.target
[Service]
User=cubit-vault-api
Group=cubit-vault-api
ExecStart=/usr/bin/python3 /opt/cubit-vault/server.py
Restart=on-failure
UMask=0077
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/cubit-vault/audit
MemoryMax=256M
TasksMax=32
CapabilityBoundingSet=
[Install]
WantedBy=multi-user.target
''')
write('/etc/caddy/Caddyfile',f'''{host} {{
    route {{
        @outsider not remote_ip {ip} {ipv6} 127.0.0.1 ::1
        respond @outsider 403
        @destructive method DELETE PUT PATCH
        respond @destructive 405
        @repositoryWrite {{
            method POST
            path_regexp repo ^/repository/(data|index|snapshots)/[a-f0-9]{{64}}$
        }}
        handle @repositoryWrite {{
            route {{
                uri strip_prefix /repository
                rewrite * /crm{{path}}
                reverse_proxy 127.0.0.1:8787
            }}
        }}
        @repositoryRead {{
            method GET HEAD
            path_regexp read ^/repository/(config|((keys|data|index|snapshots|locks)/([a-f0-9]{{64}})?))$
        }}
        handle @repositoryRead {{
            route {{
                uri strip_prefix /repository
                rewrite * /crm{{path}}
                reverse_proxy 127.0.0.1:8787
            }}
        }}
        handle_path /archive/* {{
            reverse_proxy 127.0.0.1:8788
        }}
        respond 404
    }}
}}
''')
for name,command,calendar in [('maintenance','/usr/bin/python3 /opt/cubit-vault/maintain.py','*-*-* 05:30:00 America/New_York'),('recovery','/usr/bin/python3 /opt/cubit-vault/maintain.py --restore','Sun *-*-* 06:00:00 America/New_York')]:
    write('/etc/systemd/system/cubit-vault-'+name+'.service',f'[Unit]\nDescription=Cubit vault {name}\nAfter=network-online.target docker.service\n[Service]\nType=oneshot\nExecStart={command}\nUMask=0077\nTimeoutStartSec=2h\n')
    write('/etc/systemd/system/cubit-vault-'+name+'.timer',f'[Unit]\nDescription=Schedule Cubit vault {name}\n[Timer]\nOnCalendar={calendar}\nPersistent=true\n[Install]\nWantedBy=timers.target\n')
run('caddy','validate','--config','/etc/caddy/Caddyfile')
write('/etc/systemd/system/cubit-vault-inventory.service','[Unit]\nDescription=Refresh independent Cubit backup inventory\n[Service]\nType=oneshot\nExecStart=/usr/bin/python3 /opt/cubit-vault/maintain.py --inventory\nUMask=0077\nTimeoutStartSec=5min\n')
write('/etc/systemd/system/cubit-vault-inventory.timer','[Unit]\nDescription=Update backup-server status\n[Timer]\nOnBootSec=30s\nOnUnitInactiveSec=60s\nAccuracySec=5s\n[Install]\nWantedBy=timers.target\n')
run('systemctl','daemon-reload');run('systemctl','enable','--now','cubit-vault-api','cubit-vault-repository','docker')
run('systemctl','reload','caddy')
run('ufw','allow','OpenSSH')
run('ufw','prepend','deny','from',ip,'to','any','port','22');run('ufw','prepend','deny','from',ipv6,'to','any','port','22')
run('ufw','allow','80/tcp');run('ufw','allow','443/tcp');run('ufw','--force','enable')
print('Vault services installed; repository is append-only and SSH from the CRM is blocked.')
