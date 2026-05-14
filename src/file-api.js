const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const express = require('express');

function createFileApiRouter() {
  const router = express.Router();

  // List directory contents
  router.get('/list', (req, res) => {
    try {
      let dir = req.query.dir || os.homedir();
      dir = path.resolve(dir);

      if (!fs.existsSync(dir)) {
        return res.status(404).json({ error: 'Directory not found' });
      }

      const stat = fs.statSync(dir);
      if (!stat.isDirectory()) {
        return res.status(400).json({ error: 'Not a directory' });
      }

      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const items = entries
        .filter(e => !e.name.startsWith('.'))
        .map(e => {
          const fullPath = path.join(dir, e.name);
          let size = 0;
          let modified = null;
          try {
            const s = fs.statSync(fullPath);
            size = s.size;
            modified = s.mtime.toISOString();
          } catch (err) {}
          return {
            name: e.name,
            type: e.isDirectory() ? 'dir' : 'file',
            size,
            modified,
            path: fullPath,
          };
        })
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      res.json({ path: dir, parent: path.dirname(dir), items });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Read file content
  router.get('/read', (req, res) => {
    try {
      const filePath = path.resolve(req.query.path || '');
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        return res.status(400).json({ error: 'Path is a directory' });
      }

      // Limit to 500KB
      if (stat.size > 500 * 1024) {
        return res.json({ path: filePath, content: null, truncated: true, size: stat.size });
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const ext = path.extname(filePath).slice(1);
      res.json({ path: filePath, content, size: stat.size, ext, truncated: false });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createFileApiRouter };
