/**
 * Architectural Test Runner & Harness
 * Enables automated test execution in both headless Node and the browser UI.
 * Phase 1 Architecture Foundation
 */

export interface TestResult {
  readonly id: string;
  readonly description: string;
  readonly category: string;
  readonly status: 'PASSED' | 'FAILED' | 'SKIPPED';
  readonly durationMs: number;
  readonly error?: string;
}

export interface TestSuiteSummary {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly totalDurationMs: number;
  readonly results: readonly TestResult[];
}

type TestFunction = () => void | Promise<void>;

interface RegisteredTestCase {
  id: string;
  category: string;
  description: string;
  fn: TestFunction;
}

export class TestHarness {
  private tests: RegisteredTestCase[] = [];

  public register(category: string, description: string, fn: TestFunction): void {
    const id = `test_${this.tests.length + 1}_${description.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    this.tests.push({ id, category, description, fn });
  }

  public include(other: TestHarness): void {
    for (const t of other.tests) {
      this.register(t.category, t.description, t.fn);
    }
  }

  public async runAll(): Promise<TestSuiteSummary> {
    const results: TestResult[] = [];
    const startTime = performance.now();

    for (const t of this.tests) {
      const testStart = performance.now();
      try {
        await t.fn();
        results.push({
          id: t.id,
          description: t.description,
          category: t.category,
          status: 'PASSED',
          durationMs: Math.round((performance.now() - testStart) * 100) / 100,
        });
      } catch (err: any) {
        results.push({
          id: t.id,
          description: t.description,
          category: t.category,
          status: 'FAILED',
          durationMs: Math.round((performance.now() - testStart) * 100) / 100,
          error: err?.message ?? String(err),
        });
      }
    }

    const totalDurationMs = Math.round((performance.now() - startTime) * 100) / 100;
    const passed = results.filter((r) => r.status === 'PASSED').length;
    const failed = results.filter((r) => r.status === 'FAILED').length;
    const skipped = results.filter((r) => r.status === 'SKIPPED').length;

    return {
      total: results.length,
      passed,
      failed,
      skipped,
      totalDurationMs,
      results,
    };
  }
}

/**
 * Lightweight assertion helpers for standalone headless execution.
 */
export function assertOk(value: unknown, message?: string): void {
  if (!value) throw new Error(message || `Assertion failed: expected truthy, got ${value}`);
}

export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message || `Assertion failed: expected ${expected}, got ${actual}`);
  }
}

export function assertDeepEqual<T>(actual: T, expected: T, message?: string): void {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(message || `Assertion failed:\nExpected: ${expectedStr}\nActual:   ${actualStr}`);
  }
}

export function assertDefined<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || `Expected value to be defined, got ${value}`);
  }
}

export function assertThrows(fn: () => unknown, expectedSubstring?: string, message?: string): void {
  let threw = false;
  try {
    fn();
  } catch (err: any) {
    threw = true;
    if (expectedSubstring && !String(err?.message ?? err).toLowerCase().includes(expectedSubstring.toLowerCase())) {
      throw new Error(
        message || `Expected error containing "${expectedSubstring}", got: "${err?.message ?? err}"`
      );
    }
  }
  if (!threw) {
    throw new Error(message || 'Expected function to throw an error, but it returned normally');
  }
}

export const assert = {
  ok: assertOk,
  equal: assertEqual,
  deepEqual: assertDeepEqual,
  isDefined: assertDefined,
  throws: assertThrows,
};
