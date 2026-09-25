import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('prune', Path(__file__).with_name('prune-releases.py'))
pruner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pruner)


class ReleaseCleanupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name).resolve()
        self.root = self.base / 'releases'
        self.root.mkdir()
        self.old = self.root / ('a' * 40 + '-20260924T120000Z')
        self.active = self.root / ('b' * 40 + '-20260925T120000Z')
        self.old.mkdir()
        self.active.mkdir()
        (self.old / 'app.js').write_text('old code')
        self.backup = self.base / 'backup.sql'
        self.backup.write_text('preserve data')
        self.current = self.base / 'current'
        self.current.symlink_to(self.active, target_is_directory=True)

    def test_dry_run_and_cleanup_preserve_active_and_external_files(self):
        (self.old / 'external').symlink_to(self.backup)
        self.assertEqual(pruner.prune(self.root, self.current, inspect=lambda _: None), 1)
        self.assertTrue(self.old.exists())
        self.assertEqual(pruner.prune(self.root, self.current, True, lambda _: None), 1)
        self.assertFalse(self.old.exists())
        self.assertTrue(self.active.is_dir())
        self.assertEqual(self.backup.read_text(), 'preserve data')
        self.assertEqual(pruner.prune(self.root, self.current, True, lambda _: None), 0)

    def test_invalid_pointer_never_deletes(self):
        self.current.unlink()
        self.current.symlink_to(self.base, target_is_directory=True)
        with self.assertRaises(RuntimeError):
            pruner.prune(self.root, self.current, True, lambda _: None)
        self.assertTrue(self.old.exists())

    def test_symlink_candidate_never_traversed(self):
        (self.root / ('c' * 40 + '-20260925T140000Z')).symlink_to(self.base, target_is_directory=True)
        with self.assertRaises(RuntimeError):
            pruner.prune(self.root, self.current, True, lambda _: None)
        self.assertTrue(self.old.exists())

    def test_in_use_or_changed_release_stops_cleanup(self):
        def in_use(_):
            raise RuntimeError('Process uses old release')
        with self.assertRaises(RuntimeError):
            pruner.prune(self.root, self.current, True, in_use)
        def change_pointer(_):
            self.current.unlink()
            self.current.symlink_to(self.old, target_is_directory=True)
        with self.assertRaises(RuntimeError):
            pruner.prune(self.root, self.current, True, change_pointer)
        self.assertTrue(self.old.exists())


if __name__ == '__main__':
    unittest.main()
