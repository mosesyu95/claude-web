const path = require('path')

function parseArgs() {
  const args = process.argv.slice(2)
  const pkg = require(path.join(__dirname, '..', 'package.json'))

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
claude-web v${pkg.version} — Web wrapper for Claude CLI

Usage: claude-web [options]

Options:
  -p, --port <number>    Server port (default: 3000)
  -t, --timeout <min>    Session idle timeout in minutes (default: 30)
  -d, --dirs <paths>     Allowed directories, comma-separated (default: home)
  -v, --version          Print version and exit
  -h, --help             Print this help and exit

Environment variables (lower priority than CLI flags):
  PORT                   Same as --port
  SESSION_TIMEOUT_MS     Timeout in milliseconds (use --timeout for minutes)
  ALLOWED_DIRS           Same as --dirs

Examples:
  claude-web                          Start on port 3000, 30min timeout
  claude-web --port 8080             Start on port 8080
  claude-web --timeout 60            Set timeout to 60 minutes
  claude-web --dirs /home,/projects  Restrict to these directories
`)
    process.exit(0)
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(`claude-web v${pkg.version}`)
    process.exit(0)
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const next = args[i + 1]

    if ((arg === '--port' || arg === '-p') && next) {
      process.env.PORT = next
      i++
    } else if ((arg === '--timeout' || arg === '-t') && next) {
      const minutes = parseInt(next)
      if (minutes > 0) process.env.SESSION_TIMEOUT_MS = String(minutes * 60000)
      i++
    } else if ((arg === '--dirs' || arg === '-d') && next) {
      process.env.ALLOWED_DIRS = next
      i++
    }
  }
}

module.exports = { parseArgs }
