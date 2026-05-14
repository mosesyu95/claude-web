const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const express = require('express');

function runGit(args, cwd) {
  try {
    return execSync(`git ${args}`, {
      cwd: cwd || os.homedir(),
      encoding: 'utf-8',
      maxBuffer: 5 * 1024 * 1024,
      timeout: 10000,
    }).trim();
  } catch (err) {
    throw new Error(err.stderr?.trim() || err.message);
  }
}

function createGitApiRouter() {
  const router = express.Router();

  // Git status
  router.get('/status', (req, res) => {
    try {
      const cwd = req.query.dir || os.homedir();
      let output;
      try {
        output = runGit('status --porcelain=v2 --branch', cwd);
      } catch (e) {
        return res.json({ branch: { name: '', ahead: 0, behind: 0 }, staged: [], unstaged: [], untracked: [], error: 'Not a git repository' });
      }

      const branch = { name: '', ahead: 0, behind: 0 };
      const staged = [];
      const unstaged = [];
      const untracked = [];

      for (const line of output.split('\n')) {
        if (!line) continue;

        if (line.startsWith('# branch.head')) {
          const parts = line.split(' ');
          branch.name = parts.slice(2).join(' ') || '';
        } else if (line.startsWith('# branch.ab')) {
          const parts = line.split(' ');
          branch.ahead = Math.abs(parseInt(parts.find(p => p.startsWith('+'))?.slice(1)) || 0);
          branch.behind = Math.abs(parseInt(parts.find(p => p.startsWith('-'))?.slice(1)) || 0);
        } else if (line.startsWith('1 ') || line.startsWith('2 ')) {
          const parts = line.split(' ');
          const xy = parts[1];
          const filePath = parts.slice(-1)[0];
          const x = xy[0], y = xy[1];

          if (x !== '.' && x !== '?') staged.push({ path: filePath, status: x });
          if (y !== '.' && y !== '?') unstaged.push({ path: filePath, status: y });
        } else if (line.startsWith('? ')) {
          untracked.push({ path: line.slice(2) });
        }
      }

      res.json({ branch, staged, unstaged, untracked });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Git log
  router.get('/log', (req, res) => {
    try {
      const cwd = req.query.dir || os.homedir();
      const count = Math.min(parseInt(req.query.count) || 30, 100);
      let output;
      try {
        output = runGit(
          `log --max-count=${count} --pretty=format:'%H|%h|%an|%ae|%at|%s' --no-color`,
          cwd
        );
      } catch (e) {
        return res.json({ commits: [], error: 'Not a git repository' });
      }

      const commits = output.split('\n').filter(Boolean).map(line => {
        const [hash, shortHash, author, email, timestamp, message] = line.split('|');
        return { hash, shortHash, author, email, date: new Date(parseInt(timestamp) * 1000).toISOString(), message };
      });

      res.json({ commits });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Git diff (staged or unstaged)
  router.get('/diff', (req, res) => {
    try {
      const cwd = req.query.dir || os.homedir();
      const target = req.query.staged === '1' ? '--cached' : '';
      const file = req.query.file ? ` -- "${req.query.file}"` : '';
      const output = runGit(`diff --stat --patch${target ? ' ' + target : ''}${file}`, cwd);
      res.json({ diff: output });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Git branches
  router.get('/branches', (req, res) => {
    try {
      const cwd = req.query.dir || os.homedir();
      const output = runGit('branch -a --no-color', cwd);

      const branches = output.split('\n').filter(Boolean).map(line => {
        const current = line.startsWith('*');
        const name = line.replace(/^\*?\s+/, '').trim();
        const isRemote = name.startsWith('remotes/');
        return { name, current, isRemote };
      });

      res.json({ branches });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createGitApiRouter };
