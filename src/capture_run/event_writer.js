const fs = require('node:fs');

class EventWriter {
  constructor(path, runId) {
    this.path = path;
    this.runId = runId;
  }

  write(type, data) {
    const entry = {
      ts_ms: Date.now(),
      run_id: this.runId,
      type,
      data
    };
    fs.appendFileSync(this.path, JSON.stringify(entry) + '\n', 'utf8');
  }
}

module.exports = { EventWriter };
