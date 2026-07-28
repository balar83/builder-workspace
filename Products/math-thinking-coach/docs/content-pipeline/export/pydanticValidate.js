// Phase [5]: real runtime-schema validation. Shells out to the backend's
// actual Python virtual environment and imports the actual Pydantic models
// (app.schemas.*) - never a JS reimplementation that could drift from the
// real schema. If the Pydantic model changes, this step's behavior changes
// automatically with it.

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function validateAgainstRuntimeSchemas({ backendDir, chapters, topics, questions }) {
  const pythonExe = path.join(backendDir, '.venv', 'Scripts', 'python.exe');
  const scriptPath = path.join(__dirname, 'validate_runtime.py');

  if (!fs.existsSync(pythonExe)) {
    throw new Error(`Backend Python venv not found at ${pythonExe} - cannot perform real Pydantic validation`);
  }

  const payload = JSON.stringify({ chapters: chapters || [], topics: topics || [], questions: questions || [] });

  const result = spawnSync(pythonExe, [scriptPath], {
    cwd: backendDir,
    input: payload,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(`Failed to invoke Python validator: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`Python validator exited with status ${result.status}. stderr: ${result.stderr}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (err) {
    throw new Error(`Python validator produced non-JSON output: ${result.stdout}\nstderr: ${result.stderr}`);
  }

  return parsed;
}

module.exports = { validateAgainstRuntimeSchemas };
