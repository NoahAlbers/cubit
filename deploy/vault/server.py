#!/usr/bin/env python3
"""Private append-only audit receiver. Run behind the restricted HTTPS proxy.

No shell commands, retention changes, deletion routes, or repository credentials.
The reader credential cannot append; the writer cannot read audit contents.
"""
import datetime as dt, hashlib, hmac, json, os, pathlib, re, shutil, sqlite3, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, parse_qs
from contextlib import contextmanager

CONFIG=pathlib.Path('/etc/cubit-vault/api.json')
STATE=pathlib.Path('/var/lib/cubit-vault/audit')
STATUS=pathlib.Path('/var/lib/cubit-vault/status/backup.json')
MAX_BODY=1024*1024
def canonical(v): return json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False)
def now(): return dt.datetime.now(dt.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
@contextmanager
def connect():
    db=sqlite3.connect(STATE/'audit.sqlite3',timeout=10);db.row_factory=sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON');db.execute('PRAGMA synchronous=FULL');db.execute('PRAGMA max_page_count=262144')
    try:
        with db:yield db
    finally:db.close()
def initialize():
    STATE.mkdir(parents=True,exist_ok=True,mode=0o700)
    with connect() as db:
        db.executescript('''PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS records(sequence INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL,received_at TEXT NOT NULL,member_id TEXT,member_name TEXT,member_email TEXT,author TEXT NOT NULL,kind TEXT NOT NULL,actor TEXT NOT NULL,payload TEXT NOT NULL,digest TEXT NOT NULL,previous_hash TEXT NOT NULL,chain_hash TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS records_time ON records(created_at,id);
CREATE INDEX IF NOT EXISTS records_member ON records(member_id,created_at);
CREATE INDEX IF NOT EXISTS records_author ON records(author);
CREATE TRIGGER IF NOT EXISTS no_record_update BEFORE UPDATE ON records BEGIN SELECT RAISE(ABORT,'Archived audits are immutable'); END;
CREATE TRIGGER IF NOT EXISTS no_record_delete BEFORE DELETE ON records BEGIN SELECT RAISE(ABORT,'Archived audits are immutable'); END;
CREATE TABLE IF NOT EXISTS conflicts(id INTEGER PRIMARY KEY,record_id TEXT,received_at TEXT,digest TEXT);
''')
def record(value):
    fields={'id','createdAt','memberId','memberName','memberEmail','author','kind','detail'}
    if not isinstance(value,dict) or set(value)!=fields: raise ValueError('Invalid record fields')
    for key,limit in [('id',36),('memberId',36),('memberName',512),('memberEmail',254),('author',255),('kind',255),('detail',65535)]:
        v=value[key]
        if key in ('memberId','memberName','memberEmail') and v is None: continue
        if not isinstance(v,str) or len(v.encode())>limit*4: raise ValueError('Invalid record value')
    if not re.fullmatch(r'[a-fA-F0-9-]{36}',value['id']): raise ValueError('Invalid audit identifier')
    date=dt.datetime.fromisoformat(value['createdAt'].replace('Z','+00:00'))
    if date.tzinfo is None: raise ValueError('Timestamp must include UTC offset')
    value={**value,'createdAt':date.astimezone(dt.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')}
    encoded=canonical(value)
    if len(encoded.encode())>300000: raise ValueError('Audit record too large')
    try: detail=json.loads(value['detail'])
    except (ValueError,TypeError): detail={}
    actor=detail.get('actorType') if isinstance(detail,dict) else None
    actor=actor if actor in ('system','member','staff') else ('system' if value['author']=='Automation' else 'member' if value['kind'].startswith('Member updated') or value['kind']=='Demo waiver signed' else 'staff')
    return value,encoded,hashlib.sha256(encoded.encode()).hexdigest(),actor
def append(values):
    if not isinstance(values,list) or not 1<=len(values)<=100: raise ValueError('Send 1–100 records')
    parsed=[record(v) for v in values]
    ids={}
    for v,encoded,digest,actor in parsed:
        if v['id'] in ids and ids[v['id']]!=digest:raise ValueError('Conflicting IDs in batch')
        ids[v['id']]=digest
    if shutil.disk_usage(STATE).free<2*1024**3: raise OSError('Audit storage reserve reached')
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        for v,encoded,digest,actor in parsed:
            old=db.execute('SELECT digest FROM records WHERE id=?',(v['id'],)).fetchone()
            if old and old['digest']!=digest:
                db.execute('INSERT INTO conflicts(record_id,received_at,digest) VALUES (?,?,?)',(v['id'],now(),digest));db.commit()
                raise FileExistsError('Existing audit differs; original retained')
        for v,encoded,digest,actor in parsed:
            if db.execute('SELECT 1 FROM records WHERE id=?',(v['id'],)).fetchone():continue
            last=db.execute('SELECT chain_hash FROM records ORDER BY sequence DESC LIMIT 1').fetchone()
            previous=last[0] if last else '0'*64;received=now()
            chain=hashlib.sha256((previous+'\n'+encoded+'\n'+received).encode()).hexdigest()
            db.execute('INSERT INTO records(id,created_at,received_at,member_id,member_name,member_email,author,kind,actor,payload,digest,previous_hash,chain_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
                (v['id'],v['createdAt'],received,v['memberId'],v['memberName'],v['memberEmail'],v['author'],v['kind'],actor,encoded,digest,previous,chain))
        head=db.execute('SELECT sequence,chain_hash,received_at FROM records ORDER BY sequence DESC LIMIT 1').fetchone()
    return {'accepted':[v[0]['id'] for v in parsed],'receipt':dict(head)}
def memory_status():
    try:
        fields={line.split(':')[0]:int(line.split()[1])*1024 for line in pathlib.Path('/proc/meminfo').read_text().splitlines() if line.startswith(('MemTotal:', 'MemAvailable:'))}
        total,available=fields['MemTotal'],fields['MemAvailable']
        if total<=0 or not 0<=available<=total: return None
        return {'totalBytes':total,'availableBytes':available}
    except (OSError,ValueError,KeyError,IndexError): return None

def status():
    with connect() as db:
        head=db.execute('SELECT sequence,received_at,chain_hash FROM records ORDER BY sequence DESC LIMIT 1').fetchone()
        total=db.execute('SELECT COUNT(*) FROM records').fetchone()[0];conflicts=db.execute('SELECT COUNT(*) FROM conflicts').fetchone()[0]
    try: backup=json.loads(STATUS.read_text())
    except (OSError,ValueError): backup={'ready':False,'message':'Awaiting backup-server maintenance'}
    disk=shutil.disk_usage(STATE)
    return {'checkedAt':now(),'audit':{'count':total,'head':dict(head) if head else None,'conflicts':conflicts},'backup':backup,'storage':{'freeBytes':disk.free,'totalBytes':disk.total},'memory':memory_status(),'appendOnly':True}
def query(params):
    allowed={'from','to','memberId','author','kind','q','actor','sort','order','page','pageSize'}
    if set(params)-allowed:raise ValueError('Unknown filter')
    p={k:v[0] for k,v in params.items()}
    if any(len(v)>512 for v in p.values()):raise ValueError('Filter too long')
    size=int(p.get('pageSize','20'));size=size if size in (20,50,100) else 20
    page=max(1,min(1000000,int(p.get('page','1'))));where=[];args=[]
    for key,column,op in [('memberId','member_id','='),('author','author','='),('kind','kind','='),('from','created_at','>='),('to','created_at','<')]:
        if p.get(key):where.append(column+op+'?');args.append(p[key])
    if p.get('actor')=='staff':where.append("actor='staff'")
    if p.get('q'):where.append("(coalesce(member_name,'')||' '||coalesce(member_email,'')||' '||author||' '||kind||' '||payload) LIKE ? ESCAPE '!'");args.append('%'+re.sub(r'[!%_]',lambda m:'!'+m[0],p['q'])+'%')
    clause=' WHERE '+' AND '.join(where) if where else ''
    sort=p.get('sort','date');sort=sort if sort in ('date','action','staff','member') else 'date';order='ASC' if p.get('order')=='asc' else 'DESC';column={'date':'created_at','action':'kind','staff':'author','member':'member_name'}[sort]
    with connect() as db:
        total=db.execute('SELECT COUNT(*) FROM records'+clause,args).fetchone()[0];pages=max(1,(total+size-1)//size);page=min(page,pages)
        rows=[{**json.loads(r['payload']),'archivedAt':r['received_at'],'archiveSequence':r['sequence'],'archiveHash':r['chain_hash']} for r in db.execute('SELECT * FROM records'+clause+f' ORDER BY {column} {order},id {order} LIMIT ? OFFSET ?',args+[size,(page-1)*size])]
        kinds=[r[0] for r in db.execute('SELECT DISTINCT kind FROM records ORDER BY kind LIMIT 1000')];authors=[r[0] for r in db.execute('SELECT DISTINCT author FROM records ORDER BY author LIMIT 1000')]
        member=db.execute('SELECT member_id,member_name FROM records WHERE member_id=? ORDER BY sequence DESC LIMIT 1',(p.get('memberId',''),)).fetchone()
    return {'rows':rows,'total':total,'page':page,'pages':pages,'pageSize':size,'sort':sort,'order':order.lower(),'kinds':kinds,'authors':authors,'member':{'id':member[0],'name':member[1]} if member else None,'source':'vault','checkedAt':now()}
class Handler(BaseHTTPRequestHandler):
    server_version='CubitVault';sys_version=''
    def log_message(self,*args):pass # Never log authorization or member search strings.
    def setup(self):super().setup();self.connection.settimeout(15)
    def reply(self,code,data):
        body=canonical(data).encode();self.send_response(code);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(body)
    def authorized(self,scope):
        token=self.headers.get('Authorization','');return hmac.compare_digest(token,'Bearer '+self.server.config[scope+'Token'])
    def do_GET(self):
        url=urlsplit(self.path)
        if not self.authorized('read'):return self.reply(401,{'message':'Unauthorized'})
        try:
            if url.path=='/status':return self.reply(200,status())
            if url.path=='/audit':return self.reply(200,query(parse_qs(url.query,keep_blank_values=True,max_num_fields=15)))
            self.reply(404,{'message':'Not found'})
        except (ValueError,OverflowError):self.reply(400,{'message':'Invalid filters'})
        except Exception:self.reply(503,{'message':'Archive unavailable'})
    def do_POST(self):
        if not self.authorized('write'):return self.reply(401,{'message':'Unauthorized'})
        if self.path!='/audit/append':return self.reply(404,{'message':'Not found'})
        try:
            size=int(self.headers.get('Content-Length','0'))
            if self.headers.get('Transfer-Encoding') or not 0<size<=MAX_BODY:return self.reply(413,{'message':'Request too large'})
            data=json.loads(self.rfile.read(size));self.reply(200,append(data))
        except FileExistsError:self.reply(409,{'message':'Conflicting audit record; original retained'})
        except (ValueError,TypeError,KeyError,AttributeError):self.reply(400,{'message':'Invalid audit records'})
        except Exception:self.reply(503,{'message':'Archive unavailable; retry later'})
    def do_DELETE(self):self.reply(405,{'message':'Deletion is not available'})
    do_PUT=do_DELETE;do_PATCH=do_DELETE
class Server(ThreadingHTTPServer):
    daemon_threads=True;request_queue_size=16
    def __init__(self,address,config):super().__init__(address,Handler);self.config=config;self.slots=threading.BoundedSemaphore(8)
    def process_request(self,request,address):
        if not self.slots.acquire(False):self.shutdown_request(request);return
        try:super().process_request(request,address)
        except BaseException:self.slots.release();raise
    def process_request_thread(self,request,address):
        try:super().process_request_thread(request,address)
        finally:self.slots.release()
if __name__=='__main__':
    os.umask(0o077);config=json.loads(CONFIG.read_text())
    if any(len(config.get(k,''))<40 for k in ('readToken','writeToken')):raise ValueError('Invalid credentials')
    initialize();Server(('127.0.0.1',8788),config).serve_forever()
