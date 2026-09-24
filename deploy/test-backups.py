import datetime as dt
import importlib.util
import io
import pathlib
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('worker',pathlib.Path(__file__).with_name('backup-worker.py'))
w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)

class BackupTests(unittest.TestCase):
    def test_inventory_has_only_safe_metadata_and_newest_first(self):
        rows=[{'id':'a'*64,'time':'2026-09-01T00:00:00Z','paths':['/private/path'],'hostname':'private','summary':{'total_bytes_processed':123}}, {'id':'b'*64,'time':'2026-09-02T00:00:00Z'}]
        with patch.object(w,'snapshots',return_value=rows):
            actual=w.local_inventory()
        self.assertEqual(actual,[{'id':'b'*64,'createdAt':rows[1]['time'],'bytes':None},{'id':'a'*64,'createdAt':rows[0]['time'],'bytes':123}])

    def test_selected_restore_must_exist_locally(self):
        with patch.object(w,'snapshots',return_value=[{'id':'a'*64,'time':'2026-09-01'}]) as listing,patch.object(w,'restic') as command:
            with self.assertRaises(RuntimeError):w.verify({**w.DEFAULTS,'offsiteEnabled':True},'b'*64)
            listing.assert_called_once_with(False);command.assert_not_called()
        for value in ['--help','../private','a'*12]:
            with self.assertRaises(ValueError):w.verify(w.DEFAULTS,value)

    def test_manual_retention_is_local_and_requires_repository_check(self):
        with patch.object(w,'local_inventory',side_effect=[[{}]*5,[{}]*3]),patch.object(w,'restic') as command:
            result=w.prune_local({**w.DEFAULTS,'localKeep':3})
            self.assertEqual(result['removed'],2)
            self.assertEqual(command.call_args_list[0].args,(['check'],))
            self.assertEqual(command.call_args_list[1].args,(['forget','--tag',w.TAG,'--group-by','host,tags','--keep-last','3','--prune'],))
        with patch.object(w,'local_inventory',return_value=[{}]*4),patch.object(w,'restic',side_effect=RuntimeError('corrupt')) as command:
            with self.assertRaises(RuntimeError):w.prune_local({**w.DEFAULTS,'localKeep':3})
            command.assert_called_once_with(['check'])
    def test_schedule_edges(self):
        s={**w.DEFAULTS,'frequency':'monthly','monthday':31,'timezone':'UTC'}
        due,nxt=w.slots(s,dt.datetime(2024,2,29,12,tzinfo=w.UTC))
        self.assertEqual(due[0],'2024-02-29');self.assertEqual(nxt[0],'2024-03-31')
        self.assertEqual(w.slots({**s,'frequency':'manual'},dt.datetime.now(w.UTC)),(None,None))
        s={**w.DEFAULTS,'time':'01:30'}
        due,nxt=w.slots(s,dt.datetime(2026,11,1,6,45,tzinfo=w.UTC))
        self.assertEqual(due[1].hour,5);self.assertEqual(nxt[0],'2026-11-02')
        due,_=w.slots({**s,'time':'02:15'},dt.datetime(2026,3,8,8,tzinfo=w.UTC))
        self.assertEqual(due[1].hour,7)

    def test_reject_unsafe_settings(self):
        for change in [{'localKeep':0},{'localKeep':True},{'offsiteEnabled':'yes'}, {'time':'24:00'}, {'timezone':'../../etc/passwd'}, {'command':'rm'}]:
            with self.assertRaises((ValueError,KeyError)): w.validate({**w.DEFAULTS,**change})

    def test_archive_escape_and_symlinks(self):
        with tempfile.TemporaryDirectory() as directory:
            root=pathlib.Path(directory)
            for name,kind in [('../outside',tarfile.REGTYPE),('/etc/passwd',tarfile.REGTYPE),('link',tarfile.SYMTYPE)]:
                archive=root/'test.tgz'
                with tarfile.open(archive,'w:gz') as t:
                    info=tarfile.TarInfo(name);info.type=kind;info.linkname='/etc/passwd';t.addfile(info,io.BytesIO())
                with self.assertRaises(ValueError): w.safe_extract(archive,root/'restore')

    def test_failed_remote_copy_never_prunes(self):
        with tempfile.TemporaryDirectory() as directory:
            payload=pathlib.Path(directory)/'payload';payload.mkdir()
            calls=[]
            def command(args,remote=False,cwd=None):
                calls.append(args)
                if args[0]=='copy': raise RuntimeError('copy unavailable')
                return b'{"message_type":"summary","snapshot_id":"123456789"}'
            with patch.object(w,'STATE',pathlib.Path(directory)),patch.object(w,'cfg',{'database':'test'},create=True),patch.object(w,'capture',return_value=payload),patch.object(w,'restic',side_effect=command):
                with self.assertRaises(RuntimeError): w.backup({**w.DEFAULTS,'offsiteEnabled':True})
            self.assertFalse(any(x[0]=='forget' for x in calls));self.assertFalse(payload.exists())

    def test_failed_capture_removes_plaintext_staging(self):
        with tempfile.TemporaryDirectory() as directory:
            root=pathlib.Path(directory);payload=root/'payload';payload.mkdir();(payload/'private.sql').write_text('fixture')
            with patch.object(w,'STATE',root),patch.object(w,'capture',side_effect=RuntimeError('export failed')):
                with self.assertRaises(RuntimeError):w.backup(w.DEFAULTS)
            self.assertFalse(payload.exists())

if __name__=='__main__': unittest.main()
