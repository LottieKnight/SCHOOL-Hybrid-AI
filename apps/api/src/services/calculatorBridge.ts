import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const CALCULATORS_DIR =
  process.env.SCHOOL_CALCULATORS_DIR ?? "/home/lottie";

const BRIDGES_DIR = fileURLToPath(
  new URL("../../scripts/calc-bridge/", import.meta.url)
);

export class CalculatorBridgeError extends Error {
  constructor(
    message: string,
    public readonly script: string,
    public readonly code: number | null,
    public readonly stderr: string
  ) {
    super(message);
    this.name = "CalculatorBridgeError";
  }
}

export type BridgeMode = "local" | "dropship" | "ddp" | "pilot" | "analytics" | "btc";

/**
 * Runs one of the verified /home/lottie calculators via its thin stdlib Python
 * bridge and returns the JSON it emits. The calculators are never edited; the
 * bridge scripts only import their pure functions and re-serialize the output.
 */
export function runCalculator<T = unknown>(
  mode: BridgeMode,
  input: Record<string, unknown>,
  timeoutMs = 15_000
): Promise<T> {
  const scriptPath = path.join(BRIDGES_DIR, `${mode}_bridge.py`);
  return new Promise<T>((resolve, reject) => {
    const child = spawn("python3", [scriptPath], {
      env: { ...process.env, SCHOOL_CALCULATORS_DIR: CALCULATORS_DIR },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(
        new CalculatorBridgeError(
          `${mode}_bridge.py timed out after ${timeoutMs}ms`,
          scriptPath,
          null,
          stderr
        )
      );
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(
        new CalculatorBridgeError(
          `Failed to launch ${mode}_bridge.py: ${error.message}`,
          scriptPath,
          null,
          stderr
        )
      );
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(
          new CalculatorBridgeError(
            `${mode}_bridge.py exited with code ${code}`,
            scriptPath,
            code,
            stderr
          )
        );
        return;
      }
      try {
        resolve(JSON.parse(stdout) as T);
      } catch {
        reject(
          new CalculatorBridgeError(
            `${mode}_bridge.py returned invalid JSON`,
            scriptPath,
            code,
            stderr
          )
        );
      }
    });
    child.stdin.end(JSON.stringify(input));
  });
}
