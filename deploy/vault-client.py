"""Ephemeral loopback REST gateway: locks stay on the CRM, never on the vault.

The root backup worker's flock serializes clients. Vault maintenance stops its
receiver before touching the repository. Only read/append requests cross HTTPS.
"""
import base64,hmac,json,re,secrets,threading,urllib.request,urllib.error
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def setup(self):super().setup();self.connection.settimeout(120)
    def reply(self,code,body=b'',kind='application/vnd.x.restic.rest.v2',length=None,extra=None):
        self.send_response(code);self.send_header('Content-Type',kind);self.send_header('Content-Length',str(len(body) if length is None else length))
        for k,v in (extra or {}).items():self.send_header(k,v)
        self.end_headers()
        if self.command!='HEAD':self.wfile.write(body)
    def handle_request(self):
        if not hmac.compare_digest(self.headers.get('Authorization',''),self.server.local_auth):return self.reply(401)
        lock=re.fullmatch(r'/repository/locks/([a-f0-9]{64})?',self.path)
        if lock:
            key=lock[1]
            with self.server.guard:
                locks=self.server.locks
                if self.command=='POST' and key:
                    size=int(self.headers.get('Content-Length','0'))
                    if not 0<size<=16384:return self.reply(413)
                    locks[key]=self.rfile.read(size);return self.reply(200)
                if self.command=='DELETE' and key:locks.pop(key,None);return self.reply(200)
                if self.command in ('GET','HEAD'):
                    if not key:return self.reply(200,json.dumps([{'name':k,'size':len(v)} for k,v in locks.items()]).encode())
                    return self.reply(200,locks[key]) if key in locks else self.reply(404)
            return self.reply(405)
        allowed_read=re.fullmatch(r'/repository/(config|((keys|data|index|snapshots)/([a-f0-9]{64})?))',self.path)
        allowed_write=re.fullmatch(r'/repository/(data|index|snapshots)/[a-f0-9]{64}',self.path)
        if not (self.command in ('GET','HEAD') and allowed_read or self.command=='POST' and allowed_write):return self.reply(405)
        data=None
        if self.command=='POST':
            size=int(self.headers.get('Content-Length','0'))
            if self.headers.get('Transfer-Encoding') or not 0<size<=64*1024**2:return self.reply(413)
            data=self.rfile.read(size)
        headers={'Authorization':self.server.remote_auth}
        for key in ('Accept','Content-Type','Range'):
            if self.headers.get(key):headers[key]=self.headers[key]
        url=self.server.remote_url+self.path[len('/repository/'):]
        request=urllib.request.Request(url,data=data,headers=headers,method=self.command)
        try:
            with urllib.request.urlopen(request,timeout=120) as r:
                body=r.read();self.reply(r.status,body,r.headers.get('Content-Type','application/octet-stream'),int(r.headers.get('Content-Length',len(body))),{k:r.headers[k] for k in ('Content-Range','Accept-Ranges') if k in r.headers})
        except urllib.error.HTTPError as e:self.reply(e.code,e.read())
        except Exception:self.reply(503)
    do_GET=handle_request;do_HEAD=handle_request;do_POST=handle_request;do_DELETE=handle_request;do_PUT=handle_request;do_PATCH=handle_request

@contextmanager
def gateway(remote):
    server=ThreadingHTTPServer(('127.0.0.1',0),Handler);server.daemon_threads=True
    password=secrets.token_urlsafe(48)
    server.local_auth='Basic '+base64.b64encode(('crm:'+password).encode()).decode()
    server.remote_auth='Basic '+base64.b64encode((remote['username']+':'+remote['password']).encode()).decode()
    server.remote_url=remote['repository'][len('rest:'):].rstrip('/')+'/'
    server.locks={};server.guard=threading.Lock()
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    try:yield 'rest:http://127.0.0.1:'+str(server.server_port)+'/repository/',password
    finally:server.shutdown();server.server_close();thread.join()
