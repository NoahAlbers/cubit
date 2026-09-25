"""Synthetic receiver/retention tests; never connects to a deployed server."""
import base64,datetime as dt,hashlib,http.client,importlib.util,json,pathlib,sqlite3,sys,tempfile,threading,types,unittest,uuid
from unittest.mock import patch
if sys.platform=='win32':sys.modules.setdefault('fcntl',types.ModuleType('fcntl'))

def load(name,file):
    spec=importlib.util.spec_from_file_location(name,pathlib.Path(__file__).parent/file);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
v=load('vault','server.py');m=load('maintenance','maintain.py')
c=load('client','../vault-client.py')

class GatewayTests(unittest.TestCase):
    def test_locks_never_cross_network_and_remote_deletes_are_rejected(self):
        with patch.object(c.urllib.request,'urlopen') as upstream,c.gateway({'repository':'rest:https://backup.example/repository/','username':'crm','password':'synthetic'}) as (url,password):
            from urllib.parse import urlsplit
            parsed=urlsplit(url[5:]);auth='Basic '+base64.b64encode(('crm:'+password).encode()).decode()
            def req(method,path,body=None,token=auth):
                conn=http.client.HTTPConnection(parsed.hostname,parsed.port)
                try:
                    conn.request(method,path,body,{'Authorization':token});r=conn.getresponse();return r.status,r.read()
                finally:conn.close()
            path='/repository/locks/'+'a'*64
            self.assertEqual(req('POST',path,b'synthetic lock')[0],200)
            self.assertEqual(req('GET',path),(200,b'synthetic lock'))
            self.assertEqual(req('DELETE',path)[0],200)
            self.assertEqual(req('GET',path)[0],404)
            for method in ('DELETE','PUT','PATCH'):
                self.assertEqual(req(method,'/repository/snapshots/'+'a'*64)[0],405)
            self.assertEqual(req('GET','/repository/config',token='wrong')[0],401)
            self.assertEqual(req('GET','/repository/../operator')[0],405)
            upstream.assert_not_called()

class ReceiverTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=pathlib.Path(self.temp.name)
        self.state=patch.object(v,'STATE',self.root);self.state.start();self.status=patch.object(v,'STATUS',self.root/'status.json');self.status.start();v.initialize()
    def tearDown(self):self.status.stop();self.state.stop();self.temp.cleanup()
    def record(self,**values):return dict(id=str(uuid.uuid4()),createdAt='2026-09-25T14:00:00Z',memberId=None,memberName=None,memberEmail=None,author='Synthetic tester',kind='Test action',detail='{}',**values)
    def test_idempotent_immutable_and_chain(self):
        first=self.record();second=self.record();v.append([first,second]);v.append([first])
        self.assertEqual(v.status()['audit']['count'],2)
        with self.assertRaises(FileExistsError):v.append([{**first,'author':'Changed'}])
        self.assertEqual(v.status()['audit']['conflicts'],1)
        with v.connect() as db:
            for command in ('DELETE FROM records','UPDATE records SET author=\'changed\''):
                with self.assertRaises(sqlite3.IntegrityError):db.execute(command)
            previous='0'*64
            for row in db.execute('SELECT * FROM records ORDER BY sequence'):
                self.assertEqual(row['previous_hash'],previous)
                self.assertEqual(row['digest'],hashlib.sha256(row['payload'].encode()).hexdigest())
                previous=hashlib.sha256((previous+'\n'+row['payload']+'\n'+row['received_at']).encode()).hexdigest()
                self.assertEqual(row['chain_hash'],previous)
    def test_batch_validation_and_capacity_leave_originals(self):
        row=self.record();v.append([row])
        with self.assertRaises(ValueError):v.append([self.record(),{**row,'extra':'bad'}])
        with patch.object(v.shutil,'disk_usage',return_value=types.SimpleNamespace(free=1)):
            with self.assertRaises(OSError):v.append([self.record()])
        self.assertEqual(v.status()['audit']['count'],1)
    def test_filters_and_scoped_credentials(self):
        row=self.record();row['kind']='100% literal';v.append([row,self.record()])
        self.assertEqual(v.query({'q':['%']})['total'],1)
        self.assertEqual(v.query({'from':['2026-09-26T00:00:00Z']})['total'],0)
        server=v.Server(('127.0.0.1',0),{'readToken':'r'*48,'writeToken':'w'*48});thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        def request(method,path,token,body=None):
            c=http.client.HTTPConnection('127.0.0.1',server.server_port,timeout=5)
            try:
                c.request(method,path,json.dumps(body) if body is not None else None,{'Authorization':'Bearer '+token});res=c.getresponse();res.read();return res.status
            finally:c.close()
        try:
            self.assertEqual(request('GET','/audit','r'*48),200)
            self.assertEqual(request('GET','/audit','w'*48),401)
            self.assertEqual(request('POST','/audit/append','r'*48,[row]),401)
            self.assertEqual(request('POST','/audit/append','w'*48,[row]),200)
            for method in ('DELETE','PUT','PATCH'):self.assertEqual(request(method,'/audit','w'*48),405)
            self.assertEqual(request('POST','/retention','w'*48,{}),404)
        finally:server.shutdown();server.server_close();thread.join()

class RetentionTests(unittest.TestCase):
    def test_receiver_age_and_verified_copy_survive_forged_dates(self):
        with tempfile.TemporaryDirectory() as directory:
            root=pathlib.Path(directory);(root/'operator').mkdir();(root/'status').mkdir();config=root/'config.json';config.write_text('{"retentionDays":30}')
            current=dt.datetime(2026,9,25,tzinfo=dt.timezone.utc);old=m.iso(current-dt.timedelta(days=40));recent=m.iso(current-dt.timedelta(days=1))
            ids=['a'*64,'b'*64,'c'*64,'d'*64]
            state={'firstSeen':{ids[0]:old,ids[1]:old,ids[2]:recent},'verifiedSnapshot':ids[0],'lastRestore':{'ok':True,'snapshot':ids[0]}}
            (root/'operator/receipts.json').write_text(json.dumps(state))
            rows=[{'id':i,'time':'1900-01-01T00:00:00Z'} for i in ids]
            with patch.object(m,'ROOT',root),patch.object(m,'CONFIG',config),patch.object(m,'now',return_value=current),patch.object(m.time,'sleep') as drain,patch.object(m,'run') as system,patch.object(m,'restic',side_effect=lambda *a:json.dumps(rows).encode() if a[0]=='snapshots' else b'') as commands:
                m.cycle()
                drain.assert_called_once_with(1850)
                self.assertIn(('forget',ids[1]),[c.args for c in commands.call_args_list])
                self.assertEqual([r['id'] for r in json.loads((root/'status/backup.json').read_text())['snapshots']],[ids[3],ids[2],ids[0]])
                self.assertEqual(system.call_args_list[0].args[0][1],'stop');self.assertEqual(system.call_args_list[-1].args[0][1],'start')
    def test_inventory_does_not_clear_failed_recovery_or_delete(self):
        with tempfile.TemporaryDirectory() as directory:
            root=pathlib.Path(directory);(root/'operator').mkdir();(root/'status').mkdir();config=root/'config.json';config.write_text('{"retentionDays":30}')
            (root/'operator/receipts.json').write_text(json.dumps({'firstSeen':{},'lastRestore':{'ok':False},'health':{'error':'Needs operator review'}}))
            with patch.object(m,'ROOT',root),patch.object(m,'CONFIG',config),patch.object(m,'restic',return_value=b'[]') as commands,patch.object(m,'run') as system:
                m.cycle(inventory=True)
                self.assertEqual([c.args for c in commands.call_args_list],[('snapshots','--json')]);system.assert_not_called()
            status=json.loads((root/'status/backup.json').read_text());self.assertFalse(status['lastRestore']['ok']);self.assertIn('error',status)

if __name__=='__main__':unittest.main()
